
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { applyFIFO } from '@/lib/fifo/calculateFIFO';

// POST - Migrate existing data to FIFO
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const includePenjualan = body.include_penjualan || false;

    let totalBatches = 0;
    let totalStock = 0;
    let totalPenjualanProcessed = 0;
    const errors: any[] = [];

    // ========== STEP 1: MIGRATE PEMBELIAN ==========
    const { data: pembelianList, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        id,
        tanggal,
        cabang_id,
        status,
        detail_pembelian (
          produk_id,
          jumlah,
          harga
        )
      `)
      .eq('status', 'billed')
      .not('cabang_id', 'is', null)
      .order('tanggal', { ascending: true })
      .order('id', { ascending: true });

    if (pembelianError) throw pembelianError;

    // Insert stock masuk
    for (const pembelian of pembelianList || []) {
      if (!pembelian.detail_pembelian || pembelian.detail_pembelian.length === 0) {
        continue;
      }

      for (const item of pembelian.detail_pembelian) {
        // Check duplicate
        const { data: existing } = await supabase
          .from('stock_movement_fifo')
          .select('id')
          .eq('produk_id', item.produk_id)
          .eq('referensi_type', 'pembelian')
          .eq('referensi_id', pembelian.id)
          .single();

        if (existing) continue;

        const { error: insertError } = await supabase
          .from('stock_movement_fifo')
          .insert({
            produk_id: item.produk_id,
            cabang_id: pembelian.cabang_id,
            tanggal: pembelian.tanggal,
            tipe: 'masuk',
            jumlah_awal: Number(item.jumlah),
            jumlah_sisa: Number(item.jumlah),
            hpp_per_unit: Number(item.harga),
            referensi_type: 'pembelian',
            referensi_id: pembelian.id,
            keterangan: `Migration: Pembelian #${pembelian.id}`,
          });

        if (insertError) {
          errors.push({
            type: 'pembelian',
            id: pembelian.id,
            produk_id: item.produk_id,
            error: insertError.message,
          });
        } else {
          totalBatches++;
          totalStock += Number(item.jumlah);
        }
      }
    }

    // ========== STEP 2: MIGRATE PENJUALAN (OPTIONAL) ==========
    if (includePenjualan) {
      const { data: penjualanList, error: penjualanError } = await supabase
        .from('transaksi_penjualan')
        .select(`
          id,
          tanggal,
          pegawai_id,
          status,
          status_pembayaran,
          detail_penjualan (
            id,
            produk_id,
            jumlah,
            harga
          )
        `)
        .eq('status', 'billed') // ✅ Yang sudah di-billing (stock sudah keluar)
        .order('tanggal', { ascending: true })
        .order('id', { ascending: true });

      if (penjualanError) throw penjualanError;

      // Process penjualan dengan FIFO
      for (const penjualan of penjualanList || []) {
        if (!penjualan.detail_penjualan || penjualan.detail_penjualan.length === 0) {
          continue;
        }

        // Get cabang_id dari pegawai
        const { data: pegawai } = await supabase
          .from('pegawai')
          .select('cabang_id')
          .eq('id', penjualan.pegawai_id)
          .single();

        const cabangId = pegawai?.cabang_id;
        if (!cabangId) {
          continue;
        }

        for (const item of penjualan.detail_penjualan) {
          // Check duplicate
          const { data: existing } = await supabase
            .from('stock_movement_fifo')
            .select('id')
            .eq('referensi_type', 'penjualan')
            .eq('referensi_id', penjualan.id)
            .eq('produk_id', item.produk_id)
            .limit(1);

          if (existing && existing.length > 0) continue;

          try {
            // Apply FIFO untuk penjualan ini
            const fifoResult = await applyFIFO(
              supabase,
              item.produk_id,
              cabangId,
              Number(item.jumlah),
              'penjualan',
              penjualan.id,
              penjualan.tanggal,
              `Migration: Penjualan #${penjualan.id}`
            );

            // Update HPP di detail_penjualan
            await supabase
              .from('detail_penjualan')
              .update({ hpp: fifoResult.hpp_per_unit })
              .eq('id', item.id);

            totalPenjualanProcessed++;
          } catch (error: any) {
            errors.push({
              type: 'penjualan',
              id: penjualan.id,
              produk_id: item.produk_id,
              error: error.message,
            });
          }
        }
      }
    }

    // ========== SUMMARY ==========
    const { data: summary } = await supabase
      .from('stock_movement_fifo')
      .select('jumlah_sisa, hpp_per_unit, tipe');

    const stockMasuk = (summary || [])
      .filter(s => s.tipe === 'masuk')
      .reduce((sum, s) => sum + Number(s.jumlah_sisa), 0);

    const nilaiStock = (summary || [])
      .filter(s => s.tipe === 'masuk')
      .reduce((sum, s) => sum + Number(s.jumlah_sisa) * Number(s.hpp_per_unit), 0);

    return NextResponse.json({
      message: 'Migrasi selesai',
      summary: {
        pembelian: {
          total_processed: pembelianList?.length || 0,
          batches_created: totalBatches,
          stock_migrated: totalStock,
        },
        penjualan: {
          processed: totalPenjualanProcessed,
          included: includePenjualan,
        },
        stock_akhir: {
          total_stock: stockMasuk,
          nilai_stock: nilaiStock,
        },
        errors: errors.length,
        error_details: errors,
      },
    });
  } catch (error: any) {
    console.error('Error migration:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Check migration status
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();

    // Count billed pembelian
    const { count: totalPembelian } = await supabase
      .from('transaksi_pembelian')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'billed')
      .not('cabang_id', 'is', null);

    // Count batches in FIFO (pembelian)
    const { count: totalBatches } = await supabase
      .from('stock_movement_fifo')
      .select('*', { count: 'exact', head: true })
      .eq('tipe', 'masuk')
      .eq('referensi_type', 'pembelian');

    // Count billed penjualan
    const { count: totalPenjualan } = await supabase
      .from('transaksi_penjualan')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'billed');

    // Count penjualan in FIFO
    const { count: totalPenjualanFIFO } = await supabase
      .from('stock_movement_fifo')
      .select('referensi_id', { count: 'exact', head: true })
      .eq('tipe', 'keluar')
      .eq('referensi_type', 'penjualan');

    // Get unique penjualan_ids that have been processed
    const { data: processedPenjualan } = await supabase
      .from('stock_movement_fifo')
      .select('referensi_id')
      .eq('tipe', 'keluar')
      .eq('referensi_type', 'penjualan');

    const uniquePenjualanProcessed = new Set(processedPenjualan?.map(p => p.referensi_id)).size;

    const needMigrationPembelian = (totalPembelian || 0) > (totalBatches || 0);
    const needMigrationPenjualan = (totalPenjualan || 0) > uniquePenjualanProcessed;

    return NextResponse.json({
      total_pembelian_billed: totalPembelian || 0,
      total_batches_in_fifo: totalBatches || 0,
      total_penjualan_billed: totalPenjualan || 0,
      total_penjualan_processed: uniquePenjualanProcessed || 0,
      need_migration: needMigrationPembelian || needMigrationPenjualan,
      need_migration_detail: {
        pembelian: needMigrationPembelian,
        penjualan: needMigrationPenjualan,
      },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
