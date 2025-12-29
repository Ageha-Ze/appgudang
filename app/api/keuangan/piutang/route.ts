'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - List semua piutang
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const cabangId = searchParams.get('cabang_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('transaksi_penjualan')
      .select(`
        id,
        nota_penjualan,
        tanggal,
        cabang_id,
        customer_id,
        pegawai_id,
        total,
        dibayar,
        status_pembayaran,
        jatuh_tempo,
        keterangan,
        jenis_pembayaran,
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        ),
        customers:customer_id (
          id,
          nama,
          no_hp,
          alamat
        ),
        detail_penjualan (
          id,
          subtotal
        )
      `)
      .eq('jenis_pembayaran', 'hutang')
      .order('tanggal', { ascending: false });

    if (cabangId && cabangId !== 'all') {
      query = query.eq('cabang_id', parseInt(cabangId));
    }

    if (status && status !== 'all') {
      query = query.eq('status_pembayaran', status);
    }

    if (search) {
      query = query.ilike('nota_penjualan', `%${search}%`);
    }

    const { data: piutangData, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    // 🔥 FIX: Ambil semua cicilan untuk setiap piutang
    const piutangIds = (piutangData || []).map(p => p.id);
    const { data: allCicilan } = await supabase
      .from('cicilan_penjualan')
      .select('penjualan_id, jumlah_cicilan')
      .in('penjualan_id', piutangIds);

    // Group cicilan by penjualan_id
    const cicilanMap = new Map();
    (allCicilan || []).forEach(c => {
      const id = c.penjualan_id;
      if (!cicilanMap.has(id)) {
        cicilanMap.set(id, 0);
      }
      cicilanMap.set(id, cicilanMap.get(id) + parseFloat(c.jumlah_cicilan?.toString() || '0'));
    });

    // ✅ Transform data dengan kalkulasi REAL
    const transformedData = (piutangData || []).map((item: any) => {
      // 🔥 GUNAKAN TOTAL TRANSAKSI PENJUALAN (SUDAH INCLUDE BIAYA TAMBAHAN)
      const realTotal = parseFloat(item.total?.toString() || '0');

      // 🔥 HITUNG TERBAYAR DARI SUM CICILAN
      const terbayar = cicilanMap.get(item.id) || 0;

      const sisaPiutang = realTotal - terbayar;
      const persenPembayaran = realTotal > 0 ? (terbayar / realTotal) * 100 : 0;

      const cabang = Array.isArray(item.cabang) ? item.cabang[0] : item.cabang;
      const customer = Array.isArray(item.customers) ? item.customers[0] : item.customers;

      // Generate nota_penjualan if null (same logic as penjualan API)
      let nota_penjualan = item.nota_penjualan;
      if (!nota_penjualan) {
        const tanggal = new Date(item.tanggal).toISOString().split('T')[0].replace(/-/g, '');
        const nomorUrut = String(item.id).padStart(4, '0');
        nota_penjualan = `PJ-${tanggal}-${nomorUrut}`;
      }

      // Check for data consistency (no logging needed for production)
      const dibayarFromDB = parseFloat(item.dibayar?.toString() || '0');
      // Data consistency check removed for production

      return {
        id: item.id,
        nota: nota_penjualan, // ✅ Use generated nota_penjualan if null
        tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split('T')[0] : '',
        cabang: cabang?.nama_cabang || '-',
        cabangId: cabang?.id || 0,
        customer: customer?.nama || '-',
        customerId: customer?.id || 0,
        customerTelp: customer?.no_hp || '-',
        customerAlamat: customer?.alamat || '-',
        sales: item.pegawai_id ? `Sales ${item.pegawai_id}` : '-',
        totalPiutang: realTotal, // ✅ Total dari detail
        terbayar, // ✅ Total dari sum cicilan
        sisaPiutang,
        persenPembayaran: Math.round(persenPembayaran),
        status: item.status_pembayaran,
        jatuhTempo: item.jatuh_tempo ? new Date(item.jatuh_tempo).toISOString().split('T')[0] : '-',
        keterangan: item.keterangan
      };
    });

    return NextResponse.json(transformedData, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching piutang data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch piutang data', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Summary piutang
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { action, cabangId } = body;

    if (action !== 'summary') {
      return NextResponse.json(
        { error: 'Invalid action. Expected "summary"' },
        { status: 400 }
      );
    }

    // ✅ Query dengan detail_penjualan
    let query = supabase
      .from('transaksi_penjualan')
      .select(`
        id,
        total,
        dibayar,
        detail_penjualan (
          subtotal
        )
      `)
      .eq('jenis_pembayaran', 'hutang')
      .in('status_pembayaran', ['Belum Lunas', 'Cicil']);

    if (cabangId && cabangId !== 'all') {
      const parsedCabangId = parseInt(cabangId);
      if (!isNaN(parsedCabangId)) {
        query = query.eq('cabang_id', parsedCabangId);
      }
    }

    const { data: piutangData, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // 🔥 FIX: Ambil cicilan untuk summary
    const piutangIds = (piutangData || []).map(p => p.id);
    const { data: allCicilan } = await supabase
      .from('cicilan_penjualan')
      .select('penjualan_id, jumlah_cicilan')
      .in('penjualan_id', piutangIds);

    const cicilanMap = new Map();
    (allCicilan || []).forEach(c => {
      const id = c.penjualan_id;
      if (!cicilanMap.has(id)) {
        cicilanMap.set(id, 0);
      }
      cicilanMap.set(id, cicilanMap.get(id) + parseFloat(c.jumlah_cicilan?.toString() || '0'));
    });

    // ✅ Calculate summary dengan total real
    const summary = (piutangData || []).reduce(
      (acc, item: any) => {
        const realTotal = parseFloat(item.total?.toString() || '0');

        const terbayar = cicilanMap.get(item.id) || 0;
        const sisa = realTotal - terbayar;

        return {
          totalPiutang: acc.totalPiutang + realTotal,
          totalTerbayar: acc.totalTerbayar + terbayar,
          totalSisa: acc.totalSisa + sisa,
          jumlahTransaksi: acc.jumlahTransaksi + 1
        };
      },
      {
        totalPiutang: 0,
        totalTerbayar: 0,
        totalSisa: 0,
        jumlahTransaksi: 0
      }
    );

    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    console.error('Error processing piutang summary:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process piutang summary', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
