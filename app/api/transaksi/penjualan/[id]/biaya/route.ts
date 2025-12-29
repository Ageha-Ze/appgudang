'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();


    // Get existing penjualan dengan data lengkap
    const { data: existingPenjualan } = await supabase
      .from('transaksi_penjualan')
      .select('total, dibayar, jenis_pembayaran, status_pembayaran, biaya_ongkir, biaya_potong, nilai_diskon')
      .eq('id', id)
      .single();

    if (!existingPenjualan) {
      return NextResponse.json({ error: 'Penjualan tidak ditemukan' }, { status: 404 });
    }

    // ✅ Hitung subtotal dari detail penjualan
    const { data: detailItems } = await supabase
      .from('detail_penjualan')
      .select('subtotal')
      .eq('penjualan_id', id);

    const subtotal = detailItems?.reduce(
      (sum: number, item: any) => sum + Number(item.subtotal || 0),
      0
    ) || 0;

    // ✅ Hitung total baru
    const biayaOngkir = Number(body.biaya_ongkir || 0);
    const biayaKemas = Number(body.biaya_potong || 0);
    const nilaiDiskon = Number(body.nilai_diskon || 0);
    const totalBaru = subtotal + biayaOngkir + biayaKemas - nilaiDiskon;

    // ✅ Hitung total lama
    const biayaOngkirLama = Number(existingPenjualan.biaya_ongkir || 0);
    const biayaKemasLama = Number(existingPenjualan.biaya_potong || 0);
    const nilaiDiskonLama = Number(existingPenjualan.nilai_diskon || 0);
    const totalLama = subtotal + biayaOngkirLama + biayaKemasLama - nilaiDiskonLama;

    // 🔥 CEK APAKAH ADA PERUBAHAN BIAYA
    const adaPerubahanBiaya = (
      biayaOngkir !== biayaOngkirLama ||
      biayaKemas !== biayaKemasLama ||
      nilaiDiskon !== nilaiDiskonLama
    );

    const isLunas = existingPenjualan.status_pembayaran === 'Lunas';
    
    // 🔥 JIKA LUNAS DAN ADA PERUBAHAN BIAYA, UBAH STATUS JADI "Belum Lunas"
    let statusPembayaranBaru = existingPenjualan.status_pembayaran;
    let dibayarBaru = parseFloat(existingPenjualan.dibayar || '0');
    
    if (isLunas && adaPerubahanBiaya && totalBaru !== totalLama) {
      
      // Jika total berubah dan sebelumnya lunas, cek kembali status
      const sisaTagihan = totalBaru - dibayarBaru;
      
      if (sisaTagihan > 0) {
        statusPembayaranBaru = 'Belum Lunas';
      } else if (sisaTagihan < 0) {
        // Jika dibayar lebih dari total baru, status tetap Lunas
        statusPembayaranBaru = 'Lunas';
      }
    }

    // 1. Update biaya dan total di transaksi penjualan
    const updateData: any = {
      biaya_ongkir: biayaOngkir,
      biaya_potong: biayaKemas,
      nilai_diskon: nilaiDiskon,
      total: totalBaru,
      status_pembayaran: statusPembayaranBaru,
      tanggal_transaksi_terakhir: body.tanggal_transaksi || new Date().toISOString().split('T')[0],
    };

    const { error: updateError } = await supabase
      .from('transaksi_penjualan')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;


    // 2. Update piutang jika ada
    const { data: piutang } = await supabase
      .from('piutang_penjualan')
      .select('*')
      .eq('penjualan_id', id)
      .single();

    if (piutang) {
      const sisaBaru = totalBaru - dibayarBaru;
      await supabase
        .from('piutang_penjualan')
        .update({
          total_piutang: totalBaru,
          sisa: sisaBaru,
          status: statusPembayaranBaru === 'Lunas' ? 'lunas' : (dibayarBaru > 0 ? 'cicil' : 'belum_lunas'),
        })
        .eq('id', piutang.id);

    }

    // 3. Jika ada uang muka, proses uang muka
    if (body.uang_muka && body.uang_muka > 0 && body.kas_id) {
      const uangMuka = Number(body.uang_muka);
      const dibayarSebelumnya = parseFloat(existingPenjualan.dibayar || '0');
      const dibayarDenganUM = dibayarSebelumnya + uangMuka;
      const sisaDenganUM = totalBaru - dibayarDenganUM;
      const statusDenganUM = sisaDenganUM <= 0 ? 'Lunas' : 'Cicil';


      // Validasi uang muka tidak melebihi total
      if (dibayarDenganUM > totalBaru) {
        return NextResponse.json(
          { error: `Uang muka melebihi total. Maksimal: Rp. ${(totalBaru - dibayarSebelumnya).toLocaleString('id-ID')}` },
          { status: 400 }
        );
      }

      // Update dibayar dan status di penjualan
      await supabase
        .from('transaksi_penjualan')
        .update({
          dibayar: dibayarDenganUM,
          status_pembayaran: statusDenganUM
        })
        .eq('id', id);


      // Get kas data
      const { data: kas } = await supabase
        .from('kas')
        .select('saldo, nama_kas')
        .eq('id', body.kas_id)
        .single();

      if (kas) {
        const saldoKasLama = parseFloat(kas.saldo);
        const saldoKasBaru = saldoKasLama + uangMuka;

        // Update kas (bertambah)
        await supabase
          .from('kas')
          .update({ saldo: saldoKasBaru })
          .eq('id', body.kas_id);

      }

      // Insert ke cicilan_penjualan
      await supabase
        .from('cicilan_penjualan')
        .insert({
          penjualan_id: parseInt(id),
          tanggal_cicilan: body.tanggal_transaksi || new Date().toISOString().split('T')[0],
          jumlah_cicilan: uangMuka,
          kas_id: body.kas_id,
          keterangan: 'Uang Muka',
        });


      // Insert ke transaksi_kas (kredit = uang masuk)
      await supabase
        .from('transaksi_kas')
        .insert({
          kas_id: body.kas_id,
          tanggal_transaksi: body.tanggal_transaksi || new Date().toISOString().split('T')[0],
          kredit: uangMuka,
          debit: 0,
          keterangan: `Uang muka penjualan #${id}`,
        });


      // Update piutang jika ada
      if (piutang) {
        await supabase
          .from('piutang_penjualan')
          .update({
            total_piutang: totalBaru,
            dibayar: dibayarDenganUM,
            sisa: sisaDenganUM,
            status: statusDenganUM === 'Lunas' ? 'lunas' : (dibayarDenganUM > 0 ? 'cicil' : 'belum_lunas'),
          })
          .eq('id', piutang.id);

      }
    }

    // Return updated penjualan
    const { data: updatedPenjualan, error: fetchError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        *,
        customer:customer_id (id, nama, kode_customer),
        pegawai:pegawai_id (id, nama, jabatan, cabang_id)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ message: 'Biaya berhasil diupdate' });
    }


    let message = 'Biaya berhasil diupdate';
    if (isLunas && adaPerubahanBiaya && statusPembayaranBaru === 'Belum Lunas') {
      message += ' ⚠️ Status pembayaran berubah dari Lunas menjadi Belum Lunas karena ada perubahan biaya';
    }

    return NextResponse.json({
      success: true,
      message,
      data: updatedPenjualan,
      statusChanged: isLunas && statusPembayaranBaru !== 'Lunas'
    });
  } catch (error: any) {
    console.error('❌ Error updating biaya:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
