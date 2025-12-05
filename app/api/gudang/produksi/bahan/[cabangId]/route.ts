import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cabangId: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { cabangId } = await context.params; // AWAIT params

    console.log('Fetching bahan for cabang:', cabangId);

    // Query bahan (raw materials) yang tersedia di cabang tertentu
    // Bahan adalah produk yang sudah dibeli dan diterima, ada di stock_barang
    const { data, error } = await supabase
      .from('stock_barang')
      .select(`
        produk_id,
        jumlah,
        produk:produk_id (
          id,
          nama_produk,
          kode_produk,
          satuan,
          hpp
        )
      `)
      .eq('cabang_id', parseInt(cabangId))
      .gt('jumlah', 0) // Hanya yang ada stocknya
      .order('produk_id');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Raw stock_barang result:', data);

    // Deduplicate by produk_id to avoid React key conflicts
    const uniqueProducts = new Map();
    data?.forEach((item: any) => {
      if (item.produk_id && !uniqueProducts.has(item.produk_id)) {
        uniqueProducts.set(item.produk_id, {
          produk_id: item.produk_id,
          nama_produk: item.produk?.nama_produk || '-',
          stok: item.jumlah,
          satuan: item.produk?.satuan || 'pcs',
          terakhir_dibeli: null, // Remove this field since it doesn't exist
          hpp: item.produk?.hpp || 0
        });
      }
    });

    const bahan = Array.from(uniqueProducts.values());

    console.log('Transformed bahan data:', bahan);

    return NextResponse.json({ data: bahan });
  } catch (error: any) {
    console.error('Error fetching bahan by cabang:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
