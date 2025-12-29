// app/api/persediaan/stock-barang/debug-check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * GET - Debug check untuk lihat detail stock sebelum rebuild
 * Query params: produk_id, cabang_id (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();

    // Check query parameters for specific audit
    const { searchParams } = new URL(request.url);
    const produkId = searchParams.get('produk_id');
    const cabangId = searchParams.get('cabang_id');

    if (produkId && cabangId) {
      // Specific audit for product and branch
      return await performSpecificAudit(supabase, produkId, cabangId);
    } else {
      // Global debug check
      return await performGlobalAudit(supabase);
    }
  } catch (error: any) {
    console.error('❌ Error in debug check:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function performSpecificAudit(supabase: any, produkId: string, cabangId: string) {
  const produkIdNum = parseInt(produkId);
  const cabangIdNum = parseInt(cabangId);

  if (isNaN(produkIdNum) || isNaN(cabangIdNum)) {
    return NextResponse.json(
      { success: false, error: 'Invalid produk_id or cabang_id parameters' },
      { status: 400 }
    );
  }

  // Get all transactions for this product and branch
  const { data: transactions, error: transError } = await supabase
    .from('stock_barang')
    .select('id, tanggal, jumlah, tipe, keterangan')
    .eq('produk_id', produkIdNum)
    .eq('cabang_id', cabangIdNum)
    .order('tanggal', { ascending: true });

  if (transError) throw transError;

  // Calculate stock from transactions
  let calculatedStock = 0;
  let masukTotal = 0;
  let keluarTotal = 0;
  const invalidTransactions: Array<{
    id: number;
    reason: string;
    jumlah: any;
  }> = [];

  transactions?.forEach((t: any) => {
    const jumlah = parseFloat(t.jumlah?.toString() || '0');

    if (isNaN(jumlah)) {
      invalidTransactions.push({
        id: t.id,
        reason: 'Invalid jumlah (NaN)',
        jumlah: t.jumlah
      });
      return;
    }

    if (t.tipe !== 'masuk' && t.tipe !== 'keluar') {
      invalidTransactions.push({
        id: t.id,
        reason: `Invalid tipe: ${t.tipe}`,
        jumlah: t.jumlah
      });
      return;
    }

    if (t.tipe === 'masuk') {
      calculatedStock += jumlah;
      masukTotal += jumlah;
    } else {
      calculatedStock -= jumlah;
      keluarTotal += jumlah;
    }
  });

  // Get database stock
  const { data: produk } = await supabase
    .from('produk')
    .select('nama_produk, stok')
    .eq('id', produkIdNum)
    .single();

  const dbStock = parseFloat(produk?.stok?.toString() || '0');
  const difference = Math.abs(calculatedStock - dbStock);

  const status = difference < 0.01 ? 'KONSISTEN' : 'INKONSISTEN';

  return NextResponse.json({
    success: true,
    data: {
      calculated_stock: calculatedStock,
      db_stock: dbStock,
      transactions: transactions || [],
      invalid_transactions: invalidTransactions,
      status: status,
      summary: {
        masuk_total: masukTotal,
        keluar_total: keluarTotal,
        db_stock: dbStock,
        calculated_stock: calculatedStock,
        difference: calculatedStock - dbStock,
      }
    }
  });
}

async function performGlobalAudit(supabase: any) {
  const report = {
    current_stock_barang: {
      total: 0,
      by_tipe: { masuk: 0, keluar: 0 },
      duplicates: [] as any[],
    },
    transactions: {
      pembelian: 0,
      detail_pembelian: 0,
      produksi: 0,
      penjualan: 0,
      detail_penjualan: 0,
      konsinyasi: 0,
      opname: 0,
      detail_produksi: 0,
    },
    stock_by_satuan: {} as any,
    problematic_products: [] as any[],
  };

  // 1. Check current stock_barang
  const { data: stockBarang, error: sbError } = await supabase
    .from('stock_barang')
    .select('id, produk_id, cabang_id, tanggal, jumlah, tipe, keterangan');

  if (sbError) throw sbError;

  report.current_stock_barang.total = stockBarang?.length || 0;
  report.current_stock_barang.by_tipe.masuk = stockBarang?.filter((s: any) => s.tipe === 'masuk').length || 0;
  report.current_stock_barang.by_tipe.keluar = stockBarang?.filter((s: any) => s.tipe === 'keluar').length || 0;

  // Check for duplicates
  const groupedStock = new Map<string, any[]>();
  stockBarang?.forEach((s: any) => {
    const key = `${s.produk_id}-${s.cabang_id}-${s.tanggal}-${s.tipe}-${s.jumlah}-${s.keterangan}`;
    if (!groupedStock.has(key)) {
      groupedStock.set(key, []);
    }
    groupedStock.get(key)!.push(s);
  });

  groupedStock.forEach((items, key) => {
    if (items.length > 1) {
      report.current_stock_barang.duplicates.push({
        key: key,
        count: items.length,
        ids: items.map((i: any) => i.id),
        sample: items[0],
      });
    }
  });

  // 2. Check transactions
  const { count: pembelianCount } = await supabase
    .from('transaksi_pembelian')
    .select('*', { count: 'exact', head: true })
    .eq('status_barang', 'Diterima');
  report.transactions.pembelian = pembelianCount || 0;

  const { count: detailPembelianCount } = await supabase
    .from('detail_pembelian')
    .select('*', { count: 'exact', head: true });
  report.transactions.detail_pembelian = detailPembelianCount || 0;

  const { count: produksiCount } = await supabase
    .from('transaksi_produksi')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted');
  report.transactions.produksi = produksiCount || 0;

  const { count: penjualanCount } = await supabase
    .from('transaksi_penjualan')
    .select('*', { count: 'exact', head: true })
    .in('status', ['billed', 'paid']);
  report.transactions.penjualan = penjualanCount || 0;

  const { count: detailPenjualanCount } = await supabase
    .from('detail_penjualan')
    .select('*', { count: 'exact', head: true });
  report.transactions.detail_penjualan = detailPenjualanCount || 0;

  const { count: konsinyasiCount } = await supabase
    .from('penjualan_konsinyasi')
    .select('*', { count: 'exact', head: true });
  report.transactions.konsinyasi = konsinyasiCount || 0;

  const { count: opnameCount } = await supabase
    .from('stock_opname')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  report.transactions.opname = opnameCount || 0;

  const { count: detailProduksiCount } = await supabase
    .from('detail_produksi')
    .select('*', { count: 'exact', head: true });
  report.transactions.detail_produksi = detailProduksiCount || 0;

  // 3. Check stock by satuan
  const { data: produkData } = await supabase
    .from('produk')
    .select('id, nama_produk, kode_produk, satuan, stok');

  const satuanGroups = new Map<string, { total_stock: number, products: any[] }>();

  produkData?.forEach((p: any) => {
    const satuan = p.satuan || 'Unknown';
    if (!satuanGroups.has(satuan)) {
      satuanGroups.set(satuan, { total_stock: 0, products: [] });
    }
    const group = satuanGroups.get(satuan)!;
    group.total_stock += parseFloat(p.stok?.toString() || '0');
    group.products.push({
      id: p.id,
      nama: p.nama_produk,
      kode: p.kode_produk,
      stock: parseFloat(p.stok?.toString() || '0'),
    });
  });

  satuanGroups.forEach((data, satuan) => {
    report.stock_by_satuan[satuan] = {
      total: data.total_stock,
      count: data.products.length,
      products: data.products,
    };
  });

  // 4. Check problematic products (negative or very high stock)
  produkData?.forEach((p: any) => {
    const stock = parseFloat(p.stok?.toString() || '0');
    if (stock < 0 || stock > 100000) {
      report.problematic_products.push({
        id: p.id,
        nama: p.nama_produk,
        kode: p.kode_produk,
        stock: stock,
        satuan: p.satuan,
        issue: stock < 0 ? 'NEGATIVE' : 'VERY_HIGH',
      });
    }
  });

  return NextResponse.json({
    success: true,
    report,
    recommendations: {
      has_duplicates: report.current_stock_barang.duplicates.length > 0,
      duplicate_count: report.current_stock_barang.duplicates.length,
      should_rebuild: report.current_stock_barang.duplicates.length > 0 ||
                     report.problematic_products.length > 0,
      total_transactions: Object.values(report.transactions).reduce((a: number, b: number) => a + b, 0),
    },
  });
}
