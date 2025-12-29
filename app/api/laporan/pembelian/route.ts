// app/api/laporan/pembelian/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { calculatePembelianTotals } from '@/lib/transaksi/calculatePembelianTotals';

export async function GET(request: NextRequest) {
  
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;

    // Filter parameters
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const cabangId = searchParams.get('cabang_id');
    const suplierId = searchParams.get('suplier_id');
    const statusPembayaran = searchParams.get('status_pembayaran');
    const statusBarang = searchParams.get('status_barang');
    const jenisPembayaran = searchParams.get('jenis_pembayaran');

    // Build query - HAPUS telepon dari select
    let query = supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        suplier:suplier_id (id, nama, alamat),
        cabang:cabang_id (id, nama_cabang, kode_cabang),
        detail_pembelian (
          id, 
          jumlah, 
          harga, 
          subtotal, 
          produk_id,
          produk:produk_id (id, nama_produk, kode_produk, satuan)
        )
      `)
      .order('tanggal', { ascending: false });

    // Apply filters
    if (startDate) {
      query = query.gte('tanggal', startDate);
    }
    if (endDate) {
      query = query.lte('tanggal', endDate);
    }
    if (cabangId) {
      query = query.eq('cabang_id', cabangId);
    }
    if (suplierId) {
      query = query.eq('suplier_id', suplierId);
    }
    if (statusPembayaran) {
      query = query.eq('status_pembayaran', statusPembayaran);
    }
    if (statusBarang) {
      query = query.eq('status_barang', statusBarang);
    }
    if (jenisPembayaran) {
      query = query.eq('jenis_pembayaran', jenisPembayaran);
    }

    const { data: pembelianList, error } = await query;

    if (error) {
      console.error('❌ [SUPABASE ERROR]', error);
      throw error;
    }

    
    if (pembelianList && pembelianList.length > 0) {
    }

    if (!pembelianList || pembelianList.length === 0) {
      console.warn('⚠️ No data found, returning empty result');
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          totalPembelian: 0,
          totalNilaiPembelian: 0,
          totalSubtotal: 0,
          totalBiayaKirim: 0,
          totalUangMuka: 0,
          totalCicilan: 0,
          totalTerbayar: 0,
          totalSisaTagihan: 0,
          statusPembayaran: { lunas: 0, cicil: 0, belumLunas: 0 },
          nilaiByStatusPembayaran: { lunas: 0, cicil: 0, belumLunas: 0 },
          statusBarang: { diterima: 0, belumDiterima: 0 },
          jenisPembayaran: { cash: 0, transfer: 0 },
          nilaiByJenisPembayaran: { cash: 0, transfer: 0 },
          topSuplier: [],
          topCabang: [],
          rataRataPembelian: 0,
          rataRataBiayaKirim: 0,
        },
        filters: {
          startDate,
          endDate,
          cabangId,
          suplierId,
          statusPembayaran,
          statusBarang,
          jenisPembayaran,
        },
      });
    }


    // Enrich data with calculations
    const enrichedData = await Promise.all(
      pembelianList.map(async (p, index) => {
        
        // Use your existing helper function
        const { subtotal, finalTotal, tagihan } = calculatePembelianTotals(p);

        // Get cicilan
        const { data: cicilanList, error: cicilanError } = await supabase
          .from('cicilan_pembelian')
          .select('*')
          .eq('pembelian_id', p.id)
          .order('tanggal_cicilan', { ascending: true });

        if (cicilanError) {
          console.error(`❌ Error fetching cicilan for ${p.id}:`, cicilanError);
        }

        const totalCicilan = (cicilanList || []).reduce(
          (sum, c) => sum + Number(c.jumlah_cicilan || 0),
          0
        );

        const totalBayar = (p.uang_muka || 0) + totalCicilan;
        const sisaTagihan = Math.max(0, finalTotal - totalBayar);
        const persenTerbayar = finalTotal > 0 ? (totalBayar / finalTotal) * 100 : 0;

        return {
          ...p,
          cicilan: cicilanList || [],
          subtotal,
          finalTotal,
          totalBayar,
          sisaTagihan,
          persenTerbayar: Math.min(100, persenTerbayar),
          jumlahCicilan: cicilanList?.length || 0,
        };
      })
    );


    // Calculate summary statistics
    const summary = {
      totalPembelian: enrichedData.length,
      totalNilaiPembelian: enrichedData.reduce((sum, p) => sum + p.finalTotal, 0),
      totalSubtotal: enrichedData.reduce((sum, p) => sum + p.subtotal, 0),
      totalBiayaKirim: enrichedData.reduce((sum, p) => sum + (p.biaya_kirim || 0), 0),
      totalUangMuka: enrichedData.reduce((sum, p) => sum + (p.uang_muka || 0), 0),
      totalCicilan: enrichedData.reduce((sum, p) => sum + (p.totalBayar - (p.uang_muka || 0)), 0),
      totalTerbayar: enrichedData.reduce((sum, p) => sum + p.totalBayar, 0),
      totalSisaTagihan: enrichedData.reduce((sum, p) => sum + p.sisaTagihan, 0),
      
      // Group by status
      statusPembayaran: {
        lunas: enrichedData.filter(p => p.status_pembayaran === 'Lunas').length,
        cicil: enrichedData.filter(p => p.status_pembayaran === 'Cicil').length,
        belumLunas: enrichedData.filter(p => p.status_pembayaran === 'Belum Lunas').length,
      },
      
      nilaiByStatusPembayaran: {
        lunas: enrichedData.filter(p => p.status_pembayaran === 'Lunas').reduce((sum, p) => sum + p.finalTotal, 0),
        cicil: enrichedData.filter(p => p.status_pembayaran === 'Cicil').reduce((sum, p) => sum + p.finalTotal, 0),
        belumLunas: enrichedData.filter(p => p.status_pembayaran === 'Belum Lunas').reduce((sum, p) => sum + p.finalTotal, 0),
      },
      
      statusBarang: {
        diterima: enrichedData.filter(p => p.status_barang === 'Diterima').length,
        belumDiterima: enrichedData.filter(p => p.status_barang === 'Belum Diterima').length,
      },
      
      jenisPembayaran: {
        cash: enrichedData.filter(p => p.jenis_pembayaran === 'cash').length,
        transfer: enrichedData.filter(p => p.jenis_pembayaran === 'transfer').length,
      },
      
      nilaiByJenisPembayaran: {
        cash: enrichedData.filter(p => p.jenis_pembayaran === 'cash').reduce((sum, p) => sum + p.finalTotal, 0),
        transfer: enrichedData.filter(p => p.jenis_pembayaran === 'transfer').reduce((sum, p) => sum + p.finalTotal, 0),
      },
      
      // Top suppliers
      topSuplier: Object.entries(
        enrichedData.reduce((acc, p) => {
          const suplierNama = p.suplier?.nama || 'Unknown';
          if (!acc[suplierNama]) {
            acc[suplierNama] = { 
              nama: suplierNama, 
              total: 0, 
              count: 0,
              id: p.suplier?.id 
            };
          }
          acc[suplierNama].total += p.finalTotal;
          acc[suplierNama].count += 1;
          return acc;
        }, {} as Record<string, { nama: string; total: number; count: number; id?: string }>)
      )
        .map(([_, data]) => data)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5),
      
      // Top cabang
      topCabang: Object.entries(
        enrichedData.reduce((acc, p) => {
          const cabangNama = p.cabang?.nama_cabang || 'Unknown';
          if (!acc[cabangNama]) {
            acc[cabangNama] = { 
              nama: cabangNama, 
              total: 0, 
              count: 0,
              id: p.cabang?.id 
            };
          }
          acc[cabangNama].total += p.finalTotal;
          acc[cabangNama].count += 1;
          return acc;
        }, {} as Record<string, { nama: string; total: number; count: number; id?: string }>)
      )
        .map(([_, data]) => data)
        .sort((a: any, b: any) => b.total - a.total),
      
      // Average stats
      rataRataPembelian: enrichedData.length > 0 
        ? enrichedData.reduce((sum, p) => sum + p.finalTotal, 0) / enrichedData.length 
        : 0,
      rataRataBiayaKirim: enrichedData.length > 0
        ? enrichedData.reduce((sum, p) => sum + (p.biaya_kirim || 0), 0) / enrichedData.length
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: enrichedData,
      summary,
      filters: {
        startDate,
        endDate,
        cabangId,
        suplierId,
        statusPembayaran,
        statusBarang,
        jenisPembayaran,
      },
    });
  } catch (error: any) {
    console.error('💥 [FATAL ERROR]', error);
    console.error('Stack:', error.stack);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}

// POST tetap sama seperti sebelumnya...
export async function POST(request: NextRequest) {
  
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { type, startDate, endDate } = body;


    if (type === 'monthly_trend') {
      
      let query = supabase
        .from('transaksi_pembelian')
        .select('tanggal, total, biaya_kirim, uang_muka, status_pembayaran')
        .order('tanggal', { ascending: true });

      if (startDate) query = query.gte('tanggal', startDate);
      if (endDate) query = query.lte('tanggal', endDate);

      const { data, error } = await query;
      if (error) throw error;


      const byMonth = (data || []).reduce((acc, p) => {
        const month = new Date(p.tanggal).toISOString().substring(0, 7);
        if (!acc[month]) {
          acc[month] = { 
            month, 
            total: 0, 
            count: 0,
            lunas: 0,
            cicil: 0,
            belumLunas: 0
          };
        }
        acc[month].total += Number(p.total || 0) + Number(p.biaya_kirim || 0);
        acc[month].count += 1;
        
        if (p.status_pembayaran === 'Lunas') acc[month].lunas += 1;
        else if (p.status_pembayaran === 'Cicil') acc[month].cicil += 1;
        else acc[month].belumLunas += 1;
        
        return acc;
      }, {} as Record<string, any>);

      return NextResponse.json({
        success: true,
        data: Object.values(byMonth),
      });
    }

    if (type === 'comparison') {
      const { compareField } = body;
      
      const { data, error } = await supabase
        .from('transaksi_pembelian')
        .select(`
          *,
          suplier:suplier_id (nama),
          cabang:cabang_id (nama_cabang)
        `);

      if (error) throw error;


      let groupedData: Record<string, any> = {};

      if (compareField === 'suplier') {
        groupedData = (data || []).reduce((acc, p) => {
          const key = p.suplier?.nama || 'Unknown';
          if (!acc[key]) acc[key] = { nama: key, total: 0, count: 0 };
          acc[key].total += Number(p.total || 0) + Number(p.biaya_kirim || 0);
          acc[key].count += 1;
          return acc;
        }, {} as Record<string, any>);
      } else if (compareField === 'cabang') {
        groupedData = (data || []).reduce((acc, p) => {
          const key = p.cabang?.nama_cabang || 'Unknown';
          if (!acc[key]) acc[key] = { nama: key, total: 0, count: 0 };
          acc[key].total += Number(p.total || 0) + Number(p.biaya_kirim || 0);
          acc[key].count += 1;
          return acc;
        }, {} as Record<string, any>);
      } else if (compareField === 'jenis_pembayaran') {
        groupedData = (data || []).reduce((acc, p) => {
          const key = p.jenis_pembayaran || 'Unknown';
          if (!acc[key]) acc[key] = { nama: key, total: 0, count: 0 };
          acc[key].total += Number(p.total || 0) + Number(p.biaya_kirim || 0);
          acc[key].count += 1;
          return acc;
        }, {} as Record<string, any>);
      }

      return NextResponse.json({
        success: true,
        data: Object.values(groupedData).sort((a: any, b: any) => b.total - a.total),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Specify type: monthly_trend, comparison',
    });
  } catch (error: any) {
    console.error('💥 [POST ERROR]', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}
