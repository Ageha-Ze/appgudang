// app/api/transaksi/pembelian/[id]/items/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// POST - Tambah item ke pembelian
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id: pembelian_id } = await context.params;
    const body = await request.json();


    // Validasi ID
    if (!pembelian_id || pembelian_id === 'undefined') {
      return NextResponse.json(
        { error: 'ID pembelian tidak valid' },
        { status: 400 }
      );
    }

    // ✅ DUPLICATE VALIDATION: Cek apakah produk sudah ada di pembelian ini
    const { data: existingItem, error: checkError } = await supabase
      .from('detail_pembelian')
      .select('id, produk_id')
      .eq('pembelian_id', pembelian_id)
      .eq('produk_id', body.produk_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking duplicate item:', checkError);
      return NextResponse.json(
        { error: 'Error checking duplicate item' },
        { status: 500 }
      );
    }

    if (existingItem) {
      // Get product name for better error message
      const { data: produk } = await supabase
        .from('produk')
        .select('nama_produk')
        .eq('id', body.produk_id)
        .single();

      return NextResponse.json({
        error: `Produk ${produk?.nama_produk || 'dengan ID ' + body.produk_id} sudah ada dalam pembelian ini. Silakan edit jumlahnya atau hapus item yang sudah ada terlebih dahulu.`,
        errorCode: 'DUPLICATE_PRODUCT',
        existingItemId: existingItem.id
      }, { status: 409 }); // 409 Conflict for duplicates
    }

    // Hitung subtotal
    const subtotal = parseFloat(body.jumlah) * parseFloat(body.harga);

    // Insert detail pembelian
    const detailData = {
      pembelian_id: parseInt(pembelian_id),
      produk_id: body.produk_id,
      jumlah: parseFloat(body.jumlah),
      jumlah_box: parseInt(body.jumlah_box) || 0,
      harga: parseFloat(body.harga),
      subtotal: subtotal
    };

    const { data: detail, error: detailError } = await supabase
      .from('detail_pembelian')
      .insert(detailData)
      .select()
      .single();

    if (detailError) {
      console.error('Error inserting detail:', detailError);
      throw detailError;
    }

    // ✅ Fetch produk terpisah untuk memastikan data lengkap
    const { data: produk } = await supabase
      .from('produk')
      .select('id, nama_produk, kode_produk, satuan, is_jerigen')
      .eq('id', body.produk_id)
      .single();

    // Gabungkan detail dengan produk
    const detailWithProduk = {
      ...detail,
      produk
    };

    // Update total pembelian
    const { data: allDetails } = await supabase
      .from('detail_pembelian')
      .select('subtotal')
      .eq('pembelian_id', pembelian_id);

    const total = allDetails?.reduce((sum, item) => sum + parseFloat(item.subtotal.toString()), 0) || 0;

    const { error: updateError } = await supabase
      .from('transaksi_pembelian')
      .update({ total })
      .eq('id', pembelian_id);

    if (updateError) {
      console.error('Error updating total:', updateError);
      throw updateError;
    }


    return NextResponse.json({ 
      data: detailWithProduk,
      message: 'Data berhasil disimpan' 
    });
  } catch (error: any) {
    console.error('Error in POST items:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Hapus item dari pembelian
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId');
    const pembelianId = searchParams.get('pembelianId');


    // Validasi parameters
    if (!itemId || !pembelianId) {
      return NextResponse.json(
        { error: 'Missing itemId or pembelianId' },
        { status: 400 }
      );
    }

    if (pembelianId === 'undefined' || itemId === 'undefined') {
      return NextResponse.json(
        { error: 'Invalid itemId or pembelianId' },
        { status: 400 }
      );
    }

    // Delete detail
    const { error: deleteError } = await supabase
      .from('detail_pembelian')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error('Error deleting detail:', deleteError);
      throw deleteError;
    }

    // Update total pembelian
    const { data: allDetails } = await supabase
      .from('detail_pembelian')
      .select('subtotal')
      .eq('pembelian_id', pembelianId);

    const total = allDetails?.reduce((sum, item) => sum + parseFloat(item.subtotal.toString()), 0) || 0;

    const { error: updateError } = await supabase
      .from('transaksi_pembelian')
      .update({ total })
      .eq('id', pembelianId);

    if (updateError) {
      console.error('Error updating total:', updateError);
      throw updateError;
    }


    return NextResponse.json({ 
      message: 'Item berhasil dihapus' 
    });
  } catch (error: any) {
    console.error('Error in DELETE items:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
