'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;
    const hutangId = parseInt(id);

    if (isNaN(hutangId)) {
      return NextResponse.json(
        { error: 'Invalid hutang ID' },
        { status: 400 }
      );
    }

    // Get hutang data with related information
    const { data: hutangData, error: hutangError } = await supabase
      .from('hutang_pembelian')
      .select(`
        id,
        pembelian_id,
        total_hutang,
        dibayar,
        sisa,
        status,
        jatuh_tempo,
        suplier:suplier_id (
          id,
          nama
        )
      `)
      .eq('id', hutangId)
      .single();

    if (hutangError) {
      console.error('Error fetching hutang:', hutangError);
      return NextResponse.json(
        { error: 'Hutang not found' },
        { status: 404 }
      );
    }

    // Get cabang information and jatuh_tempo from transaksi_pembelian
    const { data: transaksiData, error: transaksiError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        id,
        tanggal,
        jatuh_tempo,
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `)
      .eq('id', (hutangData as any).pembelian_id)
      .single();

    if (transaksiError) {
      console.error('Error fetching transaksi:', transaksiError);
    }

    // Get payment history (cicilan_pembelian)
    const { data: pembayaranData, error: pembayaranError } = await supabase
      .from('cicilan_pembelian')
      .select('id, tanggal_cicilan, jumlah_cicilan, keterangan, kas_id')
      .eq('pembelian_id', (hutangData as any).pembelian_id)
      .order('tanggal_cicilan', { ascending: false });

    if (pembayaranError) {
      console.error('Error fetching pembayaran:', pembayaranError);
    }

    // Transform payment data to match the expected format
    const pembayaranFormatted = (pembayaranData || []).map(p => ({
      id: p.id,
      tanggal: p.tanggal_cicilan ? new Date(p.tanggal_cicilan).toISOString().split('T')[0] : '',
      jumlah: parseFloat(p.jumlah_cicilan?.toString() || '0'),
      keterangan: p.keterangan || '',
      kas: `Kas ${p.kas_id}` // Simplified kas reference
    }));

    // Merge jatuh_tempo: use transaction table jatuh_tempo, fallback to hutang table
    const mergedHutangData = {
      ...hutangData,
      jatuh_tempo: transaksiData?.jatuh_tempo || hutangData.jatuh_tempo
    };

    // Return combined data
    const result = {
      ...mergedHutangData,
      pembayaran: pembayaranFormatted,
      transaksi_pembelian: transaksiData ? {
        id: transaksiData.id,
        cabang: transaksiData.cabang
      } : null
    };

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error('Error in hutang detail API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PUT endpoint to update jatuh tempo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;
    const hutangId = parseInt(id);

    if (isNaN(hutangId)) {
      return NextResponse.json(
        { error: 'Invalid hutang ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { jatuh_tempo } = body;

    if (!jatuh_tempo) {
      return NextResponse.json(
        { error: 'Tanggal jatuh tempo wajib diisi' },
        { status: 400 }
      );
    }

    // Update jatuh_tempo in hutang_pembelian table
    const { data, error } = await supabase
      .from('hutang_pembelian')
      .update({ jatuh_tempo })
      .eq('id', hutangId)
      .select()
      .single();

    if (error) {
      console.error('Error updating jatuh tempo:', error);
      return NextResponse.json(
        { error: 'Gagal mengupdate jatuh tempo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Jatuh tempo berhasil diupdate',
      data
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in hutang update API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
