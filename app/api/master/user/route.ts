import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { databaseOperationWithRetry } from '@/lib/apiRetry';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching user:', error);
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
        .from('users')
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create User');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'User berhasil ditambahkan',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menambahkan user',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in user POST:', error);
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
        { error: 'ID user diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('users')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Update User');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'User berhasil diupdate',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal mengupdate user',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in user PUT:', error);
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
        { error: 'ID user diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();

      // Check if user has any active sessions or references
      // Note: This is a basic check - you might want to add more comprehensive validation

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }, 'Delete User');

    if (result.success) {
      return NextResponse.json({
        message: 'User berhasil dihapus',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menghapus user',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in user DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
