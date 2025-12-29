// app/api/persediaan/stock-produk/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// PUT - Update stock produk di gudang tertentu
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
        const supabase = await supabaseAuthenticated();

    const { id } = await context.params;
    const body = await request.json();


    // 🔒 STEP 1: Ambil data SEBELUM update untuk tracking
    const { data: currentStock, error: getCurrentError } = await supabase
      .from('stock_produk')
      .select('produk_id, gudang_id, jumlah_stock')
      .eq('id', id)
      .single();

    if (getCurrentError) throw getCurrentError;
    if (!currentStock) {
      return NextResponse.json({ error: 'Stock produk tidak ditemukan' }, { status: 404 });
    }


    // 🔒 STEP 2: Update HANYA record ini di stock_produk
    const { error: updateError } = await supabase
      .from('stock_produk')
      .update({
        jumlah_stock: parseFloat(body.jumlah_stock),
        hpp: parseFloat(body.hpp) || 0,
        harga_jual: parseFloat(body.harga_jual) || 0,
        persentase_harga_jual: parseFloat(body.persentase_harga_jual) || 0,
      })
      .eq('id', id); // ✅ UPDATE HANYA row dengan ID ini

    if (updateError) throw updateError;

    // 🔒 STEP 3: Catat perubahan ke stock_barang (history)
    const selisih = parseFloat(body.jumlah_stock) - parseFloat(currentStock.jumlah_stock.toString());
    
    if (selisih !== 0) {
      const { error: historyError } = await supabase
        .from('stock_barang')
        .insert({
          produk_id: currentStock.produk_id,
          gudang_id: currentStock.gudang_id,
          tanggal: new Date().toISOString(),
          jumlah: Math.abs(selisih),
          tipe: selisih > 0 ? 'masuk' : 'keluar',
          keterangan: body.keterangan || `Update manual stock (${selisih > 0 ? '+' : ''}${selisih.toFixed(2)})`,
          hpp: parseFloat(body.hpp) || 0,
          harga_jual: parseFloat(body.harga_jual) || 0,
          persentase: parseFloat(body.persentase_harga_jual) || 0,
        });

      if (historyError) {
        console.error('⚠️ Warning: Gagal catat history:', historyError);
        // Tidak throw error, karena update stock sudah berhasil
      }
    }

    // 🔒 STEP 4: Verifikasi update berhasil
    const { data: verifyStock, error: verifyError } = await supabase
      .from('stock_produk')
      .select(`
        id,
        jumlah_stock,
        hpp,
        harga_jual,
        produk:produk_id (nama_produk),
        gudang:gudang_id (nama_gudang)
      `)
      .eq('id', id)
      .single();

    if (verifyError) throw verifyError;


    return NextResponse.json({
      success: true,
      message: 'Stock berhasil diupdate',
      data: {
        id: verifyStock.id,
        produk: (verifyStock.produk as any)?.nama_produk,
        gudang: (verifyStock.gudang as any)?.nama_gudang,
        jumlah_stock: verifyStock.jumlah_stock,
        hpp: verifyStock.hpp,
        harga_jual: verifyStock.harga_jual,
        selisih: selisih
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('❌ Error updating stock produk:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Hapus stock produk dari gudang
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
        const supabase = await supabaseAuthenticated();

    const { id } = await context.params;


    // Get data sebelum hapus
    const { data: stock, error: getError } = await supabase
      .from('stock_produk')
      .select('produk_id, gudang_id, jumlah_stock')
      .eq('id', id)
      .single();

    if (getError) throw getError;
    if (!stock) {
      return NextResponse.json({ error: 'Stock produk tidak ditemukan' }, { status: 404 });
    }

    // Hapus dari stock_produk
    const { error: deleteError } = await supabase
      .from('stock_produk')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Optional: Catat ke history
    await supabase
      .from('stock_barang')
      .insert({
        produk_id: stock.produk_id,
        gudang_id: stock.gudang_id,
        tanggal: new Date().toISOString(),
        jumlah: parseFloat(stock.jumlah_stock.toString()),
        tipe: 'keluar',
        keterangan: 'Hapus stock dari gudang',
      });

    return NextResponse.json({
      success: true,
      message: 'Stock produk berhasil dihapus dari gudang'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('❌ Error deleting stock produk:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
