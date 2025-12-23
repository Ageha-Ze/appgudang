import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - List semua produk
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('produk')
      .select('*')
      .order('nama_produk', { ascending: true });

    if (search) {
      query = query.or(`nama_produk.ilike.%${search}%,kode_produk.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching produk:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
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