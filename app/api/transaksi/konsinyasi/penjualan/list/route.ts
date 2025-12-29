// app/api/transaksi/konsinyasi/penjualan/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const konsinyasiId = searchParams.get('konsinyasi_id');

    // ✅ Validasi
    if (!konsinyasiId) {
      return NextResponse.json({ 
        error: 'konsinyasi_id required' 
      }, { status: 400 });
    }


    // ✅ Get all detail_konsinyasi IDs untuk konsinyasi ini
    const { data: details, error: detailError } = await supabase
      .from('detail_konsinyasi')
      .select('id, produk_id')
      .eq('konsinyasi_id', konsinyasiId);

    if (detailError) throw detailError;

    const detailIds = details?.map(d => d.id) || [];

    if (detailIds.length === 0) {
      return NextResponse.json({ 
        data: [],
        summary: {
          total_transaksi: 0,
          total_penjualan: 0,
          total_nilai_kita: 0,
          total_keuntungan_toko: 0
        }
      });
    }


    // ✅ Get all penjualan untuk detail-detail tersebut
    const { data: penjualanList, error } = await supabase
      .from('penjualan_konsinyasi')
      .select(`
        *,
        detail_konsinyasi:detail_konsinyasi_id (
          id,
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

    if (error) throw error;


    // ✅ Calculate summary
    const summary = {
      total_transaksi: penjualanList?.length || 0,
      total_jumlah_terjual: penjualanList?.reduce(
        (sum, p) => sum + parseFloat(p.jumlah_terjual?.toString() || '0'), 
        0
      ) || 0,
      total_penjualan: penjualanList?.reduce(
        (sum, p) => sum + parseFloat(p.total_penjualan?.toString() || '0'), 
        0
      ) || 0,
      total_nilai_kita: penjualanList?.reduce(
        (sum, p) => sum + parseFloat(p.total_nilai_kita?.toString() || '0'), 
        0
      ) || 0,
      total_keuntungan_toko: penjualanList?.reduce(
        (sum, p) => sum + parseFloat(p.keuntungan_toko?.toString() || '0'), 
        0
      ) || 0
    };


    // ✅ Optional: Group by produk untuk analytics
    const byProduk = penjualanList?.reduce((acc: any, penjualan) => {
      const produkId = penjualan.detail_konsinyasi?.produk?.id;
      const produkNama = penjualan.detail_konsinyasi?.produk?.nama_produk || 'Unknown';
      
      if (!acc[produkId]) {
        acc[produkId] = {
          produk_id: produkId,
          produk_nama: produkNama,
          jumlah_terjual: 0,
          total_nilai: 0,
          jumlah_transaksi: 0
        };
      }
      
      acc[produkId].jumlah_terjual += parseFloat(penjualan.jumlah_terjual?.toString() || '0');
      acc[produkId].total_nilai += parseFloat(penjualan.total_nilai_kita?.toString() || '0');
      acc[produkId].jumlah_transaksi += 1;
      
      return acc;
    }, {});

    const produkSummary = byProduk ? Object.values(byProduk) : [];

    return NextResponse.json({ 
      success: true,
      data: penjualanList || [],
      summary: summary,
      by_produk: produkSummary,
      meta: {
        konsinyasi_id: konsinyasiId,
        jumlah_detail: detailIds.length,
        jumlah_penjualan: penjualanList?.length || 0
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching penjualan list:', error);
    return NextResponse.json({ 
      error: error.message || 'Gagal mengambil data penjualan'
    }, { status: 500 });
  }
}
