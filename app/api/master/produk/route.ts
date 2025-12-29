import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - List semua produk dengan real-time stock
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '1000');

    let query = supabase
      .from('produk')
      .select('*')
      .order('nama_produk', { ascending: true });

    if (search) {
      query = query.or(`nama_produk.ilike.%${search}%,kode_produk.ilike.%${search}%`);
    }

    const { data: produkList, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching produk:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    // ✅ Calculate real-time stock from stock_barang table
    
    const produkWithRealStock = await Promise.all(
      (produkList || []).map(async (produk) => {
        try {
          // Get stock movements from stock_barang table
          const { data: stockBarang, error: stockError } = await supabase
            .from('stock_barang')
            .select('jumlah, tipe, tanggal')
            .eq('produk_id', produk.id)
            .order('tanggal', { ascending: true });

          if (stockError) {
            console.error(`❌ Error fetching stock for ${produk.nama_produk}:`, stockError);
            // Fallback to DB stock if fetch fails
            return {
              ...produk,
              stok: parseFloat(produk.stok?.toString() || '0')
            };
          }

          // Calculate real stock: masuk (+) and keluar (-)
          let stokAkhir = 0;
          
          if (stockBarang && stockBarang.length > 0) {
            const total_masuk = stockBarang
              .filter(m => m.tipe === 'masuk')
              .reduce((sum, m) => sum + parseFloat(m.jumlah.toString()), 0);

            const total_keluar = stockBarang
              .filter(m => m.tipe === 'keluar')
              .reduce((sum, m) => sum + parseFloat(m.jumlah.toString()), 0);

            stokAkhir = total_masuk - total_keluar;

          } else {
            // No stock movements, use DB stock as fallback
            stokAkhir = parseFloat(produk.stok?.toString() || '0');
          }

          return {
            ...produk,
            stok: stokAkhir, // ✅ Real-time calculated stock
            stok_db: parseFloat(produk.stok?.toString() || '0') // Keep original for debugging
          };
        } catch (err) {
          console.error(`❌ Error calculating stock for ${produk.nama_produk}:`, err);
          return {
            ...produk,
            stok: parseFloat(produk.stok?.toString() || '0')
          };
        }
      })
    );


    return NextResponse.json({
      success: true,
      data: produkWithRealStock
    });
  } catch (error: any) {
    console.error('Error in produk GET:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// POST - Tambah produk baru
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // Generate kode_produk jika tidak ada
    let kodeProduk = body.kode_produk;
    if (!kodeProduk) {
      const prefix = body.nama_produk
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 3)
        .padEnd(3, 'X');
      const timestamp = Date.now().toString().slice(-4);
      kodeProduk = `${prefix}${timestamp}`;
    }

    const { data, error } = await supabase
      .from('produk')
      .insert({
        kode_produk: kodeProduk,
        nama_produk: body.nama_produk,
        harga: body.harga || 0,
        hpp: body.hpp || null,
        stok: body.stok || 0,
        satuan: body.satuan,
        is_jerigen: body.is_jerigen || false,
        density_kg_per_liter: body.density_kg_per_liter || 1.0,
        allow_manual_conversion: body.allow_manual_conversion || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating produk:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Produk berhasil ditambahkan'
    });
  } catch (error: any) {
    console.error('Error in produk POST:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// PUT - Update produk
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID produk diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const { data, error } = await supabase
      .from('produk')
      .update({
        nama_produk: body.nama_produk,
        harga: body.harga || 0,
        hpp: body.hpp || null,
        stok: body.stok || 0,
        satuan: body.satuan,
        is_jerigen: body.is_jerigen || false,
        density_kg_per_liter: body.density_kg_per_liter || 1.0,
        allow_manual_conversion: body.allow_manual_conversion || false,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating produk:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Produk berhasil diupdate'
    });
  } catch (error: any) {
    console.error('Error in produk PUT:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// DELETE - Hapus produk
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID produk diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    // Check if produk is still referenced
    const { data: detailPembelian } = await supabase
      .from('detail_pembelian')
      .select('id')
      .eq('produk_id', id)
      .limit(1);

    const { data: detailPenjualan } = await supabase
      .from('detail_penjualan')
      .select('id')
      .eq('produk_id', id)
      .limit(1);

    if (detailPembelian && detailPembelian.length > 0) {
      return NextResponse.json(
        { 
          error: 'Produk tidak dapat dihapus karena sudah digunakan dalam transaksi pembelian',
          success: false 
        },
        { status: 400 }
      );
    }

    if (detailPenjualan && detailPenjualan.length > 0) {
      return NextResponse.json(
        { 
          error: 'Produk tidak dapat dihapus karena sudah digunakan dalam transaksi penjualan',
          success: false 
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('produk')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting produk:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error in produk DELETE:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
