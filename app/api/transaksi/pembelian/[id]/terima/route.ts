// app/api/transaksi/pembelian/[id]/terima/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pembelian_id } = await context.params;
    const supabase = await supabaseAuthenticated();


    // ✅ Get pembelian data
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
    if (!pembelian) {
      return NextResponse.json(
        { error: 'Pembelian tidak ditemukan' },
        { status: 404 }
      );
    }


    // ✅ Validation: Must be billed first
    if (pembelian.status !== 'billed') {
      return NextResponse.json(
        { error: 'Pembelian harus di-billing terlebih dahulu' },
        { status: 400 }
      );
    }

    // ✅ Validation: Already received?
    if (pembelian.status_barang === 'Diterima') {
      return NextResponse.json({
        error: 'Barang sudah diterima sebelumnya'
      }, { status: 400 });
    }

    const detail_pembelian = pembelian.detail_pembelian || [];

    if (detail_pembelian.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada detail pembelian' },
        { status: 400 }
      );
    }

    const cabangId = pembelian.cabang_id || pembelian.cabang?.id;

    if (!cabangId) {
      return NextResponse.json(
        { error: 'Pembelian tidak memiliki cabang_id' },
        { status: 400 }
      );
    }

    // ✅ CRITICAL: Check if stock already recorded (prevent duplicate)
    const { data: stockCheck } = await supabase
      .from('stock_barang')
      .select('id')
      .eq('keterangan', `Pembelian #${pembelian_id}`)
      .limit(1);

    if (stockCheck && stockCheck.length > 0) {
      return NextResponse.json({
        error: 'Stock untuk pembelian ini sudah pernah dicatat'
      }, { status: 400 });
    }


    // ✅ Collect all stock updates first (validation phase)
    const stockUpdates: Array<{
      produk_id: number;
      nama_produk: string;
      current_stok: number;
      current_hpp: number;
      jumlah_masuk: number;
      hpp_beli: number;
      new_stok: number;
      new_hpp: number;
      new_harga: number;
    }> = [];

    for (const item of detail_pembelian) {
      if (!item) continue;

      const jumlahMasuk = parseFloat(item.jumlah?.toString() || '0');
      const hppBeli = parseFloat(item.harga?.toString() || '0');

      // Get current product data
      const { data: produkData, error: produkGetError } = await supabase
        .from('produk')
        .select('stok, hpp, harga, nama_produk')
        .eq('id', item.produk_id)
        .single();

      if (produkGetError || !produkData) {
        console.error(`❌ Error getting produk ${item.produk_id}:`, produkGetError);
        return NextResponse.json({
          error: `Produk ID ${item.produk_id} tidak ditemukan`
        }, { status: 404 });
      }

      const currentStok = parseFloat(produkData.stok?.toString() || '0');
      const currentHPP = parseFloat(produkData.hpp?.toString() || '0');
      const currentHarga = parseFloat(produkData.harga?.toString() || '0');

      // ✅ Calculate weighted average HPP
      let newHPP = hppBeli;
      if (currentStok > 0 && currentHPP > 0) {
        const totalValue = (currentStok * currentHPP) + (jumlahMasuk * hppBeli);
        const totalQty = currentStok + jumlahMasuk;
        newHPP = totalValue / totalQty;
      }

      const newStok = currentStok + jumlahMasuk;

      // ✅ Calculate new harga jual (keep existing markup if possible)
      let newHarga = newHPP;
      if (currentHarga > currentHPP && currentHPP > 0) {
        // Keep existing markup percentage
        const markupPercentage = (currentHarga - currentHPP) / currentHPP;
        newHarga = newHPP * (1 + markupPercentage);
      } else {
        // Use default 20% markup if no existing markup
        newHarga = newHPP * 1.2;
      }


      stockUpdates.push({
        produk_id: item.produk_id,
        nama_produk: produkData.nama_produk,
        current_stok: currentStok,
        current_hpp: currentHPP,
        jumlah_masuk: jumlahMasuk,
        hpp_beli: hppBeli,
        new_stok: newStok,
        new_hpp: newHPP,
        new_harga: newHarga
      });
    }


    // ✅ Update status AFTER validation, BEFORE stock updates
    const { error: updateStatusError } = await supabase
      .from('transaksi_pembelian')
      .update({
        status_barang: 'Diterima',
        tanggal_diterima: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(pembelian_id));

    if (updateStatusError) {
      console.error('Error updating status:', updateStatusError);
      throw updateStatusError;
    }


    // ✅ Apply all stock updates
    let successCount = 0;
    const errors: string[] = [];

    for (const update of stockUpdates) {
      try {
        // Insert to stock_barang (history)
        const { error: stockInsertError } = await supabase
          .from('stock_barang')
          .insert({
            produk_id: update.produk_id,
            pembelian_id: parseInt(pembelian_id),
            cabang_id: cabangId,
            jumlah: update.jumlah_masuk,
            tanggal: pembelian.tanggal,
            tipe: 'masuk',
            hpp: update.hpp_beli,
            harga_jual: update.new_harga,
            persentase: ((update.new_harga - update.new_hpp) / update.new_hpp) * 100,
            keterangan: `Pembelian #${pembelian_id}`
          });

        if (stockInsertError) {
          console.error(`❌ Error inserting stock_barang for ${update.nama_produk}:`, stockInsertError);
          errors.push(`Failed to record stock history for ${update.nama_produk}`);
          continue;
        }

        // Update produk stock
        const { error: produkUpdateError } = await supabase
          .from('produk')
          .update({
            stok: update.new_stok,
            hpp: update.new_hpp,
            harga: update.new_harga,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.produk_id);

        if (produkUpdateError) {
          console.error(`❌ Error updating produk ${update.nama_produk}:`, produkUpdateError);
          errors.push(`Failed to update stock for ${update.nama_produk}`);
          continue;
        }

        successCount++;
      } catch (itemError: any) {
        console.error(`❌ Error processing ${update.nama_produk}:`, itemError);
        errors.push(`Error processing ${update.nama_produk}: ${itemError.message}`);
      }
    }

    // ✅ Summary
    const totalItems = stockUpdates.length;
    const failedCount = errors.length;


    if (failedCount > 0) {
      console.error(`⚠️ ${failedCount} items failed:`, errors);
      
      // If all failed, rollback status
      if (successCount === 0) {
        await supabase
          .from('transaksi_pembelian')
          .update({
            status_barang: 'Belum Diterima',
            tanggal_diterima: null
          })
          .eq('id', parseInt(pembelian_id));
        
        return NextResponse.json({
          error: 'Semua item gagal diproses',
          errors: errors
        }, { status: 500 });
      }

      // Partial success
      return NextResponse.json({
        success: true,
        message: `${successCount}/${totalItems} items berhasil diproses`,
        warning: `${failedCount} items gagal`,
        errors: errors,
        details_count: totalItems,
        success_count: successCount,
        failed_count: failedCount
      });
    }

    // All success

    return NextResponse.json({
      success: true,
      message: 'Barang berhasil diterima & stock diperbarui dengan weighted average HPP',
      details_count: totalItems,
      success_count: successCount
    });

  } catch (error: any) {
    console.error('❌ Error processing terima barang:', error);
    
    // Attempt rollback
    try {
      const { id: pembelian_id } = await context.params;
      const supabase = await supabaseAuthenticated();
      
      await supabase
        .from('transaksi_pembelian')
        .update({
          status_barang: 'Belum Diterima',
          tanggal_diterima: null
        })
        .eq('id', parseInt(pembelian_id));
      
    } catch (rollbackError) {
      console.error('⚠️ Failed to rollback:', rollbackError);
    }

    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat terima barang' },
      { status: 500 }
    );
  }
}
