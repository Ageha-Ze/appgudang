// app/api/transaksi/konsinyasi/retur/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();


    // ✅ Validasi input
    if (!body.detail_konsinyasi_id || !body.jumlah_retur || !body.tanggal_retur) {
      return NextResponse.json(
        { error: 'Detail konsinyasi, jumlah retur, dan tanggal retur wajib diisi' },
        { status: 400 }
      );
    }

    const jumlah = parseFloat(body.jumlah_retur);

    if (jumlah <= 0) {
      return NextResponse.json(
        { error: 'Jumlah retur harus lebih dari 0' },
        { status: 400 }
      );
    }

    // ✅ Get detail konsinyasi dengan parent data

    const { data: detail, error: detailError } = await supabase
      .from('detail_konsinyasi')
      .select(`
        *,
        konsinyasi:konsinyasi_id (
          id,
          cabang_id,
          status,
          tanggal_titip
        ),
        produk:produk_id (
          id,
          nama_produk,
          stok
        )
      `)
      .eq('id', body.detail_konsinyasi_id)
      .single();


    if (detailError || !detail) {
      console.error('❌ Error fetching detail:', detailError);

      // Let's also check if the record exists at all
      const { data: allDetails } = await supabase
        .from('detail_konsinyasi')
        .select('id')
        .limit(10);


      return NextResponse.json(
        { error: `Detail konsinyasi tidak ditemukan. ID: ${body.detail_konsinyasi_id}` },
        { status: 404 }
      );
    }

    // ✅ Validasi: Cek status konsinyasi
    if (detail.konsinyasi?.status === 'selesai' || detail.konsinyasi?.status === 'dibatalkan') {
      return NextResponse.json(
        { error: `Tidak bisa retur, konsinyasi sudah ${detail.konsinyasi.status}` },
        { status: 400 }
      );
    }

    // ✅ Validasi: Jumlah tidak melebihi sisa YANG BELUM TERJUAL
    // jumlah_sisa adalah jumlah yang masih di toko ( belum terjual )
    // tetapi yang sudah dikirim ke toko adalah jumlah_titip
    // jadi kita perlu menghitung berapa yang benar-benar bisa diretur

    const sudahTerjual = parseFloat(detail.jumlah_terjual?.toString() || '0');
    const totalTerkirim = parseFloat(detail.jumlah_titip?.toString() || '0');
    const maksimumBisaDiretur = totalTerkirim - sudahTerjual;


    if (jumlah > maksimumBisaDiretur) {
      return NextResponse.json(
        {
          error: `Jumlah retur (${jumlah}) melebihi yang bisa diretur (${maksimumBisaDiretur}). Yang bisa diretur = total terkirim - yang sudah terjual`
        },
        { status: 400 }
      );
    }

    // ✅ Validasi: Cek duplikasi retur di hari yang sama
    const { data: existingRetur } = await supabase
      .from('retur_konsinyasi')
      .select('id')
      .eq('detail_konsinyasi_id', body.detail_konsinyasi_id)
      .eq('tanggal_retur', body.tanggal_retur)
      .eq('jumlah_retur', jumlah)
      .maybeSingle();

    if (existingRetur) {
      return NextResponse.json({
        error: 'Retur dengan data yang sama sudah pernah dicatat hari ini'
      }, { status: 400 });
    }

    // ✅ Insert retur konsinyasi
    const { data: retur, error: returError } = await supabase
      .from('retur_konsinyasi')
      .insert({
        detail_konsinyasi_id: body.detail_konsinyasi_id,
        tanggal_retur: body.tanggal_retur,
        jumlah_retur: jumlah,
        kondisi: body.kondisi || 'Baik',
        jenis_retur: body.jenis_retur || 'Normal',
        keterangan: body.keterangan || null,
      })
      .select()
      .single();

    if (returError) {
      console.error('Error inserting retur:', returError);
      throw returError;
    }


    // ✅ Update detail konsinyasi
    const newJumlahSisa = detail.jumlah_sisa - jumlah;
    const newJumlahKembali = detail.jumlah_kembali + jumlah;


    const { error: updateError } = await supabase
      .from('detail_konsinyasi')
      .update({
        jumlah_sisa: newJumlahSisa,
        jumlah_kembali: newJumlahKembali,
      })
      .eq('id', body.detail_konsinyasi_id);

    if (updateError) {
      console.error('Error updating detail:', updateError);
      // Rollback: hapus retur yang baru dibuat
      await supabase
        .from('retur_konsinyasi')
        .delete()
        .eq('id', retur.id);
      throw new Error('Gagal update detail konsinyasi');
    }

    // ✅ RETUR KONSINYASI: Tidak mengubah stock produk, hanya status konsinyasi
    // Items yang diretur hanya mengubah status detail konsinyasi (sisa → kembali)
    // Stock tetap sama karena barang sudah dikembalikan dari toko ke gudang saat pencatatan retur


    return NextResponse.json({
      success: true,
      message: `Retur berhasil dicatat (status konsinyasi diperbarui)`,
      data: {
        retur_id: retur.id,
        produk: detail.produk?.nama_produk,
        jumlah_retur: jumlah,
        kondisi: body.kondisi,
        stock_returned: false,
        new_stock: parseFloat(detail.produk?.stok?.toString() || '0')
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating retur:', error);
    return NextResponse.json({ 
      error: error.message || 'Gagal mencatat retur konsinyasi'
    }, { status: 500 });
  }
}
