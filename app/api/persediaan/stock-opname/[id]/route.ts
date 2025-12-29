// app/api/persediaan/stock-opname/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Get single stock opname
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('stock_opname')
      .select(`
        id,
        tanggal,
        produk:produk_id (
          id,
          nama_produk,
          kode_produk,
          stok,
          hpp
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        ),
        jumlah_sistem,
        jumlah_fisik,
        selisih,
        status,
        keterangan,
        created_at
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching stock opname:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Approve/Reject stock opname
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();


    // Get opname data
    const { data: opname, error: getError } = await supabase
      .from('stock_opname')
      .select('*')
      .eq('id', id)
      .single();

    if (getError) throw getError;
    if (!opname) {
      return NextResponse.json(
        { error: 'Data stock opname tidak ditemukan' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (opname.status !== 'pending') {
      return NextResponse.json(
        { error: 'Stock opname sudah diproses sebelumnya' },
        { status: 400 }
      );
    }

    // ✅ Update status FIRST (prevent double processing)
    const { error: updateError } = await supabase
      .from('stock_opname')
      .update({
        status: body.status,
        keterangan: body.keterangan || opname.keterangan,
      })
      .eq('id', id)
      .eq('status', 'pending'); // ← Only update if still pending

    if (updateError) throw updateError;

    // If approved, adjust the stock
    if (body.status === 'approved' && Math.abs(opname.selisih) > 0.001) {

      // ✅ CHECK: Apakah adjustment ini sudah dicatat sebelumnya?
      const { data: existingAdjustment } = await supabase
        .from('stock_barang')
        .select('id')
        .eq('produk_id', opname.produk_id)
        .eq('cabang_id', opname.cabang_id)
        .ilike('keterangan', `%Stock Opname Adjustment - ${id}%`)
        .limit(1);

      if (existingAdjustment && existingAdjustment.length > 0) {
        console.warn('⚠️ Adjustment already recorded, skipping insert');
        
        return NextResponse.json({
          success: true,
          message: body.status === 'approved' 
            ? 'Stock opname sudah disetujui sebelumnya' 
            : 'Stock opname ditolak',
          already_processed: true
        });
      }

      // ✅ Insert adjustment transaction (ONCE!)
      const { error: stockError } = await supabase
        .from('stock_barang')
        .insert({
          produk_id: opname.produk_id,
          cabang_id: opname.cabang_id,
          jumlah: Math.abs(opname.selisih),
          tanggal: opname.tanggal,
          tipe: opname.selisih > 0 ? 'masuk' : 'keluar',
          keterangan: `Stock Opname Adjustment - ${id} (Approved)`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });

      if (stockError) {
        console.error('❌ Error creating stock adjustment:', stockError);
        throw stockError;
      }

      // ✅ FIXED: Update produk.stok langsung dengan selisih (jangan recalculate!)
      const { data: currentProduk, error: getProdukError } = await supabase
        .from('produk')
        .select('stok, nama_produk')
        .eq('id', opname.produk_id)
        .single();

      if (getProdukError) throw getProdukError;

      const currentStock = parseFloat(currentProduk.stok?.toString() || '0');
      const newStock = currentStock + parseFloat(opname.selisih.toString());


      // Update produk table
      const { error: produkError } = await supabase
        .from('produk')
        .update({ stok: newStock })
        .eq('id', opname.produk_id);

      if (produkError) {
        console.error('❌ Error updating produk:', produkError);
        throw produkError;
      }

    }

    return NextResponse.json({
      success: true,
      message: body.status === 'approved' 
        ? 'Stock opname disetujui dan stock telah disesuaikan' 
        : 'Stock opname ditolak',
    });

  } catch (error: any) {
    console.error('❌ Error updating stock opname:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete stock opname and reverse stock adjustments
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;


    // Get opname data
    const { data: opname, error: getError } = await supabase
      .from('stock_opname')
      .select('*')
      .eq('id', id)
      .single();

    if (getError) throw getError;
    if (!opname) {
      return NextResponse.json(
        { error: 'Data stock opname tidak ditemukan' },
        { status: 404 }
      );
    }

    // If approved, reverse the stock adjustments
    if (opname.status === 'approved' && Math.abs(opname.selisih) > 0.001) {

      // 1. Delete the adjustment record from stock_barang
      const { error: deleteStockError } = await supabase
        .from('stock_barang')
        .delete()
        .eq('produk_id', opname.produk_id)
        .eq('cabang_id', opname.cabang_id)
        .ilike('keterangan', `%Stock Opname Adjustment - ${id}%`);

      if (deleteStockError) {
        console.error('❌ Error deleting stock adjustment:', deleteStockError);
        throw deleteStockError;
      }


      // 2. Reverse the stock change in produk table
      const { data: currentProduk, error: getProdukError } = await supabase
        .from('produk')
        .select('stok, nama_produk')
        .eq('id', opname.produk_id)
        .single();

      if (getProdukError) throw getProdukError;

      const currentStock = parseFloat(currentProduk.stok?.toString() || '0');
      const reversedStock = currentStock - parseFloat(opname.selisih.toString()); // Reverse the adjustment


      const { error: produkError } = await supabase
        .from('produk')
        .update({ stok: reversedStock })
        .eq('id', opname.produk_id);

      if (produkError) {
        console.error('❌ Error reversing produk stock:', produkError);
        throw produkError;
      }

    }

    // Delete the stock opname record
    const { error: deleteError } = await supabase
      .from('stock_opname')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;


    return NextResponse.json({
      success: true,
      message: opname.status === 'approved'
        ? 'Stock opname berhasil dihapus dan penyesuaian stock telah dibatalkan'
        : 'Stock opname berhasil dihapus',
    });

  } catch (error: any) {
    console.error('❌ Error deleting stock opname:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
