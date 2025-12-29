'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { item_id, jumlah, hpp, subtotal } = body;

    if (!item_id || !jumlah || !hpp || !subtotal) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 });
    }

    // Fix: Await params and destructure id
    const { id } = await params;

    const { data, error } = await supabase
      .from('detail_produksi')
      .insert({
        produksi_id: parseInt(id),  // Use the awaited id
        item_id: parseInt(item_id),
        jumlah: parseFloat(jumlah),
        hpp: parseFloat(hpp),
        subtotal: parseFloat(subtotal),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error adding detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const detailId = searchParams.get('detailId');

    if (!detailId) {
      return NextResponse.json({ error: 'detailId required' }, { status: 400 });
    }

    // Fix: Await params (even if not used, for consistency and to avoid type issues)
    const { id } = await params;

    // Step 1: Get detail info for stock reversal
    const { data: detail, error: getError } = await supabase
      .from('detail_produksi')
      .select('item_id, jumlah')
      .eq('id', parseInt(detailId))
      .single();

    if (getError || !detail) {
      throw new Error('Detail item not found');
    }

    // Step 2: Return material stock (+jumlah)
    const { error: stockError } = await supabase
      .from('produk')
      .update({
        stok: (stok: any) => Number(stok) + parseFloat(detail.jumlah?.toString() || '0'),
        updated_at: new Date().toISOString()
      })
      .eq('id', detail.item_id);

    if (stockError) {
      console.error('Failed to restore stock for detail deletion:', stockError);
      throw stockError;
    }

    // Step 3: Delete the detail record
    const { error } = await supabase
      .from('detail_produksi')
      .delete()
      .eq('id', parseInt(detailId));

    if (error) throw error;


    return NextResponse.json({
      success: true,
      message: 'Detail item deleted and stock restored'
    });
  } catch (error: any) {
    console.error('Error deleting detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
