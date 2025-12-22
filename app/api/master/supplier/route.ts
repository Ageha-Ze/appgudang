import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { databaseOperationWithRetry } from '@/lib/apiRetry';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('suplier')
      .select('*')
      .order('nama', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`nama.ilike.%${search}%,telepon.ilike.%${search}%,alamat.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
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
        .from('suplier')
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create Supplier');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Supplier berhasil ditambahkan',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menambahkan supplier',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in supplier POST:', error);
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
        { error: 'ID supplier diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('suplier')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Update Supplier');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Supplier berhasil diupdate',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal mengupdate supplier',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in supplier PUT:', error);
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
        { error: 'ID supplier diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();

      // Check if supplier is still referenced in other tables
      const { data: references } = await supabase
        .from('transaksi_pembelian')
        .select('id')
        .eq('suplier_id', id)
        .limit(1);

      if (references && references.length > 0) {
        throw new Error('Supplier tidak dapat dihapus karena masih memiliki transaksi pembelian');
      }

      const { error } = await supabase
        .from('suplier')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }, 'Delete Supplier');

    if (result.success) {
      return NextResponse.json({
        message: 'Supplier berhasil dihapus',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menghapus supplier',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in supplier DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
