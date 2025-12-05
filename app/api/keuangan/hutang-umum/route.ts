'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch all hutang with pagination & search
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('hutang_umum')
      .select(`
        *,
        kas:kas_id (id, nama_kas)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Search filter
    if (search) {
      query = query.or(`pihak.ilike.%${search}%,jenis_hutang.ilike.%${search}%,keterangan.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching hutang:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new hutang
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const body = await request.json();

    const {
      jenis_hutang,
      tanggal_transaksi,
      pihak,
      keterangan,
      nominal_total,
      kas_id,
    } = body;

    // Validasi input
    if (!jenis_hutang || !tanggal_transaksi || !pihak || !nominal_total || !kas_id) {
      return NextResponse.json(
        { error: 'Field wajib tidak lengkap' },
        { status: 400 }
      );
    }

    // Insert hutang baru
    const { data: hutang, error: hutangError } = await supabase
      .from('hutang_umum')
      .insert({
        jenis_hutang,
        tanggal_transaksi,
        pihak,
        keterangan: keterangan || null,
        nominal_total: Number(nominal_total),
        dibayar: 0,
        sisa: Number(nominal_total),
        status: 'Belum Lunas',
        kas_id: Number(kas_id),
      })
      .select()
      .single();

    if (hutangError) throw hutangError;

    // Insert transaksi kas (debit = uang keluar)
    const { error: kasError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: Number(kas_id),
        tanggal_transaksi,
        debit: Number(nominal_total),
        kredit: 0,
        keterangan: `Hutang baru - ${pihak}`,
      });

    if (kasError) throw kasError;

    return NextResponse.json({
      message: 'Hutang berhasil ditambahkan',
      data: hutang,
    });
  } catch (error: any) {
    console.error('Error creating hutang:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
