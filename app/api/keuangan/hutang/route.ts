'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search')?.trim() || '';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('hutang_pembelian')
      .select(
        `
        id,
        total_hutang,
        dibayar,
        sisa,
        status,
        jatuh_tempo,
        suplier:suplier_id ( nama ),
        transaksi_pembelian:pembelian_id (
          cabang:cabang_id (
            nama_cabang
          )
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Search: status, suplier, cabang
    if (search) {
      query = query.or(
        `
          status.ilike.%${search}%,
          suplier.nama.ilike.%${search}%,
          transaksi_pembelian.cabang.nama_cabang.ilike.%${search}%
        `
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data: hutangData, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: hutangData ?? [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching hutang pembelian:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
