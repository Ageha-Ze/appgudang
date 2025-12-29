// app/api/laporan/konsinyasi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const cabangId = searchParams.get('cabang_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status'); // New: status filter

    if (!cabangId) {
      return NextResponse.json(
        { success: false, error: 'Cabang ID diperlukan' },
        { status: 400 }
      );
    }

    console.log('[LAPORAN] Filters:', { cabangId, startDate, endDate, status });

    // ✅ STEP 1: Get consignments for this branch
    let consignmentQuery = supabase
      .from('transaksi_konsinyasi')
      .select(`
        id,
        kode_konsinyasi,
        tanggal_titip,
        total_nilai_titip,
        status,
        toko:toko_id (
          id,
          kode_toko,
          nama_toko
        ),
        detail_konsinyasi (
          id,
          jumlah_titip,
          jumlah_terjual,
          jumlah_sisa,
          jumlah_kembali,
          harga_konsinyasi,
          harga_jual_toko,
          subtotal_nilai_titip,
          keuntungan_toko,
          produk:produk_id (
            id,
            nama_produk,
            kode_produk,
            hpp,
            satuan
          )
        )
      `)
      .eq('cabang_id', cabangId)
      .order('tanggal_titip', { ascending: false });

    // Apply status filter if provided (otherwise get ALL status)
    if (status && status !== 'Semua') {
      consignmentQuery = consignmentQuery.eq('status', status);
    }

    // Apply date filter to consignment date if provided
    if (startDate) {
      consignmentQuery = consignmentQuery.gte('tanggal_titip', startDate);
    }
    if (endDate) {
      consignmentQuery = consignmentQuery.lte('tanggal_titip', endDate);
    }

    const { data: allConsignments, error: consignmentError } = await consignmentQuery;

    if (consignmentError) {
      console.error('[LAPORAN] Error fetching consignments:', consignmentError);
      return NextResponse.json(
        { success: false, error: consignmentError.message },
        { status: 500 }
      );
    }

    console.log('[LAPORAN] Found consignments:', allConsignments?.length || 0);

    // Check if no data found
    if (!allConsignments || allConsignments.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          detail: [],
          summary: {},
          overall: {
            total_transaksi: 0,
            total_produk: 0,
            total_nilai_titip: 0,
            total_nilai_terjual: 0,
            total_keuntungan: 0,
            total_titip: 0,
            total_terjual: 0,
            total_sisa: 0,
            total_kembali: 0,
          },
          filters: {
            cabang_id: cabangId,
            start_date: startDate,
            end_date: endDate,
            status: status,
          },
          message: 'Tidak ada transaksi konsinyasi pada periode yang dipilih'
        }
      });
    }

    // Get all detail IDs
    const allDetailIds: number[] = [];
    for (const konsinyasi of allConsignments) {
      for (const detail of konsinyasi.detail_konsinyasi || []) {
        allDetailIds.push(detail.id);
      }
    }

    console.log('[LAPORAN] Total detail IDs:', allDetailIds.length);

    // ✅ STEP 2: Fetch ALL SALES for these consignments (cumulative)
    const { data: allSales, error: salesError } = allDetailIds.length > 0
      ? await supabase
          .from('penjualan_konsinyasi')
          .select('detail_konsinyasi_id, jumlah_terjual, total_penjualan, keuntungan_toko, tanggal_jual')
          .in('detail_konsinyasi_id', allDetailIds)
      : { data: [], error: null };

    if (salesError) {
      console.error('[LAPORAN] Error fetching sales:', salesError);
    }

    console.log('[LAPORAN] All sales:', allSales?.length || 0);

    // Group sales by detail_konsinyasi_id
    const salesByDetail: { [key: number]: { total_terjual: number; total_nilai: number; total_keuntungan: number } } = {};

    if (allSales) {
      allSales.forEach((sale: any) => {
        const detailId = sale.detail_konsinyasi_id;
        if (!salesByDetail[detailId]) {
          salesByDetail[detailId] = {
            total_terjual: 0,
            total_nilai: 0,
            total_keuntungan: 0
          };
        }
        salesByDetail[detailId].total_terjual += parseFloat(sale.jumlah_terjual?.toString() || '0');
        salesByDetail[detailId].total_nilai += parseFloat(sale.total_penjualan?.toString() || '0');
        salesByDetail[detailId].total_keuntungan += parseFloat(sale.keuntungan_toko?.toString() || '0');
      });
    }

    console.log('[LAPORAN] Sales by detail:', Object.keys(salesByDetail).length, 'details with sales');

    // ✅ STEP 3: Fetch ALL RETURNS for these consignments (cumulative)
    const { data: allReturns, error: returError } = allDetailIds.length > 0
      ? await supabase
          .from('retur_konsinyasi')
          .select('detail_konsinyasi_id, jumlah_retur, tanggal_retur')
          .in('detail_konsinyasi_id', allDetailIds)
      : { data: [], error: null };

    if (returError) {
      console.error('[LAPORAN] Error fetching returns:', returError);
    }

    console.log('[LAPORAN] All returns:', allReturns?.length || 0);

    // Group returns by detail_konsinyasi_id
    const returByDetail: { [key: number]: number } = {};

    if (allReturns) {
      allReturns.forEach((retur: any) => {
        const detailId = retur.detail_konsinyasi_id;
        if (!returByDetail[detailId]) {
          returByDetail[detailId] = 0;
        }
        returByDetail[detailId] += parseFloat(retur.jumlah_retur?.toString() || '0');
      });
    }

    console.log('[LAPORAN] Returns by detail:', Object.keys(returByDetail).length, 'details with returns');

    // ✅ STEP 4: Build report data
    const reportData = [];
    const productsInReport = new Set<number>();

    for (const konsinyasi of allConsignments) {
      for (const detail of konsinyasi.detail_konsinyasi || []) {
        const produk = detail.produk as any;
        if (!produk) continue;

        const detailId = detail.id;
        const salesInfo = salesByDetail[detailId] || { total_terjual: 0, total_nilai: 0, total_keuntungan: 0 };
        const returInfo = returByDetail[detailId] || 0;

        productsInReport.add(produk.id);

        const actualJumlahTerjual = salesInfo.total_terjual;
        const totalNilaiTerjual = salesInfo.total_nilai;
        const actualKeuntungan = salesInfo.total_keuntungan;
        const actualJumlahKembali = returInfo;

        // Calculate average selling price from actual sales
        const rataHargaJualToko = actualJumlahTerjual > 0 ? totalNilaiTerjual / actualJumlahTerjual : 0;

        // Calculate remaining: titip - terjual (cumulative) - kembali (cumulative)
        const jumlahSisa = detail.jumlah_titip - actualJumlahTerjual - actualJumlahKembali;

        reportData.push({
          konsinyasi_id: konsinyasi.id,
          kode_konsinyasi: konsinyasi.kode_konsinyasi,
          tanggal_titip: konsinyasi.tanggal_titip,
          status: konsinyasi.status,
          toko_kode: (konsinyasi.toko as any)?.kode_toko || '',
          toko_nama: (konsinyasi.toko as any)?.nama_toko || '',
          produk_id: produk.id,
          produk_kode: produk.kode_produk,
          produk_nama: produk.nama_produk,
          satuan: produk.satuan,
          hpp: produk.hpp || 0,
          harga_konsinyasi: detail.harga_konsinyasi,
          harga_jual_toko: detail.harga_jual_toko,
          rata_harga_jual_toko: rataHargaJualToko,
          jumlah_titip: detail.jumlah_titip,
          jumlah_terjual: actualJumlahTerjual, // Cumulative sales
          jumlah_sisa: Math.max(0, jumlahSisa), // Remaining based on cumulative data
          jumlah_kembali: actualJumlahKembali, // Cumulative returns
          keuntungan: actualKeuntungan, // Cumulative profit
          subtotal_nilai_titip: detail.subtotal_nilai_titip,
          total_nilai_terjual: totalNilaiTerjual,
        });
      }
    }

    console.log('[LAPORAN] Report data rows:', reportData.length);
    console.log('[LAPORAN] Unique products:', productsInReport.size);

    // ✅ STEP 5: Group by product to get summary
    const productSummary: { [key: string]: any } = {};
    
    reportData.forEach(item => {
      const key = item.produk_id;
      if (!productSummary[key]) {
        productSummary[key] = {
          produk_id: item.produk_id,
          produk_kode: item.produk_kode,
          produk_nama: item.produk_nama,
          satuan: item.satuan,
          hpp: item.hpp,
          total_titip: 0,
          total_terjual: 0,
          total_sisa: 0,
          total_kembali: 0,
          total_nilai_titip: 0,
          total_nilai_terjual: 0,
          total_keuntungan: 0,
          rata_harga_konsinyasi: 0,
          rata_harga_jual_toko: 0,
        };
      }

      productSummary[key].total_titip += item.jumlah_titip;
      productSummary[key].total_terjual += item.jumlah_terjual;
      productSummary[key].total_sisa += item.jumlah_sisa;
      productSummary[key].total_kembali += item.jumlah_kembali;
      productSummary[key].total_nilai_titip += item.subtotal_nilai_titip;
      productSummary[key].total_nilai_terjual += item.total_nilai_terjual;
      productSummary[key].total_keuntungan += item.keuntungan;
    });

    // Calculate averages
    Object.values(productSummary).forEach((summary: any) => {
      if (summary.total_titip > 0) {
        summary.rata_harga_konsinyasi = summary.total_nilai_titip / summary.total_titip;
      }
      if (summary.total_terjual > 0) {
        summary.rata_harga_jual_toko = summary.total_nilai_terjual / summary.total_terjual;
      }
    });

    // ✅ STEP 6: Calculate overall summary
    const overallSummary = {
      total_transaksi: reportData.length,
      total_produk: Object.keys(productSummary).length,
      total_nilai_titip: reportData.reduce((sum, item) => sum + item.subtotal_nilai_titip, 0),
      total_nilai_terjual: reportData.reduce((sum, item) => sum + item.total_nilai_terjual, 0),
      total_keuntungan: reportData.reduce((sum, item) => sum + item.keuntungan, 0),
      total_titip: reportData.reduce((sum, item) => sum + item.jumlah_titip, 0),
      total_terjual: reportData.reduce((sum, item) => sum + item.jumlah_terjual, 0),
      total_sisa: reportData.reduce((sum, item) => sum + item.jumlah_sisa, 0),
      total_kembali: reportData.reduce((sum, item) => sum + item.jumlah_kembali, 0),
    };

    console.log('[LAPORAN] Overall summary:', overallSummary);

    return NextResponse.json({
      success: true,
      data: {
        detail: reportData,
        summary: productSummary,
        overall: overallSummary,
        filters: {
          cabang_id: cabangId,
          start_date: startDate,
          end_date: endDate,
          status: status,
        }
      }
    });

  } catch (error: any) {
    console.error('[LAPORAN] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}