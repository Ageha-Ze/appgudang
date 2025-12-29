// app/api/gudang/produksi/[id]/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { validateStockDeletion, restoreStock, logAuditTrail } from '@/lib/helpers/stockSafety';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;

    // Query directly instead of using RPC
    const { data: produksi, error: produksiError } = await supabase
      .from('transaksi_produksi')
      .select(`
        *,
        produk:produk_id (
          id,
          nama_produk,
          kode_produk
        ),
        pegawai:pegawai_id (
          id,
          nama
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        ),
        detail_produksi (
          *,
          item:produk (
            id,
            nama_produk,
            kode_produk,
            satuan
          )
        )
      `)
      .eq('id', parseInt(id))
      .single();

    if (produksiError) {
      console.error('Error fetching produksi:', produksiError);
      throw produksiError;
    }

    if (!produksi) {
      throw new Error('Data tidak ditemukan');
    }

    return NextResponse.json({ data: produksi });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error fetching produksi detail:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { produk_id, jumlah, pegawai_id } = body;
    const { id } = await params;

    if (!produk_id || !jumlah || !pegawai_id) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('transaksi_produksi')
      .update({
        produk_id: parseInt(produk_id),
        jumlah: parseFloat(jumlah),
        pegawai_id: parseInt(pegawai_id),
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(id))
      .eq('status', 'pending') // Only allow editing pending productions
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error updating produksi:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const detailId = searchParams.get('detailId');
    const { id } = await params;
    const produksiId = parseInt(id);

    if (detailId) {
      // ============================================================
      // DETAIL ITEM DELETION: Return allocated material to stock
      // ============================================================

      const { data: detail, error: getError } = await supabase
        .from('detail_produksi')
        .select('item_id, jumlah')
        .eq('id', parseInt(detailId))
        .single();

      if (getError || !detail) {
        throw new Error('Detail item not found');
      }

      // Return material stock (+jumlah)
      const { data: produk } = await supabase
        .from('produk')
        .select('stok')
        .eq('id', detail.item_id)
        .single();

      const currentStock = parseFloat(produk?.stok?.toString() || '0');
      const newStock = currentStock + parseFloat(detail.jumlah?.toString() || '0');

      const { error: stockError } = await supabase
        .from('produk')
        .update({
          stok: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', detail.item_id);

      if (stockError) {
        throw stockError;
      }

      // Delete the detail record
      const { error: deleteError } = await supabase
        .from('detail_produksi')
        .delete()
        .eq('id', parseInt(detailId));

      if (deleteError) throw deleteError;

      return NextResponse.json({
        success: true,
        message: 'Detail item deleted and stock restored'
      });
    } else {
      // ============================================================
      // PRODUCTION DELETION - WITH STOCK SAFETY
      // ============================================================

      // STEP 1: Get produksi data
      const { data: produksi, error: fetchError } = await supabase
        .from('transaksi_produksi')
        .select(`
          id, tanggal, produk_id, jumlah, satuan,
          cabang_id, pegawai_id, status
        `)
        .eq('id', produksiId)
        .single();

      if (fetchError || !produksi) {
        return NextResponse.json(
          { success: false, error: 'Data produksi tidak ditemukan' },
          { status: 404 }
        );
      }

      // STEP 2: Validate Stock Safety
      const stockValidation = await validateStockDeletion('produksi', produksiId);

      if (!stockValidation.safe) {
        return NextResponse.json({
          success: false,
          error: stockValidation.message
        }, { status: 400 });
      }

      // STEP 3: Restore Stock (using helper)
      const stockResult = await restoreStock('produksi', produksiId);

      // STEP 4: Log Audit Trail
      await logAuditTrail(
        'DELETE',
        'transaksi_produksi',
        produksiId,
        produksi
      );

      // STEP 5: Delete detail_produksi
      await supabase
        .from('detail_produksi')
        .delete()
        .eq('produksi_id', produksiId);

      // STEP 6: Delete transaksi_produksi
      const { error: deleteProduksiError } = await supabase
        .from('transaksi_produksi')
        .delete()
        .eq('id', produksiId);

      if (deleteProduksiError) throw deleteProduksiError;

      // STEP 7: Build Response
      const executionTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: stockResult.restored
          ? `Produksi berhasil dihapus dan stock dikembalikan (${stockResult.count} items)`
          : 'Produksi berhasil dihapus',
        deleted: {
          produksi_id: produksiId,
          stock_restored: stockResult.restored,
          stock_items: stockResult.count,
          execution_time_ms: executionTime
        },
        details: {
          stock_products: stockResult.products || [],
          validation: stockValidation
        }
      });
    }
  } catch (error: any) {
    console.error('❌ ERROR in production DELETE:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
