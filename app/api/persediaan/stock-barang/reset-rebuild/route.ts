// app/api/persediaan/stock-barang/reset-rebuild/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * POST - Reset & Rebuild All Stock
 * Mode: 'check' or 'reset'
 * 
 * This will:
 * 1. DELETE all stock_barang records
 * 2. REBUILD from:
 *    - detail_pembelian (masuk)
 *    - produksi (masuk)
 *    - detail_penjualan konsinyasi (keluar)
 *    - stock_opname approved (adjustment)
 *    - detail_produksi (keluar bahan)
 * 3. RECALCULATE produk.stok
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { mode } = body; // 'check' or 'reset'


    // ============================================
    // STEP 1: COUNT CURRENT & FUTURE RECORDS
    // ============================================

    // Current stock_barang count
    const { count: currentCount } = await supabase
      .from('stock_barang')
      .select('id', { count: 'exact', head: true });

    // Count future records
    const { count: pembelianCount } = await supabase
      .from('detail_pembelian')
      .select('id', { count: 'exact', head: true });

    const { count: produksiCount } = await supabase
      .from('produksi')
      .select('id', { count: 'exact', head: true });

    const { data: penjualanData } = await supabase
      .from('detail_penjualan')
      .select(`
        id,
        penjualan:penjualan_id (
          jenis_penjualan
        )
      `);

    const konsinyasiCount = penjualanData?.filter(
      (d: any) => d.penjualan?.jenis_penjualan === 'konsinyasi'
    ).length || 0;

    const { count: opnameCount } = await supabase
      .from('stock_opname')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: bahanCount } = await supabase
      .from('detail_produksi')
      .select('id', { count: 'exact', head: true });

    const summary = {
      current_stock_records: currentCount || 0,
      will_be_created: {
        pembelian: pembelianCount || 0,
        produksi: produksiCount || 0,
        konsinyasi: konsinyasiCount,
        stock_opname: opnameCount || 0,
        bahan_produksi: bahanCount || 0,
      },
    };

    // If CHECK mode, return summary
    if (mode === 'check') {
      return NextResponse.json({
        success: true,
        summary,
      });
    }

    // ============================================
    // STEP 2: RESET - DELETE ALL STOCK_BARANG
    // ============================================

    
    const { error: deleteError } = await supabase
      .from('stock_barang')
      .delete()
      .neq('id', 0); // Delete all

    if (deleteError) throw deleteError;


    // ============================================
    // STEP 3: REBUILD FROM SOURCES
    // ============================================

    const errors: any[] = [];
    const insertResults = {
      pembelian: 0,
      produksi: 0,
      konsinyasi: 0,
      penjualan: 0,
      opname: 0,
      bahan: 0,
      errors: errors,
    };

    // 3.1. Insert from detail_pembelian
    const { data: pembelianData } = await supabase
      .from('detail_pembelian')
      .select(`
        id,
        produk_id,
        jumlah,
        harga,
        cabang_id,
        pembelian:pembelian_id (
          tanggal,
          no_invoice
        )
      `)
      .not('pembelian_id', 'is', null);

    for (const item of pembelianData || []) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.produk_id,
          cabang_id: item.cabang_id,
          jumlah: parseFloat(item.jumlah.toString()),
          tanggal: (item as any).pembelian?.tanggal,
          tipe: 'masuk',
          keterangan: `Pembelian - ${(item as any).pembelian?.no_invoice}`,
          hpp: parseFloat(item.harga?.toString() || '0'),
          harga_jual: 0,
          persentase: 0,
        });
        insertResults.pembelian++;
      } catch (error: any) {
        errors.push({ type: 'pembelian', id: item.id, error: error.message });
      }
    }

    // 3.2. Insert from produksi
    const { data: produksiData } = await supabase
      .from('produksi')
      .select('id, produk_id, jumlah, cabang_id, tanggal, kode_produksi');

    for (const item of produksiData || []) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.produk_id,
          cabang_id: item.cabang_id,
          jumlah: parseFloat(item.jumlah.toString()),
          tanggal: item.tanggal,
          tipe: 'masuk',
          keterangan: `Produksi - ${item.kode_produksi}`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertResults.produksi++;
      } catch (error: any) {
        errors.push({ type: 'produksi', id: item.id, error: error.message });
      }
    }

    // 3.3. Insert from detail_penjualan (konsinyasi only)
    const { data: konsinyasiData } = await supabase
      .from('detail_penjualan')
      .select(`
        id,
        produk_id,
        jumlah,
        cabang_id,
        penjualan:penjualan_id (
          tanggal,
          no_invoice,
          jenis_penjualan
        )
      `)
      .not('penjualan_id', 'is', null);

    for (const item of konsinyasiData || []) {
      if ((item as any).penjualan?.jenis_penjualan === 'konsinyasi') {
        try {
          await supabase.from('stock_barang').insert({
            produk_id: item.produk_id,
            cabang_id: item.cabang_id,
            jumlah: parseFloat(item.jumlah.toString()),
            tanggal: (item as any).penjualan?.tanggal,
            tipe: 'keluar',
            keterangan: `Penjualan Konsinyasi - ${(item as any).penjualan?.no_invoice}`,
            hpp: 0,
            harga_jual: 0,
            persentase: 0,
          });
          insertResults.konsinyasi++;
        } catch (error: any) {
          errors.push({ type: 'konsinyasi', id: item.id, error: error.message });
        }
      }
    }

    // 3.4. Insert from stock_opname (approved only)
    const { data: opnameData } = await supabase
      .from('stock_opname')
      .select('id, produk_id, cabang_id, selisih, tanggal')
      .eq('status', 'approved');

    for (const item of opnameData || []) {
      const selisih = parseFloat(item.selisih.toString());
      if (Math.abs(selisih) > 0.001) {
        try {
          await supabase.from('stock_barang').insert({
            produk_id: item.produk_id,
            cabang_id: item.cabang_id,
            jumlah: Math.abs(selisih),
            tanggal: item.tanggal,
            tipe: selisih > 0 ? 'masuk' : 'keluar',
            keterangan: `Stock Opname Adjustment - ${item.id}`,
            hpp: 0,
            harga_jual: 0,
            persentase: 0,
          });
          insertResults.opname++;
        } catch (error: any) {
          errors.push({ type: 'opname', id: item.id, error: error.message });
        }
      }
    }

    // 3.5. Insert from detail_produksi (bahan)
    const { data: bahanData } = await supabase
      .from('detail_produksi')
      .select(`
        id,
        item_id,
        jumlah,
        produksi:produksi_id (
          cabang_id,
          tanggal,
          kode_produksi
        )
      `)
      .not('produksi_id', 'is', null);

    for (const item of bahanData || []) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.item_id,
          cabang_id: (item as any).produksi?.cabang_id,
          jumlah: parseFloat(item.jumlah.toString()),
          tanggal: (item as any).produksi?.tanggal,
          tipe: 'keluar',
          keterangan: `Bahan Produksi - ${(item as any).produksi?.kode_produksi}`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertResults.bahan++;
      } catch (error: any) {
        errors.push({ type: 'bahan', id: item.id, error: error.message });
      }
    }

    // ============================================
    // STEP 4: RECALCULATE ALL PRODUK.STOK
    // ============================================


    const { data: allProducts } = await supabase
      .from('produk')
      .select('id, nama_produk');

    const finalProducts: any[] = [];

    for (const produk of allProducts || []) {
      const { data: movements } = await supabase
        .from('stock_barang')
        .select('jumlah, tipe')
        .eq('produk_id', produk.id);

      let totalStock = 0;
      movements?.forEach((m) => {
        const jumlah = parseFloat(m.jumlah.toString());
        if (m.tipe === 'masuk') totalStock += jumlah;
        else totalStock -= jumlah;
      });

      await supabase
        .from('produk')
        .update({ stok: totalStock })
        .eq('id', produk.id);

      finalProducts.push({
        id: produk.id,
        nama_produk: produk.nama_produk,
        stok: totalStock,
      });
    }


    return NextResponse.json({
      success: true,
      message: 'Reset & Rebuild berhasil!',
      summary: {
        deleted: currentCount || 0,
        created: insertResults.pembelian + insertResults.produksi + insertResults.konsinyasi + insertResults.opname + insertResults.bahan,
        final_products: finalProducts,
      },
      insert_results: insertResults,
    });
  } catch (error: any) {
    console.error('❌ Error in reset rebuild:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
