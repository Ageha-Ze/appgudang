// app/api/persediaan/stock-barang/fix-negative/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * POST - Fix negative stock by recalculating from movements
 * This endpoint will:
 * 1. Recalculate stock for all products from stock_barang movements
 * 2. Update produk.stok to match calculated value
 * 3. Report any discrepancies
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { produk_id } = body; // Optional: fix specific product only


    // Get all movements
    let movementsQuery = supabase
      .from('stock_barang')
      .select(`
        id,
        produk_id,
        jumlah,
        tipe,
        tanggal,
        produk:produk_id (
          id,
          nama_produk,
          stok
        )
      `)
      .order('produk_id', { ascending: true })
      .order('tanggal', { ascending: true });

    if (produk_id) {
      movementsQuery = movementsQuery.eq('produk_id', produk_id);
    }

    const { data: movements, error: movementsError } = await movementsQuery;

    if (movementsError) throw movementsError;

    // Group by produk_id and calculate correct stock
    const stockByProduk = new Map<number, any>();

    movements?.forEach((item: any) => {
      if (!stockByProduk.has(item.produk_id)) {
        stockByProduk.set(item.produk_id, {
          produk_id: item.produk_id,
          nama_produk: item.produk?.nama_produk || '-',
          calculated_stock: 0,
          current_stock_in_db: parseFloat(item.produk?.stok?.toString() || '0'),
          masuk: 0,
          keluar: 0,
          movements_count: 0,
        });
      }

      const produkData = stockByProduk.get(item.produk_id);
      const jumlah = parseFloat(item.jumlah.toString());

      if (item.tipe === 'masuk') {
        produkData.calculated_stock += jumlah;
        produkData.masuk += jumlah;
      } else if (item.tipe === 'keluar') {
        produkData.calculated_stock -= jumlah;
        produkData.keluar += jumlah;
      }

      produkData.movements_count++;
    });

    // Check for discrepancies and fix
    const fixed = [];
    const errors = [];

    for (const [produkId, data] of stockByProduk.entries()) {
      const difference = Math.abs(data.calculated_stock - data.current_stock_in_db);

      if (difference > 0.01) { // Threshold for floating point comparison

        // Update stock in produk table
        const { error: updateError } = await supabase
          .from('produk')
          .update({ stok: data.calculated_stock })
          .eq('id', produkId);

        if (updateError) {
          console.error(`❌ Failed to update ${data.nama_produk}:`, updateError);
          errors.push({
            produk_id: produkId,
            nama_produk: data.nama_produk,
            error: updateError.message,
          });
        } else {
          fixed.push({
            produk_id: produkId,
            nama_produk: data.nama_produk,
            old_stock: data.current_stock_in_db,
            new_stock: data.calculated_stock,
            difference: data.calculated_stock - data.current_stock_in_db,
            masuk: data.masuk,
            keluar: data.keluar,
          });
        }
      }
    }

    // Summary
    const summary = {
      total_products_checked: stockByProduk.size,
      total_fixed: fixed.length,
      total_errors: errors.length,
      negative_stocks_found: Array.from(stockByProduk.values()).filter(
        p => p.calculated_stock < 0
      ).length,
    };


    return NextResponse.json({
      success: true,
      message: `Stock fix completed: ${fixed.length} products updated`,
      summary,
      fixed,
      errors,
      negative_stocks: Array.from(stockByProduk.values())
        .filter(p => p.calculated_stock < 0)
        .map(p => ({
          produk_id: p.produk_id,
          nama_produk: p.nama_produk,
          stock: p.calculated_stock,
          masuk: p.masuk,
          keluar: p.keluar,
        })),
    });
  } catch (error: any) {
    console.error('❌ Error fixing stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Check for negative stocks without fixing
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();

    // Get all movements
    const { data: movements, error: movementsError } = await supabase
      .from('stock_barang')
      .select(`
        produk_id,
        jumlah,
        tipe,
        produk:produk_id (
          nama_produk,
          kode_produk,
          stok
        )
      `)
      .order('produk_id', { ascending: true });

    if (movementsError) throw movementsError;

    // Calculate stock per product
    const stockByProduk = new Map<number, any>();

    movements?.forEach((item: any) => {
      if (!stockByProduk.has(item.produk_id)) {
        stockByProduk.set(item.produk_id, {
          produk_id: item.produk_id,
          nama_produk: item.produk?.nama_produk || '-',
          kode_produk: item.produk?.kode_produk || '-',
          calculated_stock: 0,
          db_stock: parseFloat(item.produk?.stok?.toString() || '0'),
          masuk: 0,
          keluar: 0,
        });
      }

      const produkData = stockByProduk.get(item.produk_id);
      const jumlah = parseFloat(item.jumlah.toString());

      if (item.tipe === 'masuk') {
        produkData.calculated_stock += jumlah;
        produkData.masuk += jumlah;
      } else if (item.tipe === 'keluar') {
        produkData.calculated_stock -= jumlah;
        produkData.keluar += jumlah;
      }
    });

    // Find negative and discrepancies
    const negativeStocks = [];
    const discrepancies = [];

    for (const [produkId, data] of stockByProduk.entries()) {
      if (data.calculated_stock < 0) {
        negativeStocks.push(data);
      }

      const difference = Math.abs(data.calculated_stock - data.db_stock);
      if (difference > 0.01) {
        discrepancies.push({
          ...data,
          difference: data.calculated_stock - data.db_stock,
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_products: stockByProduk.size,
        negative_stocks: negativeStocks.length,
        discrepancies: discrepancies.length,
      },
      negative_stocks: negativeStocks,
      discrepancies: discrepancies,
    });
  } catch (error: any) {
    console.error('❌ Error checking stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
