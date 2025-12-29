// app/api/master/supplier/route.ts
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { NextRequest, NextResponse } from 'next/server';

// GET - List all suplier with pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('suplier')
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `, { count: 'exact' })
      .order('nama', { ascending: true }); // ✅ Sort by nama (lebih user-friendly)

    // Search - include daerah_operasi
    if (search) {
      query = query.or(`
        nama.ilike.%${search}%,
        alamat.ilike.%${search}%,
        no_telp.ilike.%${search}%,
        email.ilike.%${search}%,
        daerah_operasi.ilike.%${search}%
      `);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true, // ✅ Tambahkan success flag
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching suplier:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// POST - Create new suplier
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // ✅ Validasi input
    if (!body.nama || !body.cabang_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Nama suplier dan cabang harus diisi' 
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('suplier')
      .insert(body)
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `) // ✅ Return dengan relasi cabang
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      data, 
      message: 'Suplier berhasil ditambahkan' 
    });
  } catch (error: any) {
    console.error('Error creating suplier:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// PUT - Update suplier
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'ID supplier diperlukan' 
        },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // ✅ Validasi input
    if (!body.nama || !body.cabang_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Nama suplier dan cabang harus diisi' 
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('suplier')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Supplier berhasil diupdate'
    });
  } catch (error: any) {
    console.error('Error updating suplier:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete suplier
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'ID supplier diperlukan' 
        },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    // ✅ Check if supplier is still referenced
    const { data: references } = await supabase
      .from('transaksi_pembelian')
      .select('id')
      .eq('suplier_id', id)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Supplier tidak dapat dihapus karena masih memiliki transaksi pembelian' 
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('suplier')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Supplier berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error deleting suplier:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}
