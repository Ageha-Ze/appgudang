import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cabangId: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { cabangId } = await context.params; // AWAIT params


    // Step 1: Cari produk yang ada di stock_barang untuk cabang ini
    const { data: stockData, error: stockError } = await supabase
      .from('stock_barang')
      .select('produk_id')
      .eq('cabang_id', parseInt(cabangId))
      .gt('jumlah', 0);

    if (stockError) {
      console.error('Error fetching stock data for cabang:', stockError);
      throw stockError;
    }

    // Jika tidak ada produk di cabang ini
    if (!stockData || stockData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Extract produk IDs
    const produkIds = [...new Set(stockData.map(item => item.produk_id))];

    // Step 2: Calculate actual available stock for each product in this cabang

    const bahan = [];
    for (const produkId of produkIds) {
      // Calculate current stock by summing all stock_barang transactions for this product in this cabang
      const { data: stockTransactions, error: stockError } = await supabase
        .from('stock_barang')
        .select('jumlah, tipe')
        .eq('produk_id', produkId)
        .eq('cabang_id', parseInt(cabangId));

      if (stockError) {
        console.error('Error getting stock transactions for produk:', produkId, stockError);
        continue;
      }

      // Calculate current stock: masuk + , keluar -
      let currentStock = 0;
      stockTransactions?.forEach((transaction: any) => {
        const amount = parseFloat(transaction.jumlah?.toString() || '0');
        if (transaction.tipe === 'masuk') {
          currentStock += amount;
        } else if (transaction.tipe === 'keluar') {
          currentStock -= amount;
        }
      });


      // Only include products with positive stock
      if (currentStock > 0) {
        // Get product details from master produk table
        const { data: produkData, error: produkError } = await supabase
          .from('produk')
          .select('id, nama_produk, kode_produk, satuan, hpp')
          .eq('id', produkId)
          .single();

        if (produkError || !produkData) {
          console.warn('Produk not found in master table:', produkId);
          continue;
        }

        bahan.push({
          produk_id: produkData.id,
          nama_produk: produkData.nama_produk,
          stok: currentStock, // ✅ REAL CABANG STOCK, not master stock
          satuan: produkData.satuan || 'pcs',
          hpp: produkData.hpp || 0
        });
      }
    }


    return NextResponse.json({ data: bahan });
  } catch (error: any) {
    console.error('Error fetching bahan by cabang:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
