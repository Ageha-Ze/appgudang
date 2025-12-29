// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const cabangId = searchParams.get('cabangId');
    const period = searchParams.get('period') || '6'; // Default 6 bulan

    if (!cabangId) {
      return NextResponse.json({ error: 'cabangId is required' }, { status: 400 });
    }

    // Calculate current month start and end properly
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Calculate period based on parameter
    const monthsAgo = period === '12' ? 12 : 6;
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);

    // Kas Saat Ini: Sum saldo from kas where cabang_id = cabangId
    const { data: kasData, error: kasError } = await supabase
      .from('kas')
      .select('saldo')
      .eq('cabang_id', cabangId);
    if (kasError) throw kasError;
    const kasSaatIni = kasData.reduce((sum, k) => sum + (k.saldo || 0), 0);

    // Total Piutang: Sum sisa from piutang_penjualan via joins
    const { data: piutangData, error: piutangError } = await supabase
      .from('piutang_penjualan')
      .select(`
        sisa,
        transaksi_penjualan!inner(
          customer!inner(cabang_id)
        )
      `)
      .eq('transaksi_penjualan.customer.cabang_id', cabangId);
    if (piutangError) throw piutangError;
    const totalPiutang = piutangData.reduce((sum, p) => sum + (p.sisa || 0), 0);

    // Total Hutang: Sum sisa from hutang_pembelian via joins
    const { data: hutangData, error: hutangError } = await supabase
      .from('hutang_pembelian')
      .select(`
        sisa,
        transaksi_pembelian!hutang_pembelian_pembelian_id_fkey!inner(cabang_id)
      `)
      .eq('transaksi_pembelian.cabang_id', cabangId);
    if (hutangError) throw hutangError;
    const totalHutang = hutangData.reduce((sum, h) => sum + (h.sisa || 0), 0);

    // Pendapatan Bulan Ini: Sum total from transaksi_penjualan via join
    const { data: pendapatanData, error: pendapatanError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        total,
        customer!inner(cabang_id)
      `)
      .eq('customer.cabang_id', cabangId)
      .gte('tanggal', currentMonthStart.toISOString().slice(0, 10))
      .lte('tanggal', currentMonthEnd.toISOString().slice(0, 10));
    if (pendapatanError) throw pendapatanError;
    const pendapatanBulanIni = pendapatanData.reduce((sum, p) => sum + (p.total || 0), 0);

    // Pengeluaran Bulan Ini: Sum total from transaksi_pembelian
    const { data: pengeluaranData, error: pengeluaranError } = await supabase
      .from('transaksi_pembelian')
      .select('total')
      .eq('cabang_id', cabangId)
      .gte('tanggal', currentMonthStart.toISOString().slice(0, 10))
      .lte('tanggal', currentMonthEnd.toISOString().slice(0, 10));
    if (pengeluaranError) throw pengeluaranError;
    const pengeluaranBulanIni = pengeluaranData.reduce((sum, p) => sum + (p.total || 0), 0);

    // Total HPP: Sum hpp dari detail penjualan bulan ini per cabang
    // Step 1: Ambil semua transaksi penjualan bulan ini untuk cabang ini
    const { data: penjualanBulanIni, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        id,
        customer!inner(cabang_id)
      `)
      .eq('customer.cabang_id', cabangId)
      .gte('tanggal', currentMonthStart.toISOString().slice(0, 10))
      .lte('tanggal', currentMonthEnd.toISOString().slice(0, 10));

    if (penjualanError) throw penjualanError;

    // Step 2: Ambil IDs transaksi penjualan
    const penjualanIds = penjualanBulanIni.map(p => p.id);

    // Step 3: Hitung total HPP berdasarkan detail penjualan
    let totalHPP = 0;


    if (penjualanIds.length > 0) {
      const { data: hppData, error: hppError } = await supabase
        .from('detail_penjualan')
        .select('jumlah, hpp')
        .in('penjualan_id', penjualanIds);

      if (hppError) {
        console.error('❌ HPP Error:', hppError);
        throw hppError;
      }


      totalHPP = hppData.reduce((sum, item) => {
        const hpp = item.hpp || 0;
        const jumlah = item.jumlah || 0;
        return sum + (hpp * jumlah);
      }, 0);

    } else {
    }

    // Sales Data: Monthly sales for selected period via join
    const { data: salesDataRaw, error: salesError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        total,
        tanggal,
        customer!inner(cabang_id)
      `)
      .eq('customer.cabang_id', cabangId)
      .gte('tanggal', periodStart.toISOString().slice(0, 10))
      .order('tanggal');
    if (salesError) throw salesError;

    // Group by month
    const salesMap = new Map<string, number>();
    salesDataRaw.forEach((sale) => {
      const month = new Date(sale.tanggal).toLocaleString('default', { month: 'short' });
      salesMap.set(month, (salesMap.get(month) || 0) + (sale.total || 0));
    });
    const salesData = Array.from(salesMap.entries()).map(([month, sales]) => ({ month, sales }));

    return NextResponse.json({
      kasSaatIni,
      totalPiutang,
      totalHutang,
      pendapatanBulanIni,
      pengeluaranBulanIni,
      totalHPP,
      salesData,
    });
  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
