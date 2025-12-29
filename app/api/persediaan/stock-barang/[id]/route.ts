// app/api/persediaan/stock-barang/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * GET - Fetch stock history by product ID
 * ✅ FIXED: Correct stock_awal calculation and running balance
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const cabangId = searchParams.get('cabang_id');


    // Get produk info
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('nama_produk, kode_produk, satuan, hpp, stok')
      .eq('id', id)
      .single();

    if (produkError) throw produkError;

    // Get all movements for this product (optionally filtered by cabang)
    let movementsQuery = supabase
      .from('stock_barang')
      .select(`
        id,
        tanggal,
        jumlah,
        tipe,
        keterangan,
        hpp,
        harga_jual,
        persentase,
        cabang:cabang_id (
          nama_cabang
        )
      `)
      .eq('produk_id', id);

    // Apply cabang filter if provided
    if (cabangId) {
      movementsQuery = movementsQuery.eq('cabang_id', parseInt(cabangId));
    }

    movementsQuery = movementsQuery
      .order('tanggal', { ascending: true })
      .order('id', { ascending: true });

    const { data: movements, error: movementsError } = await movementsQuery;

    if (movementsError) throw movementsError;

    // Calculate totals
    const total_masuk = movements
      ?.filter(m => m.tipe === 'masuk')
      .reduce((sum, m) => sum + parseFloat(m.jumlah.toString()), 0) || 0;

    const total_keluar = movements
      ?.filter(m => m.tipe === 'keluar')
      .reduce((sum, m) => sum + parseFloat(m.jumlah.toString()), 0) || 0;

    // Get current stock for this branch (or global if no branch filter)
    let current_stock = parseFloat(produk.stok.toString());

    if (cabangId) {
      try {
        // Fetch branch-specific stock from movements
        const branch_stock = total_masuk - total_keluar;
        current_stock = branch_stock;
      } catch (error) {
      }
    }

    // ✅ FIX: Correct stock_awal calculation
    // Formula: stock_awal = stock_akhir - net_movement
    // Where: net_movement = total_masuk - total_keluar
    const net_movement = total_masuk - total_keluar;
    const stock_awal = current_stock - net_movement;

    // ✅ FIX: Calculate running balance starting from stock_awal
    let balance = stock_awal;
    const historiesWithBalance = (movements || []).map((item: any) => {
      const jumlah = parseFloat(item.jumlah.toString());

      if (item.tipe === 'masuk') {
        balance += jumlah;
      } else if (item.tipe === 'keluar') {
        balance -= jumlah;
      }

      return {
        id: item.id,
        tanggal: item.tanggal,
        jumlah: item.jumlah,
        tipe: item.tipe,
        keterangan: item.keterangan,
        hpp: item.hpp,
        harga_jual: item.harga_jual,
        cabang: item.cabang?.nama_cabang || '-',
        balance: balance, // Running balance yang benar
      };
    });

    // Reverse for display (newest first)
    const historiesReversed = [...historiesWithBalance].reverse();

    return NextResponse.json({
      success: true,
      data: historiesReversed,
      summary: {
        nama_produk: produk.nama_produk,
        kode_produk: produk.kode_produk,
        satuan: produk.satuan || 'Kg',
        hpp: produk.hpp || 0,
        stock_awal: stock_awal,
        stock_akhir: current_stock,
        total_masuk: total_masuk,
        total_keluar: total_keluar,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete stock transaction
 * (Existing code remains unchanged)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;


    // Get transaction data before delete
    const { data: transaction, error: getError } = await supabase
      .from('stock_barang')
      .select(`
        id,
        produk_id,
        cabang_id,
        jumlah,
        tipe,
        keterangan,
        produk:produk_id (
          nama_produk,
          stok
        )
      `)
      .eq('id', id)
      .single();

    if (getError) throw getError;
    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaksi tidak ditemukan' },
        { status: 404 }
      );
    }

    const produk: any = transaction.produk;
    const currentStock = parseFloat(produk.stok.toString());
    const jumlah = parseFloat(transaction.jumlah.toString());

    // Calculate new stock (reverse the transaction)
    let newStock = currentStock;
    if (transaction.tipe === 'masuk') {
      newStock -= jumlah; // Remove if was added
    } else {
      newStock += jumlah; // Add back if was removed
    }

    // Validation: stock cannot be negative
    if (newStock < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tidak bisa menghapus transaksi ini karena akan membuat stock negatif',
          detail: `Stock saat ini: ${currentStock}, setelah delete: ${newStock}`,
        },
        { status: 400 }
      );
    }

    // Delete transaction
    const { error: deleteError } = await supabase
      .from('stock_barang')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Update produk stock
    const { error: updateError } = await supabase
      .from('produk')
      .update({ stok: newStock })
      .eq('id', transaction.produk_id);

    if (updateError) throw updateError;


    return NextResponse.json({
      success: true,
      message: 'Transaksi berhasil dihapus dan stock disesuaikan',
      data: {
        deleted_transaction: {
          id: transaction.id,
          produk: produk.nama_produk,
          jumlah: transaction.jumlah,
          tipe: transaction.tipe,
        },
        stock_update: {
          before: currentStock,
          after: newStock,
          difference: newStock - currentStock,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error deleting transaction:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
