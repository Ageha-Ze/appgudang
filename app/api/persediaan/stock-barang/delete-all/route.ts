// app/api/persediaan/stock-barang/delete-all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * POST - Delete ALL stock records for a product
 * This will:
 * 1. Delete all stock_barang records
 * 2. Set produk.stok = 0
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const { produk_id, cabang_id } = body;


    if (!produk_id) {
      return NextResponse.json(
        { success: false, error: 'produk_id wajib diisi' },
        { status: 400 }
      );
    }

    // Get produk info
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('nama_produk, stok')
      .eq('id', produk_id)
      .single();

    if (produkError) throw produkError;
    if (!produk) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    // Build delete query
    let deleteQuery = supabase
      .from('stock_barang')
      .delete()
      .eq('produk_id', produk_id);

    if (cabang_id && cabang_id > 0) {
      deleteQuery = deleteQuery.eq('cabang_id', cabang_id);
    }

    const { error: deleteError, count } = await deleteQuery;

    if (deleteError) throw deleteError;

    // Set produk.stok = 0
    const { error: updateError } = await supabase
      .from('produk')
      .update({ stok: 0 })
      .eq('id', produk_id);

    if (updateError) throw updateError;


    return NextResponse.json({
      success: true,
      message: `Stock berhasil dihapus!\n\nProduk: ${produk.nama_produk}\nRecord dihapus: ${count || 0}\nStock direset ke: 0`,
      data: {
        produk_id,
        deleted_count: count || 0,
        old_stock: produk.stok,
        new_stock: 0,
      },
    });
  } catch (error: any) {
    console.error('❌ Error deleting stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
