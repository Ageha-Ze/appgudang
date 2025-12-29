import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Fetch all pegawai with relations
export async function GET(request: NextRequest) {
  try {

    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type');


    // Handle different GET types
    if (type === 'cabang') {

      const { data, error } = await supabase
        .from('cabang')
        .select('id, kode_cabang, nama_cabang')
        .order('kode_cabang', { ascending: true });

      if (error) {
        console.error('[API Pegawai GET] Cabang error:', error);
        return NextResponse.json(
          { success: false, data: [], error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: data || [] });
    }

    if (type === 'users') {

      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .order('username', { ascending: true });

      if (error) {
        console.error('[API Pegawai GET] Users error:', error);
        return NextResponse.json(
          { success: false, data: [], error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: data || [] });
    }

    // Default: Get pegawai with relations

    // First, try with relations
    let query = supabase
      .from('pegawai')
      .select(`
        *,
        cabang:cabang_id (
          id,
          kode_cabang,
          nama_cabang
        ),
        user:user_id (
          id,
          username
        )
      `)
      .order('id', { ascending: true });

    // Filter by cabang if provided
    const cabangId = searchParams.get('cabang_id');
    if (cabangId) {
      query = query.eq('cabang_id', parseInt(cabangId));
    }

    // Filter by search if provided
    if (search) {
      query = query.or(`nama.ilike.%${search}%,jabatan.ilike.%${search}%,no_telp.ilike.%${search}%,nomor_ktp.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API Pegawai GET] Pegawai error:', error);

      // Fallback: Try without relations if error
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('pegawai')
        .select('*')
        .order('id', { ascending: true });

      if (fallbackError) {
        console.error('[API Pegawai GET] Fallback also failed:', fallbackError);
        return NextResponse.json(
          { success: false, data: [], error: fallbackError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: fallbackData || [],
        warning: 'Loaded without relations due to error'
      });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('[API Pegawai GET] Unexpected error:', error);
    return NextResponse.json(
      { success: false, data: [], error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new pegawai
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const supabase = await supabaseAuthenticated();

    const { data, error } = await supabase
      .from('pegawai')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('[API Pegawai POST] Insert error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          message: 'Gagal menambahkan pegawai'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Pegawai berhasil ditambahkan'
    });
  } catch (error: any) {
    console.error('[API Pegawai POST] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update pegawai
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID pegawai diperlukan' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const supabase = await supabaseAuthenticated();

    const { data, error } = await supabase
      .from('pegawai')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API Pegawai PUT] Update error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          message: 'Gagal mengupdate pegawai'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Pegawai berhasil diupdate'
    });
  } catch (error: any) {
    console.error('[API Pegawai PUT] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        message: 'Terjadi kesalahan saat mengupdate pegawai'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete pegawai
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID pegawai diperlukan' },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    // Check if pegawai is still referenced in other tables
    const { data: references, error: refError } = await supabase
      .from('transaksi_penjualan')
      .select('id')
      .eq('pegawai_id', id)
      .limit(1);

    if (refError) {
      console.error('[API Pegawai DELETE] Error checking references:', refError);
      // Continue with delete anyway if table doesn't exist
    }

    if (references && references.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pegawai tidak dapat dihapus karena masih memiliki transaksi penjualan',
          message: 'Pegawai tidak dapat dihapus karena masih memiliki transaksi penjualan'
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('pegawai')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API Pegawai DELETE] Delete error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          message: 'Gagal menghapus pegawai'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pegawai berhasil dihapus'
    });
  } catch (error: any) {
    console.error('[API Pegawai DELETE] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        message: 'Terjadi kesalahan saat menghapus pegawai'
      },
      { status: 500 }
    );
  }
}
