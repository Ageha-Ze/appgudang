// app/api/transaksi/pembelian/[id]/items/[itemId]/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// PUT - Update detail pembelian
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id, itemId } = await context.params;
    const body = await request.json();

    // Update detail pembelian
    const { data: detailData, error: detailError } = await supabase
      .from('detail_pembelian')
      .update({
        produk_id: body.produk_id,
        jumlah: body.jumlah,
        jumlah_box: body.jumlah_box || 0,
        harga: body.harga,
        subtotal: body.subtotal,
      })
      .eq('id', itemId)
      .select()
      .single();

    if (detailError) throw detailError;

    // Hitung ulang total pembelian
    const { data: allDetails } = await supabase
      .from('detail_pembelian')
      .select('jumlah, harga')
      .eq('pembelian_id', id);

    const newTotal = allDetails?.reduce(
      (sum, d) => sum + (d.jumlah * d.harga),
      0
    ) || 0;

    // Update total di transaksi_pembelian
    await supabase
      .from('transaksi_pembelian')
      .update({ total: newTotal })
      .eq('id', id);

    // Return updated pembelian row to client
    let updatedPembelian = null;
    try {
      const { data: tp } = await supabase
        .from('transaksi_pembelian')
        .select('*, suplier(id, nama), cabang(id, nama_cabang, kode_cabang), detail_pembelian(id, jumlah, harga, subtotal)')
        .eq('id', id)
        .single();

      updatedPembelian = tp;
    } catch (e) {
      // ignore
    }

    return NextResponse.json({
      data: detailData,
      pembelian: updatedPembelian,
      message: 'Data berhasil diupdate',
    });
  } catch (error: any) {
    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
