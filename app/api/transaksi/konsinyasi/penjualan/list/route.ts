// app/api/transaksi/konsinyasi/penjualan/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const konsinyasiId = searchParams.get('konsinyasi_id');

    // Validasi parameter
    if (!konsinyasiId) {
      return NextResponse.json({ 
        error: 'Parameter konsinyasi_id wajib diisi' 
      }, { status: 400 });
    }

    console.log('📋 Fetching penjualan for konsinyasi_id:', konsinyasiId);

    // Get semua detail_konsinyasi_id untuk konsinyasi ini
    const { data: detailList, error: detailError } = await supabase
      .from('detail_konsinyasi')
      .select('id')
      .eq('konsinyasi_id', konsinyasiId);

    if (detailError) {
      console.error('❌ Error fetching details:', detailError);
      throw detailError;
    }

    const detailIds = detailList?.map(d => d.id) || [];
    console.log(`📦 Found ${detailIds.length} detail records:`, detailIds);

    if (detailIds.length === 0) {
      return NextResponse.json({ 
        success: true,
        data: [],
        summary: {
          total_transaksi: 0,
          total_jumlah_terjual: 0,
          total_penjualan: 0,
          total_nilai_kita: 0,
          total_keuntungan_toko: 0
        },
        by_produk: [],
        meta: {
          konsinyasi_id: konsinyasiId,
          total_records_found: 0,
          valid_records: 0
        }
      });
    }

    // Query penjualan dengan detail_konsinyasi_id
    const { data: penjualanList, error } = await supabase
      .from('penjualan_konsinyasi')
      .select(`
        *,
        detail_konsinyasi:detail_konsinyasi_id (
          id,
          konsinyasi_id,
          jumlah_titip,
          jumlah_terjual,
          jumlah_sisa,
          harga_konsinyasi,
          harga_jual_toko,
          produk:produk_id (
            id,
            nama_produk,
            kode_produk,
            satuan
          )
        ),
        kas:kas_id (
          id,
          nama_kas,
          tipe_kas
        )
      `)
      .in('detail_konsinyasi_id', detailIds)
      .order('tanggal_jual', { ascending: false });

    if (error) {
      console.error('❌ Query error:', error);
      throw error;
    }

    console.log(`✅ Found ${penjualanList?.length || 0} penjualan records`);

    // Semua data sudah valid karena kita query berdasarkan detailIds
    const validPenjualan = penjualanList || [];

    // Hitung summary dengan safe parsing
    const summary = {
      total_transaksi: validPenjualan.length,
      total_jumlah_terjual: validPenjualan.reduce((sum, p) => {
        const jumlah = parseFloat(p.jumlah_terjual?.toString() || '0');
        return sum + (isNaN(jumlah) ? 0 : jumlah);
      }, 0),
      total_penjualan: validPenjualan.reduce((sum, p) => {
        const total = parseFloat(p.total_penjualan?.toString() || '0');
        return sum + (isNaN(total) ? 0 : total);
      }, 0),
      total_nilai_kita: validPenjualan.reduce((sum, p) => {
        const nilai = parseFloat(p.total_nilai_kita?.toString() || '0');
        return sum + (isNaN(nilai) ? 0 : nilai);
      }, 0),
      total_keuntungan_toko: validPenjualan.reduce((sum, p) => {
        const keuntungan = parseFloat(p.keuntungan_toko?.toString() || '0');
        return sum + (isNaN(keuntungan) ? 0 : keuntungan);
      }, 0)
    };

    // Group by produk untuk analytics
    const produkMap = new Map();
    
    validPenjualan.forEach(penjualan => {
      const produk = penjualan.detail_konsinyasi?.produk;
      if (!produk) return;

      const produkId = produk.id;
      const jumlah = parseFloat(penjualan.jumlah_terjual?.toString() || '0');
      const nilai = parseFloat(penjualan.total_nilai_kita?.toString() || '0');

      if (!produkMap.has(produkId)) {
        produkMap.set(produkId, {
          produk_id: produkId,
          kode_produk: produk.kode_produk,
          nama_produk: produk.nama_produk,
          satuan: produk.satuan,
          jumlah_terjual: 0,
          total_nilai: 0,
          jumlah_transaksi: 0
        });
      }

      const existing = produkMap.get(produkId);
      existing.jumlah_terjual += isNaN(jumlah) ? 0 : jumlah;
      existing.total_nilai += isNaN(nilai) ? 0 : nilai;
      existing.jumlah_transaksi += 1;
    });

    const produkSummary = Array.from(produkMap.values());

    return NextResponse.json({ 
      success: true,
      data: validPenjualan,
      summary: summary,
      by_produk: produkSummary,
      meta: {
        konsinyasi_id: konsinyasiId,
        total_records_found: penjualanList?.length || 0,
        valid_records: validPenjualan.length
      }
    });

  } catch (error: any) {
    console.error('❌ Error fetching penjualan list:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Gagal mengambil data penjualan',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}