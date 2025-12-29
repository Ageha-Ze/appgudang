import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ cabangId: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { cabangId } = await context.params;


    // Query produk yang ada stock di cabang tertentu
    const { data, error } = await supabase
      .from('stock_barang')
      .select(`
        produk_id,
        produk:produk_id (
          id,
          nama_produk,
          kode_produk,
          satuan,
          stok,
          is_jerigen
        )
      `)
      .eq('cabang_id', parseInt(cabangId))
      .gt('jumlah', 0) // Hanya yang ada stocknya
      .order('produk_id');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }


    // Transform data untuk hapus duplikasi produk
    const uniqueProducts = new Map();
    data?.forEach((item: any) => {
      if (item.produk && !uniqueProducts.has(item.produk.id)) {
        uniqueProducts.set(item.produk.id, item.produk);
      }
    });

    const products = Array.from(uniqueProducts.values());

    return NextResponse.json({ data: products });
  } catch (error: any) {
    console.error('Error fetching produk by cabang:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
