import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * GET - Get stock data for specific product + branch combination
 * Alternative to nested dynamic routes to avoid Next.js conflicts
 * URL: /api/persediaan/stock-barang/stock-lookup?produk_id=XXX&cabang_id=XXX
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);

    const produkId = searchParams.get('produk_id');
    const cabangId = searchParams.get('cabang_id');

    // Validate required parameters
    if (!produkId || !cabangId) {
      return NextResponse.json(
        { success: false, error: 'produk_id and cabang_id are required query parameters' },
        { status: 400 }
      );
    }

    const produkIdNum = parseInt(produkId);
    const cabangIdNum = parseInt(cabangId);

    // Validate numeric values
    if (isNaN(produkIdNum) || isNaN(cabangIdNum)) {
      return NextResponse.json(
        { success: false, error: 'produk_id and cabang_id must be valid numbers' },
        { status: 400 }
      );
    }

    // Get product data
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('*')
      .eq('id', produkIdNum)
      .single();

    if (produkError || !produk) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validate required product fields
    if (!produk.satuan) {
      console.error(`⚠️ Produk ${produkIdNum} tidak memiliki satuan`);
      return NextResponse.json(
        { success: false, error: 'Produk tidak memiliki satuan yang valid' },
        { status: 400 }
      );
    }

    // Calculate margin
    const hpp = parseFloat(produk.hpp?.toString() || '0');
    const harga_jual = parseFloat(produk.harga?.toString() || '0');
    const margin = hpp > 0 ? ((harga_jual - hpp) / hpp) * 100 : 0;

    // Get stock history summary for this branch
    const { data: histories, error: historyError } = await supabase
      .from('stock_barang')
      .select('jumlah, tipe')
      .eq('produk_id', produkIdNum)
      .eq('cabang_id', cabangIdNum);

    // Handle critical error in stock history query
    if (historyError) {
      console.error('Error fetching stock history:', historyError);
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil data riwayat stock' },
        { status: 500 }
      );
    }

    // Calculate stock movements with validation
    let masuk = 0;
    let keluar = 0;
    let invalidRecords = 0;
    
    // Valid tipe enum values from database (tipe_stock enum)
    const validTipes = ['masuk', 'keluar', 'adjustment', 'opname'];
    
    if (histories && Array.isArray(histories)) {
      histories.forEach(h => {
        const jumlah = parseFloat(h.jumlah?.toString() || '0');
        
        // Validate stock type against enum
        if (!h.tipe || !validTipes.includes(h.tipe)) {
          invalidRecords++;
          console.error(`❌ Invalid tipe enum in stock_barang: produk=${produkIdNum}, cabang=${cabangIdNum}, tipe="${h.tipe}"`);
          return; // Skip this record
        }
        
        // Calculate based on type
        // 'masuk', 'adjustment', 'opname' can add stock
        // 'keluar' reduces stock
        if (h.tipe === 'masuk' || h.tipe === 'adjustment' || h.tipe === 'opname') {
          // For adjustment and opname, jumlah can be negative (reducing stock)
          masuk += jumlah;
        } else if (h.tipe === 'keluar') {
          keluar += Math.abs(jumlah); // Ensure positive for keluar
        }
      });
    }
    
    // Log if invalid records found
    if (invalidRecords > 0) {
      console.warn(`⚠️ Found ${invalidRecords} invalid stock records for produk ${produkIdNum}, cabang ${cabangIdNum}`);
    }

    // Get branch name
    const { data: cabang, error: cabangError } = await supabase
      .from('cabang')
      .select('nama_cabang')
      .eq('id', cabangIdNum)
      .single();

    // Handle error in branch query - this is critical for display
    if (cabangError) {
      console.error('Error fetching branch:', cabangError);
      return NextResponse.json(
        { success: false, error: 'Cabang tidak ditemukan' },
        { status: 404 }
      );
    }

    // Calculate current stock for this branch
    const stock = masuk - keluar;
    
    // CRITICAL: Prevent negative stock (per database constraint for produk.stok)
    if (stock < 0) {
      console.error(`❌ NEGATIVE STOCK DETECTED: Produk ${produkIdNum}, Cabang ${cabangIdNum}, Stock: ${stock} (Masuk: ${masuk}, Keluar: ${keluar})`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Data stock tidak valid: stock negatif terdeteksi. Silakan lakukan stock opname.',
          debug: {
            stock_masuk: masuk,
            stock_keluar: keluar,
            selisih: stock
          }
        },
        { status: 400 }
      );
    }

    const data = {
      produk_id: produkIdNum,
      nama_produk: produk.nama_produk || '',
      kode_produk: produk.kode_produk || '',
      satuan: produk.satuan, // Required field, validated above
      cabang_id: cabangIdNum,
      cabang: cabang?.nama_cabang || 'Unknown',
      // Stock data (branch-specific)
      stock: parseFloat(stock.toFixed(2)), // Round to 2 decimals for consistency
      stock_masuk: parseFloat(masuk.toFixed(2)),
      stock_keluar: parseFloat(keluar.toFixed(2)),
      // Price data (product-level)
      hpp: hpp,
      harga_jual: harga_jual,
      margin: parseFloat(margin.toFixed(2)),
    };

    return NextResponse.json({
      success: true,
      data: data,
    });

  } catch (error: any) {
    console.error('❌ Error getting stock data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
