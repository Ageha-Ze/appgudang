import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { databaseOperationWithRetry } from '@/lib/apiRetry';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('pegawai')
      .select('*')
      .order('nama', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`nama.ilike.%${search}%,jabatan.ilike.%${search}%,telepon.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching pegawai:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('pegawai')
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create Pegawai');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Pegawai berhasil ditambahkan',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menambahkan pegawai',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in pegawai POST:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID pegawai diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('pegawai')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Update Pegawai');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Pegawai berhasil diupdate',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal mengupdate pegawai',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in pegawai PUT:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID pegawai diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();

      // Check if pegawai is still referenced in other tables
      const { data: references } = await supabase
        .from('transaksi_penjualan')
        .select('id')
        .eq('pegawai_id', id)
        .limit(1);

      if (references && references.length > 0) {
        throw new Error('Pegawai tidak dapat dihapus karena masih memiliki transaksi penjualan');
      }

      const { error } = await supabase
        .from('pegawai')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }, 'Delete Pegawai');

    if (result.success) {
      return NextResponse.json({
        message: 'Pegawai berhasil dihapus',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menghapus pegawai',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in pegawai DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
