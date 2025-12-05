// app/api/master/pegawai/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const jabatan = searchParams.get('jabatan') || '';
    const cabangId = searchParams.get('cabang_id') || '';

    let query = supabase
      .from('pegawai')
      .select(`
        id,
        nama,
        jabatan,
        no_telp,
        level_jabatan,
        daerah_operasi,
        cabang_id,
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `)
      .order('nama', { ascending: true });

    if (search) {
      query = query.or(`
        nama.ilike.%${search}%,
        jabatan.ilike.%${search}%
      `);
    }

    if (jabatan) {
      query = query.ilike('jabatan', `%${jabatan}%`);
    }

    if (cabangId) {
      query = query.eq('cabang_id', parseInt(cabangId));
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      message: 'Success'
    });
  } catch (error: any) {
    console.error('Error fetching pegawai:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
