// app/api/gudang/produksi/[id]/post/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await supabaseServer();
    const produksiId = parseInt(id);

    console.log('🔄 Posting produksi ID:', produksiId);

    // ✅ Step 1: Get produksi with details
    const { data: produksiData, error: getProduksiError } = await supabase
      .from('transaksi_produksi')
      .select(`
        *,
        detail_produksi (
          id,
          item_id,
          jumlah,
          hpp,
          subtotal
        )
      `)
      .eq('id', produksiId)
      .single();

    if (getProduksiError) throw getProduksiError;
    if (!produksiData) throw new Error('Produksi tidak ditemukan');

    console.log('📦 Data produksi:', produksiData);

    // Check if already posted
    if (produksiData.status === 'posted') {
      return NextResponse.json({
        error: 'Produksi sudah diposting sebelumnya'
      }, { status: 400 });
    }

    const details = produksiData.detail_produksi || [];

    if (details.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada detail produksi, tambahkan bahan baku terlebih dahulu'
      }, { status: 400 });
    }

    // ✅ Step 2: Validasi stock SEMUA bahan baku DULU
    console.log('🔍 Validating stock for', details.length, 'items...');
    
    for (const detail of details) {
      if (!detail.item_id) continue;

              const { data: item, error: itemError } = await supabase
        .from('produk')
        .select('id, nama_produk, stok')
        .eq('id', detail.item_id)
        .single();

      if (itemError || !item) {
        throw new Error(`❌ Item ID ${detail.item_id} tidak ditemukan atau sudah dihapus`);
      }

      const currentStok = parseFloat(item.stok?.toString() || '0');
      const needed = parseFloat(detail.jumlah?.toString() || '0');

      console.log(`  - ${item.nama_produk}: stock=${currentStok}, needed=${needed}`);

      if (currentStok < needed) {
        throw new Error(
          `❌ Stock ${item.nama_produk} tidak mencukupi!\n` +
          `Tersedia: ${currentStok} | Dibutuhkan: ${needed}`
        );
      }
    }

    console.log('✅ Stock validation passed');

    // ✅ Step 3: Update status to 'posted'
    const { error: updateStatusError } = await supabase
      .from('transaksi_produksi')
      .update({ 
        status: 'posted',
        updated_at: new Date().toISOString()
      })
      .eq('id', produksiId);

    if (updateStatusError) throw updateStatusError;

    console.log('✅ Status updated to posted');

    // ✅ Step 4: Proses pengurangan bahan baku
    for (const detail of details) {
      if (!detail.item_id) continue;

      // Get current stock
      const { data: item, error: getItemError } = await supabase
        .from('produk')
        .select('stok, nama_produk')
        .eq('id', detail.item_id)
        .single();

      if (getItemError) throw getItemError;

      const currentStok = parseFloat(item.stok?.toString() || '0');
      const jumlahKeluar = parseFloat(detail.jumlah?.toString() || '0');
      const newStok = currentStok - jumlahKeluar;

      console.log(`  📉 ${item.nama_produk}: ${currentStok} - ${jumlahKeluar} = ${newStok}`);

      // Update stock bahan baku
      const { error: updateStokError } = await supabase
        .from('produk')
        .update({ 
          stok: newStok,
          updated_at: new Date().toISOString()
        })
        .eq('id', detail.item_id);

      if (updateStokError) {
        console.error('❌ Failed to update stock for item:', detail.item_id);
        throw updateStokError;
      }

      // ✅ PENTING: Insert history SEKALI SAJA (keluar)
      const { error: historyError } = await supabase
        .from('stock_barang')
        .insert({
          produk_id: detail.item_id,
          cabang_id: produksiData.cabang_id,
          jumlah: jumlahKeluar,
          tanggal: produksiData.tanggal,
          tipe: 'keluar',
          keterangan: `Produksi ID: ${id} (Bahan Baku)`,
          hpp: parseFloat(detail.hpp?.toString() || '0')
        });

      if (historyError) {
        console.error('⚠️ Warning: Failed to record history (keluar):', historyError);
        // Don't throw, continue process
      }
    }

    console.log('✅ All materials deducted successfully');

    // ✅ Step 5: Tambah stock hasil produksi
    const { data: produkHasil, error: getProdukHasilError } = await supabase
      .from('produk')
      .select('id, nama_produk, stok')
      .eq('id', produksiData.produk_id)
      .single();

    if (getProdukHasilError) throw getProdukHasilError;

    if (produkHasil) {
      const currentStokHasil = parseFloat(produkHasil.stok?.toString() || '0');
      const jumlahMasuk = parseFloat(produksiData.jumlah?.toString() || '0');
      const newStokHasil = currentStokHasil + jumlahMasuk;

      console.log(`  📈 ${produkHasil.nama_produk}: ${currentStokHasil} + ${jumlahMasuk} = ${newStokHasil}`);

      // Update stock hasil
      const { error: updateHasilError } = await supabase
        .from('produk')
        .update({ 
          stok: newStokHasil,
          updated_at: new Date().toISOString()
        })
        .eq('id', produksiData.produk_id);

      if (updateHasilError) throw updateHasilError;

      // Hitung HPP per unit
      const totalHPP = details.reduce(
        (sum, d) => sum + parseFloat(d.subtotal?.toString() || '0'),
        0
      );
      const hppPerUnit = jumlahMasuk > 0 ? totalHPP / jumlahMasuk : 0;

      console.log(`  💰 HPP: Total=${totalHPP} / Qty=${jumlahMasuk} = ${hppPerUnit} per unit`);

      // ✅ PENTING: Insert history SEKALI SAJA (masuk)
      const { error: historyMasukError } = await supabase
        .from('stock_barang')
        .insert({
          produk_id: produksiData.produk_id,
          cabang_id: produksiData.cabang_id,
          jumlah: jumlahMasuk,
          tanggal: produksiData.tanggal,
          tipe: 'masuk',
          keterangan: `Hasil Produksi ID: ${id}`,
          hpp: hppPerUnit
        });

      if (historyMasukError) {
        console.error('⚠️ Warning: Failed to record history (masuk):', historyMasukError);
        // Don't throw, continue process
      }

      // Update HPP produk hasil
      const { error: updateHPPError } = await supabase
        .from('produk')
        .update({ 
          hpp: hppPerUnit,
          harga: hppPerUnit,
          updated_at: new Date().toISOString()
        })
        .eq('id', produksiData.produk_id);

      if (updateHPPError) {
        console.error('⚠️ Warning: Failed to update HPP:', updateHPPError);
        // Don't throw, process is still successful
      }

      console.log('✅ Production posted successfully!');
    }

    return NextResponse.json({
      success: true,
      message: 'Produksi berhasil diposting dan stock telah diupdate',
      data: {
        produksi_id: produksiId,
        status: 'posted',
        bahan_digunakan: details.length,
        hasil_produksi: produksiData.jumlah + ' ' + produksiData.satuan
      }
    });

  } catch (error: any) {
    console.error('❌ Error posting production:', error);
    
    // Attempt rollback status if possible
    try {
      const { id } = await params;
      const supabase = await supabaseServer();
      
      await supabase
        .from('transaksi_produksi')
        .update({ status: 'pending' })
        .eq('id', parseInt(id));
      
      console.log('🔄 Status rolled back to pending');
    } catch (rollbackError) {
      console.error('⚠️ Failed to rollback status:', rollbackError);
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Terjadi kesalahan saat posting produksi'
    }, { status: 500 });
  }
}
