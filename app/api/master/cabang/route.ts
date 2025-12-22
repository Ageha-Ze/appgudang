import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { databaseOperationWithRetry } from '@/lib/apiRetry';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('cabang')
      .select('*')
      .order('nama_cabang', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`nama_cabang.ilike.%${search}%,kode_cabang.ilike.%${search}%,alamat.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching cabang:', error);
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
        .from('cabang')
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create Cabang');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Cabang berhasil ditambahkan',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menambahkan cabang',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in cabang POST:', error);
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
        { error: 'ID cabang diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('cabang')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Update Cabang');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Cabang berhasil diupdate',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal mengupdate cabang',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in cabang PUT:', error);
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
        { error: 'ID cabang diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();

      // Check if cabang is still referenced in other tables
      const tablesToCheck = ['kas', 'transaksi_pembelian', 'transaksi_penjualan'];
      for (const table of tablesToCheck) {
        const { data: references } = await supabase
          .from(table)
          .select('id')
          .eq('cabang_id', id)
          .limit(1);

        if (references && references.length > 0) {
          throw new Error(`Cabang tidak dapat dihapus karena masih digunakan di tabel ${table}`);
        }
      }

      const { error } = await supabase
        .from('cabang')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }, 'Delete Cabang');

    if (result.success) {
      return NextResponse.json({
        message: 'Cabang berhasil dihapus',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menghapus cabang',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in cabang DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
