// app/api/transaksi/penjualan/[id]/items/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// POST - Tambah item ke penjualan
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id: penjualan_id } = await context.params;
    const body = await request.json();


    // ✅ Validasi: Cek apakah penjualan sudah dikonfirmasi
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select('status, status_diterima')
      .eq('id', penjualan_id)
      .single();

    if (penjualanError) throw penjualanError;

    // Tidak bisa tambah item jika sudah dikonfirmasi
    if (penjualan.status_diterima === 'Diterima') {
      return NextResponse.json({
        error: 'Tidak bisa menambah item pada penjualan yang sudah dikonfirmasi'
      }, { status: 400 });
    }

    // ✅ DUPLICATE VALIDATION: Cek apakah produk sudah ada di penjualan ini
    const { data: existingItem, error: checkError } = await supabase
      .from('detail_penjualan')
      .select('id, produk_id')
      .eq('penjualan_id', penjualan_id)
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
        error: `Produk ${produk?.nama_produk || 'dengan ID ' + body.produk_id} sudah ada dalam penjualan ini. Silakan edit jumlahnya atau hapus item yang sudah ada terlebih dahulu.`,
        errorCode: 'DUPLICATE_PRODUCT',
        existingItemId: existingItem.id
      }, { status: 409 }); // 409 Conflict for duplicates
    }

    // ✅ Validasi: Cek stock availability (info saja, tidak dikurangi)
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('stok, nama_produk')
      .eq('id', body.produk_id)
      .single();

    if (produkError) throw produkError;

    const stokTersedia = parseFloat(produk.stok?.toString() || '0');
    const jumlahDiminta = parseFloat(body.jumlah?.toString() || '0');

    if (stokTersedia < jumlahDiminta) {
      return NextResponse.json({
        error: `Stock ${produk.nama_produk} tidak mencukupi! Tersedia: ${stokTersedia}, Diminta: ${jumlahDiminta}`
      }, { status: 400 });
    }


    // ✅ Insert detail penjualan (TANPA mengurangi stock)
    const detailData = {
      penjualan_id: parseInt(penjualan_id),
      produk_id: body.produk_id,
      jumlah: jumlahDiminta,
      harga: parseFloat(body.harga?.toString() || '0'),
      subtotal: jumlahDiminta * parseFloat(body.harga?.toString() || '0')
    };

    const { data: detail, error: detailError } = await supabase
      .from('detail_penjualan')
      .insert(detailData)
      .select(`
        *,
        produk:produk_id (id, nama_produk, kode_produk, satuan)
      `)
      .single();

    if (detailError) throw detailError;


    // ✅ Update total penjualan
    const { data: allDetails } = await supabase
      .from('detail_penjualan')
      .select('subtotal')
      .eq('penjualan_id', penjualan_id);

    const total = allDetails?.reduce(
      (sum, item) => sum + parseFloat(item.subtotal?.toString() || '0'), 
      0
    ) || 0;

    const { error: updateTotalError } = await supabase
      .from('transaksi_penjualan')
      .update({ total })
      .eq('id', penjualan_id);

    if (updateTotalError) throw updateTotalError;


    // ❌ TIDAK ADA PENGURANGAN STOCK DI SINI!
    // Stock akan dikurangi saat konfirmasi "Diterima" di route konfirmasi/route.ts

    return NextResponse.json({ 
      success: true,
      data: detail, 
      message: 'Item berhasil ditambahkan. Stock akan dikurangi saat konfirmasi penerimaan.',
      stock_info: {
        product: produk.nama_produk,
        available: stokTersedia,
        reserved: jumlahDiminta,
        remaining: stokTersedia - jumlahDiminta
      }
    });
  } catch (error: any) {
    console.error('❌ Error adding item:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ✅ PUT - Update item di penjualan
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id: penjualan_id } = await context.params;
    const body = await request.json();


    // Validasi: Cek apakah penjualan sudah dikonfirmasi
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select('status, status_diterima')
      .eq('id', penjualan_id)
      .single();

    if (penjualanError) throw penjualanError;

    // Tidak bisa edit item jika sudah dikonfirmasi
    if (penjualan.status_diterima === 'Diterima') {
      return NextResponse.json({
        error: 'Tidak bisa mengedit item pada penjualan yang sudah dikonfirmasi'
      }, { status: 400 });
    }

    // Get item data sebelum update
    const { data: oldItem, error: getItemError } = await supabase
      .from('detail_penjualan')
      .select('produk_id, jumlah, harga, subtotal')
      .eq('id', body.itemId)
      .single();

    if (getItemError) throw getItemError;

    // Validasi: Cek stock availability
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('stok, nama_produk')
      .eq('id', oldItem.produk_id)
      .single();

    if (produkError) throw produkError;

    // ✅ SIMPLIFIED VALIDATION (Works with Global Stock System)
    const { data: produkData, error: produkFetchError } = await supabase
      .from('produk')
      .select('stok, nama_produk, satuan')
      .eq('id', oldItem.produk_id)
      .single();

    if (produkFetchError) throw produkFetchError;

    const globalStock = parseFloat(produkData.stok?.toString() || '0');
    const jumlahLama = parseFloat(oldItem.jumlah?.toString() || '0');
    const jumlahBaru = parseFloat(body.jumlah?.toString() || '0');
    const additionalNeeded = jumlahBaru - jumlahLama;


    // Get total pending reservations for this product (ALL cabang)
    const { data: allPendingReservations } = await supabase
      .from('detail_penjualan')
      .select(`
        jumlah,
        penjualan:penjualan_id!inner(
          id,
          status_diterima
        )
      `)
      .eq('produk_id', oldItem.produk_id)
      .eq('penjualan.status_diterima', 'Belum Diterima')
      .neq('penjualan_id', penjualan_id); // Exclude current sale

    const totalReservedByOthers = allPendingReservations
      ?.reduce((sum: number, item: any) => sum + parseFloat(item.jumlah?.toString() || '0'), 0) || 0;

    const availableStock = globalStock - totalReservedByOthers;


    // Validation: If increasing quantity, check availability
    if (additionalNeeded > 0) {
      if (additionalNeeded > availableStock) {
        return NextResponse.json({
          error: `Stock ${produkData.nama_produk} tidak mencukupi!\n\n` +
                 `Stock total: ${globalStock.toFixed(2)} ${produkData.satuan}\n` +
                 `Direserve penjualan lain: ${totalReservedByOthers.toFixed(2)}\n` +
                 `Tersedia: ${availableStock.toFixed(2)}\n` +
                 `Tambahan diminta: ${additionalNeeded.toFixed(2)}`
        }, { status: 400 });
      }
    } else {
    }

    // Update detail penjualan
    const newSubtotal = jumlahBaru * parseFloat(body.harga?.toString() || '0');
    
    const { data: updatedItem, error: updateError } = await supabase
      .from('detail_penjualan')
      .update({
        jumlah: jumlahBaru,
        harga: parseFloat(body.harga?.toString() || '0'),
        subtotal: newSubtotal
      })
      .eq('id', body.itemId)
      .select(`
        *,
        produk:produk_id (id, nama_produk, kode_produk, satuan)
      `)
      .single();

    if (updateError) throw updateError;


    // Update total penjualan
    const { data: allDetails } = await supabase
      .from('detail_penjualan')
      .select('subtotal')
      .eq('penjualan_id', penjualan_id);

    const total = allDetails?.reduce(
      (sum, item) => sum + parseFloat(item.subtotal?.toString() || '0'), 
      0
    ) || 0;

    const { error: updateTotalError } = await supabase
      .from('transaksi_penjualan')
      .update({ total })
      .eq('id', penjualan_id);

    if (updateTotalError) throw updateTotalError;


    return NextResponse.json({ 
      success: true,
      data: updatedItem, 
      message: 'Item berhasil diupdate',
      stock_info: {
        product: produk.nama_produk,
        old_quantity: jumlahLama,
        new_quantity: jumlahBaru,
        change: jumlahBaru - jumlahLama,
        available: availableStock,
        remaining: availableStock - jumlahBaru
      }
    });
  } catch (error: any) {
    console.error('❌ Error updating item:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


// DELETE - Hapus item dari penjualan
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId');
    const penjualanId = searchParams.get('penjualanId');

    if (!itemId || !penjualanId) {
      return NextResponse.json(
        { error: 'Missing itemId or penjualanId' },
        { status: 400 }
      );
    }


    // ✅ Validasi: Cek apakah penjualan sudah dikonfirmasi
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select('status, status_diterima')
      .eq('id', penjualanId)
      .single();

    if (penjualanError) throw penjualanError;

    // Tidak bisa hapus item jika sudah dikonfirmasi
    if (penjualan.status_diterima === 'Diterima') {
      return NextResponse.json({
        error: 'Tidak bisa menghapus item pada penjualan yang sudah dikonfirmasi'
      }, { status: 400 });
    }

    // Get item data before delete (untuk info saja)
    const { data: item, error: getItemError } = await supabase
      .from('detail_penjualan')
      .select(`
        produk_id, 
        jumlah
      `)
      .eq('id', itemId)
      .single();

    if (getItemError) throw getItemError;

    // Get product name for logging
    const { data: produkInfo } = await supabase
      .from('produk')
      .select('nama_produk')
      .eq('id', item.produk_id)
      .single();


    // ❌ TIDAK ADA PENGEMBALIAN STOCK DI SINI!
    // Karena stock belum dikurangi saat item ditambahkan

    // ✅ Delete detail penjualan
    const { error: deleteError } = await supabase
      .from('detail_penjualan')
      .delete()
      .eq('id', itemId);

    if (deleteError) throw deleteError;


    // ✅ Update total penjualan
    const { data: allDetails } = await supabase
      .from('detail_penjualan')
      .select('subtotal')
      .eq('penjualan_id', penjualanId);

    const total = allDetails?.reduce(
      (sum, item) => sum + parseFloat(item.subtotal?.toString() || '0'), 
      0
    ) || 0;

    const { error: updateTotalError } = await supabase
      .from('transaksi_penjualan')
      .update({ total })
      .eq('id', penjualanId);

    if (updateTotalError) throw updateTotalError;


    return NextResponse.json({ 
      success: true,
      message: 'Item berhasil dihapus',
      new_total: total
    });
  } catch (error: any) {
    console.error('❌ Error deleting item:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
