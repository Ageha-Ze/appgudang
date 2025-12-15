// app/api/transaksi/penjualan/[id]/billing/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { calculatePenjualanTotals } from '@/lib/transaksi/calculateTotals';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();

    console.log('🔄 Processing billing:', id, body);

    // Validasi input
    if (!body.jenis_pembayaran) {
      return NextResponse.json(
        { error: 'Jenis pembayaran harus dipilih' },
        { status: 400 }
      );
    }

    if (body.jenis_pembayaran === 'tunai' && !body.kas_id) {
      return NextResponse.json(
        { error: 'Pilih rekening kas untuk pembayaran tunai' },
        { status: 400 }
      );
    }

    if (body.jenis_pembayaran === 'hutang' && !body.jatuh_tempo) {
      return NextResponse.json(
        { error: 'Jatuh tempo harus diisi untuk pembayaran hutang' },
        { status: 400 }
      );
    }

    // ✅ Get penjualan data WITH cabang_id
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select('total, customer_id, pegawai_id, cabang_id, detail_penjualan(*), tanggal')
      .eq('id', id)
      .single();

    if (penjualanError) throw penjualanError;

    console.log('📦 Penjualan data:', penjualan);

    // Calculate final total
    const biayaOngkir = parseFloat(body.biaya_ongkir) || 0;
    const biayaPotong = parseFloat(body.biaya_potong) || 0;
    const diskon = parseFloat(body.nilai_diskon ?? 0) || 0;
    const { subtotal } = calculatePenjualanTotals(penjualan as any);
    const finalTotal = subtotal + biayaOngkir + biayaPotong - diskon;

    console.log('💰 Totals:', { subtotal, biayaOngkir, biayaPotong, diskon, finalTotal });

    // ✅ Update transaksi penjualan - PRESERVE cabang_id
    const updateData: any = {
      status: 'billed',
      jenis_pembayaran: body.jenis_pembayaran,
      biaya_ongkir: biayaOngkir,
      biaya_potong: biayaPotong,
      nilai_diskon: diskon,
      total: finalTotal,
      dibayar: 0, // Initialize dibayar
      cabang_id: penjualan.cabang_id, // ✅ PRESERVE cabang_id
    };

    if (body.jenis_pembayaran === 'tunai') {
      updateData.status_pembayaran = 'Lunas';
      updateData.dibayar = finalTotal; // Tunai langsung lunas
      updateData.tanggal_transaksi_terakhir = new Date().toISOString().split('T')[0];
      updateData.kas_id = body.kas_id; // ✅ Simpan kas_id
    } else if (body.jenis_pembayaran === 'hutang') {
      updateData.status_pembayaran = 'Belum Lunas';
      updateData.jatuh_tempo = body.jatuh_tempo; // Simpan jatuh tempo
    }

    console.log('📝 Update data:', updateData);

    const { error: updateError } = await supabase
      .from('transaksi_penjualan')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    console.log('✅ Penjualan updated');

    // ✅ JIKA TUNAI, UPDATE KAS
    if (body.jenis_pembayaran === 'tunai') {
      const kasId = body.kas_id;

      // Get current saldo kas
      const { data: kas, error: kasError } = await supabase
        .from('kas')
        .select('saldo, nama_kas')
        .eq('id', kasId)
        .single();

      if (kasError) throw kasError;

      const newSaldo = parseFloat(kas.saldo.toString()) + finalTotal;

      // Update saldo kas
      const { error: updateKasError } = await supabase
        .from('kas')
        .update({ saldo: newSaldo })
        .eq('id', kasId);

      if (updateKasError) throw updateKasError;

      // Insert transaksi kas (kredit = masuk)
      const { error: transaksiKasError } = await supabase
        .from('transaksi_kas')
        .insert({
          kas_id: kasId,
          tanggal_transaksi: penjualan.tanggal || new Date().toISOString().split('T')[0],
          debit: 0,
          kredit: finalTotal,
          keterangan: `Penjualan tunai #${id}`
        });

      if (transaksiKasError) throw transaksiKasError;

      console.log(`💵 Kas ${kas.nama_kas}: ${kas.saldo} + ${finalTotal} = ${newSaldo}`);
    }

    // ✅ JIKA HUTANG, INSERT PIUTANG
    if (body.jenis_pembayaran === 'hutang') {
      // Check if piutang already exists
      const { data: existingPiutang } = await supabase
        .from('piutang_penjualan')
        .select('id')
        .eq('penjualan_id', parseInt(id))
        .single();

      if (!existingPiutang) {
        const { error: piutangError } = await supabase
          .from('piutang_penjualan')
          .insert({
            penjualan_id: parseInt(id),
            customer_id: penjualan.customer_id,
            tanggal_piutang: penjualan.tanggal,
            total_piutang: finalTotal,
            dibayar: 0,
            sisa: finalTotal,
            status: 'belum_lunas',
        jatuh_tempo: body.jatuh_tempo
          });

        if (piutangError) {
          console.error('❌ Error creating piutang:', piutangError);
        } else {
          console.log('✅ Piutang created');
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Billing berhasil! ${body.jenis_pembayaran === 'tunai' ? 'Status: Lunas' : 'Piutang tercatat'}`,
      data: {
        finalTotal,
        jenisPembayaran: body.jenis_pembayaran,
        statusPembayaran: updateData.status_pembayaran,
        cabangId: penjualan.cabang_id // ✅ Return cabang_id untuk konfirmasi
      }
    });
  } catch (error: any) {
    console.error('❌ Error billing:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}