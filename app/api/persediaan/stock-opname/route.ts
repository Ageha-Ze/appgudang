// app/api/persediaan/stock-opname/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Fetch all stock opname records
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('stock_opname')
      .select(`
        id,
        tanggal,
        produk:produk_id (
          id,
          nama_produk,
          kode_produk,
          stok
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        ),
        jumlah_sistem,
        jumlah_fisik,
        selisih,
        status,
        keterangan,
        created_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Filter by search (client-side karena nested relation)
    let filteredData = data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(item => {
        const produk = item.produk as any;
        const cabang = item.cabang as any;
        
        return (
          produk?.nama_produk?.toLowerCase().includes(searchLower) ||
          produk?.kode_produk?.toLowerCase().includes(searchLower) ||
          cabang?.nama_cabang?.toLowerCase().includes(searchLower) ||
          cabang?.kode_cabang?.toLowerCase().includes(searchLower) ||
          item.status?.toLowerCase().includes(searchLower) ||
          item.keterangan?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Calculate pagination based on filtered data
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const paginatedData = filteredData.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock opname:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new stock opname record
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();


    // Get current stock from produk table
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('stok, nama_produk')
      .eq('id', body.produk_id)
      .single();

    if (produkError) throw produkError;
    if (!produk) {
      return NextResponse.json(
        { error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    const jumlahSistem = parseFloat(produk.stok.toString());
    const jumlahFisik = parseFloat(body.jumlah_fisik);
    const selisih = jumlahFisik - jumlahSistem;

    // Insert stock opname record
    const { data: opname, error: insertError } = await supabase
      .from('stock_opname')
      .insert({
        tanggal: body.tanggal || new Date().toISOString().split('T')[0],
        produk_id: body.produk_id,
        cabang_id: body.cabang_id,
        jumlah_sistem: jumlahSistem,
        jumlah_fisik: jumlahFisik,
        selisih: selisih,
        status: 'pending',
        keterangan: body.keterangan || '',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: `Stock opname berhasil dicatat. Selisih: ${selisih > 0 ? '+' : ''}${selisih.toFixed(2)} kg`,
      data: opname,
    });

  } catch (error: any) {
    console.error('Error creating stock opname:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
