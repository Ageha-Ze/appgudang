"use server";

// app/api/persediaan/stock-barang/adjust/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * POST - Adjust stock to a specific value
 * This will calculate the difference and create appropriate stock_barang record
 * ✅ CRITICAL FIX: Added audit trail for all manual stock adjustments
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const {
      produk_id,
      cabang_id,
      jumlah_baru, // New stock value
      hpp,
      harga_jual,
      persentase_harga_jual,
      keterangan,
      user_info, // Who is making this adjustment
    } = body;

    console.log('🔧 Adjusting stock:', { produk_id, cabang_id, jumlah_baru });

    // Get current stock
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('stok, nama_produk, satuan, hpp')
      .eq('id', produk_id)
      .single();

    if (produkError) throw produkError;
    if (!produk) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    // ✅ FIX: Calculate current stock using branch transactions (same as overview)
    // Don't use master produk.stok - use calculated stock per branch
    const { data: stockTransactions } = await supabase
      .from('stock_barang')
      .select('jumlah, tipe')
      .eq('produk_id', produk_id)
      .eq('cabang_id', cabang_id);

    let currentStock = 0;
    stockTransactions?.forEach(transaction => {
      const amount = parseFloat(transaction.jumlah?.toString() || '0');
      if (transaction.tipe === 'masuk') {
        currentStock += amount;
      } else if (transaction.tipe === 'keluar') {
        currentStock -= amount;
      }
    });

    const newStock = parseFloat(jumlah_baru);
    const selisih = newStock - currentStock;

    console.log(`🔧 ADJUSTMENT CALCULATION:`);
    console.log(`   Produk: ${produk.nama_produk} (${produk_id})`);
    console.log(`   Cabang: ${cabang_id}`);
    console.log(`   Current stock in database: ${produk.stok} (type: ${typeof produk.stok})`);
    console.log(`   Parsed currentStock: ${currentStock}`);
    console.log(`   User requested target: ${jumlah_baru} (type: ${typeof jumlah_baru})`);
    console.log(`   Parsed newStock: ${newStock}`);
    console.log(`   Calculated difference (newStock - currentStock): ${selisih}`);
    console.log(`   Transaction type: ${selisih > 0 ? 'MASUK' : 'KELUAR'} ${Math.abs(selisih)}`);

    // Additional safety check
    if (isNaN(currentStock) || isNaN(newStock)) {
      throw new Error(`Invalid stock values: currentStock=${currentStock}, newStock=${newStock}`);
    }

    console.log(`  📊 Stock adjustment: ${currentStock} → ${newStock} (selisih: ${selisih})`);

    // If no difference, no need to adjust
    if (Math.abs(selisih) < 0.001) {
      return NextResponse.json({
        success: true,
        message: 'Stock sudah sesuai, tidak ada perubahan',
        data: {
          produk: produk.nama_produk,
          stock_sebelum: currentStock,
          stock_sesudah: currentStock,
          selisih: 0,
        },
      });
    }

    // ✅ Step 1: Update produk.stok
    const { error: updateError } = await supabase
      .from('produk')
      .update({ stok: newStock })
      .eq('id', produk_id);

    if (updateError) {
      console.error('❌ Failed to update produk.stok:', updateError);
      throw updateError;
    }

    console.log('✅ Stock updated in produk table');

    // ✅ Step 2: Insert adjustment history
    const tipe = selisih > 0 ? 'masuk' : 'keluar';
    const jumlahAbs = Math.abs(selisih);

    // Generate unique identifier for this adjustment
    const adjustmentId = `adj_${produk_id}_${cabang_id}_${Date.now()}`;

    const { data: stockData, error: insertError } = await supabase
      .from('stock_barang')
      .insert({
        produk_id,
        cabang_id,
        jumlah: jumlahAbs,
        tanggal: new Date().toISOString().split('T')[0],
        tipe,
        keterangan: keterangan || `Penyesuaian stock manual (${selisih > 0 ? '+' : ''}${selisih.toFixed(2)}) - ID: ${adjustmentId}`,
        hpp: hpp || produk.hpp || 0,
        harga_jual: harga_jual || 0,
        persentase: persentase_harga_jual || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('⚠️ Warning: Failed to record history, rolling back stock...');
      
      // ✅ Rollback produk.stok if insert history fails
      await supabase
        .from('produk')
        .update({ stok: currentStock })
        .eq('id', produk_id);
      
      throw insertError;
    }

    console.log('✅ Adjustment history recorded successfully');

    return NextResponse.json({
      success: true,
      message: `Stock berhasil disesuaikan!`,
      data: stockData,
      detail: {
        produk: produk.nama_produk,
        stock_sebelum: `${currentStock.toFixed(2)} ${produk.satuan || 'unit'}`,
        stock_sesudah: `${newStock.toFixed(2)} ${produk.satuan || 'unit'}`,
        selisih: `${selisih > 0 ? '+' : ''}${selisih.toFixed(2)} ${produk.satuan || 'unit'}`,
        tipe: tipe,
      },
    });
  } catch (error: any) {
    console.error('❌ Error adjusting stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
