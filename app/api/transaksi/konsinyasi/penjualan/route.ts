// app/api/transaksi/konsinyasi/penjualan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // Validasi input
    if (!body.detail_konsinyasi_id || !body.jumlah_terjual || !body.tanggal_jual || !body.kas_id) {
      return NextResponse.json(
        { error: 'Detail konsinyasi, jumlah terjual, tanggal jual, dan kas wajib diisi' },
        { status: 400 }
      );
    }

    const jumlah = parseFloat(body.jumlah_terjual);

    if (jumlah <= 0) {
      return NextResponse.json(
        { error: 'Jumlah terjual harus lebih dari 0' },
        { status: 400 }
      );
    }

    // Get detail konsinyasi dengan parent data
    const { data: detail, error: detailError } = await supabase
      .from('detail_konsinyasi')
      .select(`
        *,
        konsinyasi:konsinyasi_id (
          id,
          kode_konsinyasi,
          status,
          cabang_id,
          tanggal_titip
        ),
        produk:produk_id (
          id,
          nama_produk,
          stok
        )
      `)
      .eq('id', body.detail_konsinyasi_id)
      .single();

    if (detailError || !detail) {
      console.error('Error fetching detail konsinyasi:', detailError);
      return NextResponse.json(
        { error: 'Detail konsinyasi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi: Cek status konsinyasi
    if (detail.konsinyasi?.status !== 'Aktif') {
      return NextResponse.json(
        { error: `Tidak bisa jual, konsinyasi ${detail.konsinyasi?.status}` },
        { status: 400 }
      );
    }

    // Validasi: Jumlah tidak melebihi sisa
    if (jumlah > detail.jumlah_sisa) {
      return NextResponse.json(
        {
          error: `Jumlah terjual (${jumlah}) melebihi sisa barang (${detail.jumlah_sisa})`
        },
        { status: 400 }
      );
    }

    // Get kas untuk validasi
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('id, nama_kas, saldo')
      .eq('id', body.kas_id)
      .single();

    if (kasError || !kas) {
      return NextResponse.json(
        { error: 'Kas tidak ditemukan' },
        { status: 404 }
      );
    }

    // Calculate nilai jual
    const hargaJualToko = parseFloat(body.harga_jual_toko || detail.harga_jual_toko?.toString() || '0');
    const hargaKonsinyasi = parseFloat(detail.harga_konsinyasi?.toString() || '0');
    const totalNilaiKita = jumlah * hargaKonsinyasi;
    const totalPenjualan = jumlah * hargaJualToko;
    const keuntunganToko = totalPenjualan - totalNilaiKita;

    // Insert penjualan konsinyasi
    const { data: penjualan, error: penjualanError } = await supabase
      .from('penjualan_konsinyasi')
      .insert({
        detail_konsinyasi_id: body.detail_konsinyasi_id,
        tanggal_jual: body.tanggal_jual,
        jumlah_terjual: jumlah,
        harga_jual_toko: hargaJualToko,
        total_penjualan: totalPenjualan,
        total_nilai_kita: totalNilaiKita,
        keuntungan_toko: keuntunganToko,
        kas_id: body.kas_id,
        tanggal_pembayaran: body.tanggal_pembayaran || body.tanggal_jual,
        status_pembayaran: 'Lunas',
        keterangan: body.keterangan || null,
      })
      .select()
      .single();

    if (penjualanError) {
      console.error('Error inserting penjualan:', penjualanError);
      throw penjualanError;
    }

    // Update detail konsinyasi
    const newJumlahTerjual = parseFloat(detail.jumlah_terjual) + jumlah;
    const newJumlahSisa = parseFloat(detail.jumlah_sisa) - jumlah;
    const newKeuntunganToko = parseFloat(detail.keuntungan_toko) + keuntunganToko;

    const { error: updateDetailError } = await supabase
      .from('detail_konsinyasi')
      .update({
        jumlah_terjual: newJumlahTerjual,
        jumlah_sisa: newJumlahSisa,
        keuntungan_toko: newKeuntunganToko,
      })
      .eq('id', body.detail_konsinyasi_id);

    if (updateDetailError) {
      console.error('Error updating detail:', updateDetailError);
      // Rollback: hapus penjualan yang baru dibuat
      await supabase
        .from('penjualan_konsinyasi')
        .delete()
        .eq('id', penjualan.id);
      throw new Error('Gagal update detail konsinyasi');
    }

    // Update kas (tambah pemasukan)
    const newSaldo = parseFloat(kas.saldo.toString()) + totalNilaiKita;

    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ 
        saldo: newSaldo,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.kas_id);

    if (updateKasError) {
      console.error('Error updating kas:', updateKasError);
      // Rollback
      await supabase
        .from('detail_konsinyasi')
        .update({
          jumlah_terjual: detail.jumlah_terjual,
          jumlah_sisa: detail.jumlah_sisa,
          keuntungan_toko: detail.keuntungan_toko,
        })
        .eq('id', body.detail_konsinyasi_id);
      await supabase
        .from('penjualan_konsinyasi')
        .delete()
        .eq('id', penjualan.id);
      throw new Error('Gagal update saldo kas');
    }

    // Insert transaksi kas (kredit = masuk)
    await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: body.kas_id,
        tanggal_transaksi: body.tanggal_pembayaran || body.tanggal_jual,
        debit: 0,
        kredit: totalNilaiKita,
        keterangan: `Penjualan Konsinyasi ${detail.konsinyasi?.kode_konsinyasi} - ${detail.produk?.nama_produk}`
      });

    // NOTE: Stock akan dikurangi saat konsinyasi diselesaikan (status = "Selesai")
    // Penjualan konsinyasi hanya mencatat transaksi, TIDAK mengurangi stock
    console.log('ℹ️ Stock akan dikurangi saat konsinyasi diselesaikan');

    return NextResponse.json({
      success: true,
      message: 'Penjualan konsinyasi berhasil dicatat dan kas diperbarui',
      data: {
        penjualan_id: penjualan.id,
        produk: detail.produk?.nama_produk,
        jumlah_terjual: jumlah,
        total_penjualan: totalPenjualan,
        keuntungan_toko: keuntunganToko,
        kas_updated: true,
        stock_note: 'Stock akan dikurangi saat konsinyasi diselesaikan'
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating penjualan konsinyasi:', error);
    return NextResponse.json({
      error: error.message || 'Gagal mencatat penjualan konsinyasi'
    }, { status: 500 });
  }
}
