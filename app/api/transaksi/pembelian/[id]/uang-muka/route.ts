// app/api/transaksi/pembelian/[id]/uang-muka/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { calculatePembelianTotals } from '@/lib/transaksi/calculatePembelianTotals';

// PATCH - Update uang muka dan biaya kirim
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { id: pembelian_id } = await context.params;
    const body = await request.json();

    const uang_muka_baru = Number(body.uang_muka || 0);
    const biaya_kirim_baru = Number(body.biaya_kirim || 0);
    const rekening_bayar = body.rekening_bayar || null;

    // Get pembelian current
    const { data: pembelian, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select('*, detail_pembelian(id, jumlah, harga, subtotal)')
      .eq('id', pembelian_id)
      .single();

    if (pembelianError) throw pembelianError;

    const uang_muka_lama = Number(pembelian.uang_muka || 0);
    const rekening_lama = pembelian.rekening_bayar;

    // 1. Cari cicilan uang_muka yang lama (jika ada)
    const { data: cicilanLama } = await supabase
      .from('cicilan_pembelian')
      .select('*')
      .eq('pembelian_id', pembelian_id)
      .eq('type', 'uang_muka')
      .single();

    // 2. Jika ada cicilan lama, kembalikan dulu saldo kas-nya
    if (cicilanLama && rekening_lama) {
      const { data: kasLama } = await supabase
        .from('kas')
        .select('*')
        .eq('nama_kas', rekening_lama)
        .single();

      if (kasLama) {
        const kasSaldoLama = parseFloat(kasLama.saldo.toString());
        const newSaldoLama = kasSaldoLama + uang_muka_lama;

        await supabase
          .from('kas')
          .update({ saldo: newSaldoLama })
          .eq('id', kasLama.id);

        // Insert transaksi kas (kredit = masuk/dikembalikan)
        await supabase
          .from('transaksi_kas')
          .insert({
            kas_id: kasLama.id,
            tanggal_transaksi: new Date().toISOString().split('T')[0],
            debit: 0,
            kredit: uang_muka_lama,
            keterangan: `Pengembalian Uang Muka - Edit (Nota: ${pembelian.nota_supplier})`
          });
      }

      // Hapus cicilan lama
      await supabase
        .from('cicilan_pembelian')
        .delete()
        .eq('id', cicilanLama.id);
    }

    // 3. Update data pembelian
    const { error: updateError } = await supabase
      .from('transaksi_pembelian')
      .update({
        uang_muka: uang_muka_baru,
        biaya_kirim: biaya_kirim_baru,
        rekening_bayar: rekening_bayar
      })
      .eq('id', pembelian_id);

    if (updateError) throw updateError;

    // 4. Insert cicilan uang_muka yang baru (jika ada)
    if (uang_muka_baru > 0) {
      const { error: cicilanError } = await supabase
        .from('cicilan_pembelian')
        .insert({
          pembelian_id: parseInt(pembelian_id),
          tanggal_cicilan: pembelian.tanggal,
          jumlah_cicilan: uang_muka_baru,
          rekening: rekening_bayar,
          type: 'uang_muka',
          keterangan: 'Uang Muka (Updated)'
        });

      if (cicilanError) throw cicilanError;

      // 5. Kurangi saldo kas yang baru
      if (rekening_bayar) {
        const { data: kasBaru } = await supabase
          .from('kas')
          .select('*')
          .eq('nama_kas', rekening_bayar)
          .single();

        if (kasBaru) {
          const kasSaldoBaru = parseFloat(kasBaru.saldo.toString());
          const newSaldoBaru = kasSaldoBaru - uang_muka_baru;

          await supabase
            .from('kas')
            .update({ saldo: newSaldoBaru })
            .eq('id', kasBaru.id);

          // Insert transaksi kas (debit = keluar)
          await supabase
            .from('transaksi_kas')
            .insert({
              kas_id: kasBaru.id,
              tanggal_transaksi: new Date().toISOString().split('T')[0],
              debit: uang_muka_baru,
              kredit: 0,
              keterangan: `Uang Muka Pembelian - Updated (Nota: ${pembelian.nota_supplier})`
            });
        }
      }
    }

    // 6. Update status pembayaran
    const preview = {
      ...pembelian,
      biaya_kirim: biaya_kirim_baru,
      uang_muka: uang_muka_baru,
    };
    const { finalTotal } = calculatePembelianTotals(preview as any);

    // Hitung total cicilan (tanpa uang muka)
    const { data: cicilanList } = await supabase
      .from('cicilan_pembelian')
      .select('jumlah_cicilan')
      .eq('pembelian_id', pembelian_id)
      .neq('type', 'uang_muka');

    const totalCicilan = (cicilanList || []).reduce(
      (sum, c) => sum + Number(c.jumlah_cicilan || 0),
      0
    );

    const totalDibayar = uang_muka_baru + totalCicilan;
    const sisaHutang = Math.max(0, finalTotal - totalDibayar);

    const status_pembayaran =
      sisaHutang <= 0 ? 'Lunas' : totalDibayar > 0 ? 'Cicil' : 'Belum Lunas';

    await supabase
      .from('transaksi_pembelian')
      .update({ status_pembayaran })
      .eq('id', pembelian_id);

    // 7. Update hutang_pembelian
    await supabase
      .from('hutang_pembelian')
      .update({
        total_hutang: finalTotal,
        dibayar: totalDibayar,
        sisa: sisaHutang,
        status: sisaHutang <= 0 ? 'Lunas' : 'Belum Lunas'
      })
      .eq('pembelian_id', pembelian_id);

    return NextResponse.json({
      message: 'Uang muka dan biaya kirim berhasil diupdate',
      uang_muka_lama,
      uang_muka_baru,
      biaya_kirim_baru,
      rekening_bayar,
      status_pembayaran,
      sisa_hutang: sisaHutang
    });
  } catch (error: any) {
    console.error('Error updating uang muka:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}