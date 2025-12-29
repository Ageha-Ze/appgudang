// app/api/persediaan/stock-barang/fix-comprehensive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * Comprehensive Stock Fix
 * Mode: 'check' or 'fix'
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { mode } = body; // 'check' or 'fix'


    // 1. Find missing pembelian entries
    const { data: pembelianMissing } = await supabase
      .from('detail_pembelian')
      .select(`
        id,
        pembelian_id,
        produk_id,
        jumlah,
        cabang_id,
        pembelian:pembelian_id (
          tanggal,
          no_invoice
        ),
        produk:produk_id (
          nama_produk
        )
      `)
      .not('pembelian_id', 'is', null);

    // Check which ones are missing in stock_barang
    const missingPembelian = [];
    for (const item of pembelianMissing || []) {
      const { data: exists } = await supabase
        .from('stock_barang')
        .select('id')
        .eq('produk_id', item.produk_id)
        .eq('cabang_id', item.cabang_id)
        .ilike('keterangan', `%Pembelian%${(item as any).pembelian?.no_invoice}%`)
        .limit(1);

      if (!exists || exists.length === 0) {
        missingPembelian.push(item);
      }
    }

    // 2. Find missing produksi entries
    const { data: produksiMissing } = await supabase
      .from('produksi')
      .select(`
        id,
        produk_id,
        jumlah,
        cabang_id,
        tanggal,
        kode_produksi,
        produk:produk_id (
          nama_produk
        )
      `);

    const missingProduksi = [];
    for (const item of produksiMissing || []) {
      const { data: exists } = await supabase
        .from('stock_barang')
        .select('id')
        .eq('produk_id', item.produk_id)
        .eq('cabang_id', item.cabang_id)
        .ilike('keterangan', `%Produksi%${item.kode_produksi}%`)
        .limit(1);

      if (!exists || exists.length === 0) {
        missingProduksi.push(item);
      }
    }

    // 3. Find missing konsinyasi entries
    const { data: konsinyasiMissing } = await supabase
      .from('detail_penjualan')
      .select(`
        id,
        penjualan_id,
        produk_id,
        jumlah,
        cabang_id,
        penjualan:penjualan_id (
          tanggal,
          no_invoice,
          jenis_penjualan
        ),
        produk:produk_id (
          nama_produk
        )
      `)
      .not('penjualan_id', 'is', null);

    const missingKonsinyasi = [];
    for (const item of konsinyasiMissing || []) {
      if ((item as any).penjualan?.jenis_penjualan === 'konsinyasi') {
        const { data: exists } = await supabase
          .from('stock_barang')
          .select('id')
          .eq('produk_id', item.produk_id)
          .eq('cabang_id', item.cabang_id)
          .ilike('keterangan', `%Konsinyasi%${(item as any).penjualan?.no_invoice}%`)
          .limit(1);

        if (!exists || exists.length === 0) {
          missingKonsinyasi.push(item);
        }
      }
    }

    // 4. Find missing stock opname adjustments
    const { data: opnameMissing } = await supabase
      .from('stock_opname')
      .select(`
        id,
        produk_id,
        cabang_id,
        selisih,
        tanggal,
        status,
        produk:produk_id (
          nama_produk
        )
      `)
      .eq('status', 'approved');

    const missingOpname = [];
    for (const item of opnameMissing || []) {
      const { data: exists } = await supabase
        .from('stock_barang')
        .select('id')
        .eq('produk_id', item.produk_id)
        .eq('cabang_id', item.cabang_id)
        .ilike('keterangan', `%Stock Opname Adjustment - ${item.id}%`)
        .limit(1);

      if (!exists || exists.length === 0) {
        missingOpname.push(item);
      }
    }

    // 5. Find missing detail produksi (bahan)
    const { data: bahanMissing } = await supabase
      .from('detail_produksi')
      .select(`
        id,
        produksi_id,
        item_id,
        jumlah,
        produksi:produksi_id (
          cabang_id,
          tanggal,
          kode_produksi
        ),
        item:item_id (
          nama_item
        )
      `)
      .not('produksi_id', 'is', null);

    const missingBahan = [];
    for (const item of bahanMissing || []) {
      const { data: exists } = await supabase
        .from('stock_barang')
        .select('id')
        .eq('produk_id', item.item_id)
        .eq('cabang_id', (item as any).produksi?.cabang_id)
        .ilike('keterangan', `%Bahan Produksi%${(item as any).produksi?.kode_produksi}%`)
        .limit(1);

      if (!exists || exists.length === 0) {
        missingBahan.push(item);
      }
    }

    const summary = {
      pembelian_missing: missingPembelian.length,
      produksi_missing: missingProduksi.length,
      penjualan_konsinyasi_missing: missingKonsinyasi.length,
      stock_opname_missing: missingOpname.length,
      detail_produksi_missing: missingBahan.length,
    };

    // If CHECK mode, return summary
    if (mode === 'check') {
      return NextResponse.json({
        success: true,
        summary,
        details: {
          pembelian_missing: missingPembelian.slice(0, 10).map((p: any) => ({
            nama_produk: p.produk?.nama_produk,
            jumlah: p.jumlah,
            tanggal: p.pembelian?.tanggal,
            no_invoice: p.pembelian?.no_invoice,
          })),
          produksi_missing: missingProduksi.slice(0, 10).map((p: any) => ({
            nama_produk: p.produk?.nama_produk,
            jumlah: p.jumlah,
            tanggal: p.tanggal,
            kode_produksi: p.kode_produksi,
          })),
          penjualan_konsinyasi_missing: missingKonsinyasi.slice(0, 10).map((p: any) => ({
            nama_produk: p.produk?.nama_produk,
            jumlah: p.jumlah,
            tanggal: p.penjualan?.tanggal,
            no_invoice: p.penjualan?.no_invoice,
          })),
          stock_opname_missing: missingOpname.slice(0, 10).map((p: any) => ({
            nama_produk: p.produk?.nama_produk,
            selisih: p.selisih,
            tanggal: p.tanggal,
          })),
          detail_produksi_missing: missingBahan.slice(0, 10).map((p: any) => ({
            nama_item: p.item?.nama_item,
            jumlah: p.jumlah,
            tanggal: p.produksi?.tanggal,
            kode_produksi: p.produksi?.kode_produksi,
          })),
        },
      });
    }

    // FIX mode - Insert missing records
    const errors: any[] = [];
    let insertedCount = 0;

    // Insert missing pembelian
    for (const item of missingPembelian) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.produk_id,
          cabang_id: item.cabang_id,
          jumlah: item.jumlah,
          tanggal: (item as any).pembelian?.tanggal,
          tipe: 'masuk',
          keterangan: `Pembelian - ${(item as any).pembelian?.no_invoice} (Auto-fixed)`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertedCount++;
      } catch (error: any) {
        errors.push({ type: 'pembelian', id: item.id, error: error.message });
      }
    }

    // Insert missing produksi
    for (const item of missingProduksi) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.produk_id,
          cabang_id: item.cabang_id,
          jumlah: item.jumlah,
          tanggal: item.tanggal,
          tipe: 'masuk',
          keterangan: `Produksi - ${item.kode_produksi} (Auto-fixed)`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertedCount++;
      } catch (error: any) {
        errors.push({ type: 'produksi', id: item.id, error: error.message });
      }
    }

    // Insert missing konsinyasi
    for (const item of missingKonsinyasi) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.produk_id,
          cabang_id: item.cabang_id,
          jumlah: item.jumlah,
          tanggal: (item as any).penjualan?.tanggal,
          tipe: 'keluar',
          keterangan: `Penjualan Konsinyasi - ${(item as any).penjualan?.no_invoice} (Auto-fixed)`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertedCount++;
      } catch (error: any) {
        errors.push({ type: 'konsinyasi', id: item.id, error: error.message });
      }
    }

    // Insert missing opname
    for (const item of missingOpname) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.produk_id,
          cabang_id: item.cabang_id,
          jumlah: Math.abs(parseFloat(item.selisih.toString())),
          tanggal: item.tanggal,
          tipe: parseFloat(item.selisih.toString()) > 0 ? 'masuk' : 'keluar',
          keterangan: `Stock Opname Adjustment - ${item.id} (Auto-fixed)`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertedCount++;
      } catch (error: any) {
        errors.push({ type: 'opname', id: item.id, error: error.message });
      }
    }

    // Insert missing bahan
    for (const item of missingBahan) {
      try {
        await supabase.from('stock_barang').insert({
          produk_id: item.item_id,
          cabang_id: (item as any).produksi?.cabang_id,
          jumlah: item.jumlah,
          tanggal: (item as any).produksi?.tanggal,
          tipe: 'keluar',
          keterangan: `Bahan Produksi - ${(item as any).produksi?.kode_produksi} (Auto-fixed)`,
          hpp: 0,
          harga_jual: 0,
          persentase: 0,
        });
        insertedCount++;
      } catch (error: any) {
        errors.push({ type: 'bahan', id: item.id, error: error.message });
      }
    }

    // Recalculate stock for all affected products
    const affectedProducts = new Set<number>();
    [...missingPembelian, ...missingProduksi, ...missingKonsinyasi, ...missingOpname].forEach((item: any) => {
      affectedProducts.add(item.produk_id);
    });
    missingBahan.forEach((item: any) => {
      affectedProducts.add(item.item_id);
    });

    const stockFixed: any[] = [];
    for (const produk_id of affectedProducts) {
      const { data: movements } = await supabase
        .from('stock_barang')
        .select('jumlah, tipe')
        .eq('produk_id', produk_id);

      let totalStock = 0;
      movements?.forEach((m) => {
        const jumlah = parseFloat(m.jumlah.toString());
        if (m.tipe === 'masuk') totalStock += jumlah;
        else totalStock -= jumlah;
      });

      const { data: produk } = await supabase
        .from('produk')
        .select('stok, nama_produk')
        .eq('id', produk_id)
        .single();

      await supabase
        .from('produk')
        .update({ stok: totalStock })
        .eq('id', produk_id);

      stockFixed.push({
        produk_id,
        nama_produk: produk?.nama_produk,
        old_stock: produk?.stok || 0,
        new_stock: totalStock,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        ...summary,
        inserted: insertedCount,
        stock_fixed: stockFixed.length,
        errors: errors.length,
      },
      details: {
        stock_fixed: stockFixed,
        errors,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in comprehensive fix:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
