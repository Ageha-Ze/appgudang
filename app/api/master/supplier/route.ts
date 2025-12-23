import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('suplier')
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang
        )
      `)
      .order('id', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`nama.ilike.%${search}%,no_telp.ilike.%${search}%,alamat.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
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
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // Validasi input
    if (!body.nama || !body.cabang_id) {
      return NextResponse.json(
        { error: 'Nama suplier dan cabang harus diisi' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('suplier')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: data,
      message: 'Supplier berhasil ditambahkan'
    });
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

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // Validasi input
    if (!body.nama || !body.cabang_id) {
      return NextResponse.json(
        { error: 'Nama suplier dan cabang harus diisi' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('suplier')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: data,
      message: 'Supplier berhasil diupdate'
    });
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

    const supabase = await supabaseAuthenticated();

    // Check if supplier is still referenced in other tables
    const { data: references } = await supabase
      .from('pembelian')
      .select('id')
      .eq('suplier_id', id)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { error: 'Supplier tidak dapat dihapus karena masih memiliki transaksi pembelian' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('suplier')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      message: 'Supplier berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error in supplier DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
