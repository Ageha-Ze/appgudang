import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// Definisi UserLevel sesuai dengan enum di database
type UserLevel = 'super_admin' | 'admin' | 'keuangan' | 'kasir' | 'gudang' | 'sales';

// Fungsi validasi level
function isValidUserLevel(level: string): level is UserLevel {
  return ['super_admin', 'admin', 'keuangan', 'kasir', 'gudang', 'sales'].includes(level);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`username.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
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
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // Validasi input
    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi', success: false },
        { status: 400 }
      );
    }

    // Validasi level
    if (!isValidUserLevel(body.level)) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilih salah satu: super_admin, admin, keuangan, kasir, gudang, sales`, success: false },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('users')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'User berhasil ditambahkan'
    });
  } catch (error: any) {
    console.error('Error in user POST:', error);
    return NextResponse.json(
      { error: error.message, success: false },
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
        { error: 'ID user diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // Validasi input
    if (!body.username) {
      return NextResponse.json(
        { error: 'Username harus diisi', success: false },
        { status: 400 }
      );
    }

    // Validasi level
    if (!isValidUserLevel(body.level)) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilih salah satu: super_admin, admin, keuangan, kasir, gudang, sales`, success: false },
        { status: 400 }
      );
    }

    const updateData: any = {
      username: body.username,
      level: body.level,
    };

    if (body.password) {
      updateData.password = body.password;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'User berhasil diupdate'
    });
  } catch (error: any) {
    console.error('Error in user PUT:', error);
    return NextResponse.json(
      { error: error.message, success: false },
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
        { error: 'ID user diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    // Optional: Check if user is being used in other tables
    // Add your business logic here if needed

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error in user DELETE:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
