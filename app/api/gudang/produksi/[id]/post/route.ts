// app/api/transaksi/pembelian/[id]/billing/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pembelian_id } = await context.params;
    const body = await request.json();
    const supabase = await supabaseServer();

    console.log('🔄 Processing billing for pembelian:', pembelian_id);

    // ✅ FIX: Check if already billed (PREVENT DUPLICATE)
    const { data: checkData, error: checkError } = await supabase
      .from('transaksi_pembelian')
      .select('status')
      .eq('id', parseInt(pembelian_id))
      .single();

    if (checkError) throw checkError;

    if (checkData.status === 'billed') {
      console.log('⚠️ Pembelian already billed, skipping...');
      return NextResponse.json({
        error: 'Pembelian sudah di-billing sebelumnya'
      }, { status: 400 });
    }

    // Get pembelian with detail
    const { data: pembelian, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang
        ),
        detail_pembelian (
          id,
          produk_id,
          jumlah,
          harga,
          subtotal
        )
      `)
      .eq('id', parseInt(pembelian_id))
      .single();

    if (pembelianError) throw pembelianError;

    const uang_muka = Number(body.uang_muka || 0);
    const biaya_kirim = Number(body.biaya_kirim || 0);
    const rekening_bayar = body.rekening_bayar || null;

    // Calculate totals
    const detail_pembelian = pembelian.detail_pembelian || [];
    const subtotal = detail_pembelian.reduce(
      (sum: number, item: any) => sum + Number(item.subtotal || 0),
      0
    );
    const finalTotal = subtotal + biaya_kirim;

    // ✅ Update pembelian to 'billed' status FIRST (prevent race condition)
    const { error: updateError } = await supabase
      .from('transaksi_pembelian')
      .update({
        total: subtotal,
        biaya_kirim: biaya_kirim,
        uang_muka: uang_muka,
        rekening_bayar: rekening_bayar,
        status: 'billed',
        status_pembayaran: uang_muka >= finalTotal ? 'Lunas' : (uang_muka > 0 ? 'Cicil' : 'Belum Lunas'),
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(pembelian_id));

    if (updateError) throw updateError;

    console.log('✅ Pembelian status updated to billed');

    // ✅ CRITICAL: Check if stock already recorded
    const { data: stockCheck } = await supabase
      .from('stock_barang')
      .select('id')
      .eq('keterangan', `Pembelian #${pembelian_id}`)
      .limit(1);

    const stockAlreadyRecorded = stockCheck && stockCheck.length > 0;

    if (stockAlreadyRecorded) {
      console.log('⚠️ Stock already recorded for this pembelian, skipping stock insert');
    } else {
      // Insert stock movement
      if (detail_pembelian && detail_pembelian.length > 0) {
        const cabangId = pembelian.cabang_id || pembelian.cabang?.id;

        if (!cabangId) {
          console.warn('Warning: cabang_id tidak ditemukan, skip stock insert');
        } else {
          for (const item of detail_pembelian) {
            if (!item) continue;

            console.log(`  📦 Recording stock: Produk ${item.produk_id}, Qty: ${item.jumlah}`);

            // ✅ Get current stock
            const { data: produkData, error: produkGetError } = await supabase
              .from('produk')
              .select('stok, hpp')
              .eq('id', item.produk_id)
              .single();

            if (produkGetError) {
              console.error('Error getting produk:', produkGetError);
              continue;
            }

            const currentStok = Number(produkData?.stok || 0);
            const newStok = currentStok + Number(item.jumlah);

            // ✅ Update stock di tabel produk
            const { error: produkUpdateError } = await supabase
              .from('produk')
              .update({
                stok: newStok,
                hpp: Number(item.harga),
                harga: Number(item.harga),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.produk_id);

            if (produkUpdateError) {
              console.error('Error updating produk stock:', produkUpdateError);
              throw produkUpdateError;
            }

            console.log(`    ✅ Stock updated: ${currentStok} + ${item.jumlah} = ${newStok}`);

            // ✅ Insert ke stock_barang (ONLY ONCE!)
            const { error: stockInsertError } = await supabase
              .from('stock_barang')
              .insert({
                produk_id: item.produk_id,
                cabang_id: cabangId,
                jumlah: Number(item.jumlah),
                tanggal: pembelian.tanggal,
                tipe: 'masuk',
                hpp: Number(item.harga),
                keterangan: `Pembelian #${pembelian_id}`  // ← Unique identifier
              });

            if (stockInsertError) {
              console.error('Error inserting stock_barang:', stockInsertError);
              throw stockInsertError;
            }

            console.log(`    ✅ History recorded`);
          }
        }
      }
    }

    // Handle uang muka
    if (uang_muka > 0) {
      // ✅ Check if uang_muka already recorded
      const { data: cicilanCheck } = await supabase
        .from('cicilan_pembelian')
        .select('id')
        .eq('pembelian_id', parseInt(pembelian_id))
        .eq('type', 'uang_muka')
        .limit(1);

      const uangMukaAlreadyRecorded = cicilanCheck && cicilanCheck.length > 0;

      if (!uangMukaAlreadyRecorded) {
        // Insert cicilan
        const { error: cicilanError } = await supabase
          .from('cicilan_pembelian')
          .insert({
            pembelian_id: parseInt(pembelian_id),
            tanggal_cicilan: pembelian.tanggal,
            jumlah_cicilan: uang_muka,
            rekening: rekening_bayar,
            type: 'uang_muka',
            keterangan: 'Uang Muka Awal'
          });

        if (cicilanError) {
          console.error('Error inserting cicilan:', cicilanError);
          throw cicilanError;
        }

        // Update kas
        if (rekening_bayar) {
          const { data: kasData, error: kasGetError } = await supabase
            .from('kas')
            .select('*')
            .eq('nama_kas', rekening_bayar)
            .single();

          if (kasGetError) {
            console.error('Error getting kas:', kasGetError);
          } else if (kasData) {
            const kasSaldo = parseFloat(kasData.saldo.toString());
            const newSaldo = kasSaldo - uang_muka;

            // Update kas saldo
            const { error: kasUpdateError } = await supabase
              .from('kas')
              .update({
                saldo: newSaldo,
                updated_at: new Date().toISOString()
              })
              .eq('id', kasData.id);

            if (kasUpdateError) {
              console.error('Error updating kas:', kasUpdateError);
            } else {
              // Insert transaksi kas
              await supabase
                .from('transaksi_kas')
                .insert({
                  kas_id: kasData.id,
                  tanggal_transaksi: pembelian.tanggal,
                  debit: uang_muka,
                  kredit: 0,
                  keterangan: `Uang Muka Pembelian (Nota: ${pembelian.nota_supplier})`
                });

              console.log(`✅ Kas updated: ${kasSaldo} - ${uang_muka} = ${newSaldo}`);
            }
          }
        }
      } else {
        console.log('⚠️ Uang muka already recorded, skipping');
      }
    }

    // Create or update hutang_pembelian
    const totalHutang = finalTotal;
    const sisa = Math.max(0, totalHutang - uang_muka);

    const { data: existingHutang } = await supabase
      .from('hutang_pembelian')
      .select('*')
      .eq('pembelian_id', parseInt(pembelian_id))
      .limit(1);

    if (existingHutang && existingHutang.length > 0) {
      await supabase
        .from('hutang_pembelian')
        .update({
          total_hutang: totalHutang,
          dibayar: uang_muka,
          sisa: sisa,
          status: sisa <= 0 ? 'lunas' : 'belum_lunas',
          updated_at: new Date().toISOString()
        })
        .eq('pembelian_id', parseInt(pembelian_id));
    } else {
      await supabase
        .from('hutang_pembelian')
        .insert({
          pembelian_id: parseInt(pembelian_id),
          suplier_id: body.suplier_id || pembelian.suplier_id,
          total_hutang: totalHutang,
          dibayar: uang_muka,
          sisa: sisa,
          status: sisa <= 0 ? 'lunas' : 'belum_lunas'
        });
    }

    console.log('✅ Billing completed successfully!');

    // Return updated data
    const { data: updatedPembelian } = await supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        suplier:suplier_id (
          id,
          nama
        ),
        cabang:cabang_id (
          id,
          nama_cabang
        )
      `)
      .eq('id', parseInt(pembelian_id))
      .single();

    return NextResponse.json({
      success: true,
      message: 'Billing berhasil, stock masuk telah dicatat',
      pembelian: updatedPembelian,
      subtotal,
      finalTotal,
      uang_muka,
      biaya_kirim,
      tagihan: Math.max(0, finalTotal - uang_muka)
    });

  } catch (error: any) {
    console.error('❌ Error billing pembelian:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
