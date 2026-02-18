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
    const pembelianId = parseInt(id);

    if (isNaN(pembelianId)) {
      return NextResponse.json(
        { error: 'Invalid pembelian ID' },
        { status: 400 }
      );
    }

    // Get pembelian data with jenis_pembayaran = 'hutang'
    const { data: pembelianData, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        id,
        tanggal,
        total,
        uang_muka,
        biaya_kirim,
        jenis_pembayaran,
        jatuh_tempo,
        status_pembayaran,
        suplier:suplier_id (
          id,
          nama
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        ),
        detail_pembelian (
          id,
          subtotal
        )
      `)
      .eq('id', pembelianId)
      .eq('jenis_pembayaran', 'hutang')
      .single();

    if (pembelianError) {
      console.error('Error fetching pembelian hutang:', pembelianError);
      return NextResponse.json(
        { error: 'Hutang not found' },
        { status: 404 }
      );
    }

    // Calculate real payments from cicilan_pembelian
    const { data: cicilanData, error: cicilanError } = await supabase
      .from('cicilan_pembelian')
      .select('id, tanggal_cicilan, jumlah_cicilan, keterangan, kas_id')
      .eq('pembelian_id', pembelianId)
      .order('tanggal_cicilan', { ascending: false });

    if (cicilanError) {
      console.error('Error fetching cicilan:', cicilanError);
    }

    // Calculate real totals
    const biayaKirim = parseFloat(pembelianData.biaya_kirim?.toString() || '0');
    const realTotal = parseFloat(pembelianData.total?.toString() || '0') + biayaKirim;
    const dibayar = (cicilanData || []).reduce((sum, c) =>
      sum + parseFloat(c.jumlah_cicilan?.toString() || '0'), 0
    );
    const sisa = realTotal - dibayar;

    // Determine status
    let status = 'belum_lunas';
    if (sisa <= 0) {
      status = 'lunas';
    }

    // Transform payment data to match the expected format
    const pembayaranFormatted = (cicilanData || []).map(c => ({
      id: c.id,
      tanggal: c.tanggal_cicilan ? new Date(c.tanggal_cicilan).toISOString().split('T')[0] : '',
      jumlah: parseFloat(c.jumlah_cicilan?.toString() || '0'),
      keterangan: c.keterangan || '',
      kas: `Kas ${c.kas_id}` // Simplified kas reference
    }));

    // Transform to hutang format
    const hutangResult = {
      id: pembelianData.id,
      total_hutang: realTotal,
      dibayar: dibayar,
      sisa: sisa,
      status: status,
      jatuh_tempo: pembelianData.jatuh_tempo,
      suplier: Array.isArray(pembelianData.suplier) ? pembelianData.suplier[0] : pembelianData.suplier,
      pembayaran: pembayaranFormatted,
      transaksi_pembelian: {
        id: pembelianData.id,
        cabang: Array.isArray(pembelianData.cabang) ? pembelianData.cabang[0] : pembelianData.cabang
      }
    };

    return NextResponse.json(hutangResult, { status: 200 });

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

    // Update jatuh_tempo in transaksi_pembelian table
    const { data, error } = await supabase
      .from('transaksi_pembelian')
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
