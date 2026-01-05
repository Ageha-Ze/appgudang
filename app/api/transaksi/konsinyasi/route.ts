import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    console.log('📥 Received body:', body);

    // Validasi input wajib
    if (!body.tanggal_titip || !body.toko_id || !body.cabang_id) {
      return NextResponse.json(
        { error: 'Tanggal titip, Toko, dan Cabang wajib diisi' },
        { status: 400 }
      );
    }

    if (!body.detail || !Array.isArray(body.detail) || body.detail.length === 0) {
      return NextResponse.json(
        { error: 'Minimal 1 produk harus ditambahkan' },
        { status: 400 }
      );
    }

    // Generate kode_konsinyasi berdasarkan tanggal_titip dari user
    const tanggalTitip = new Date(body.tanggal_titip);
    const year = tanggalTitip.getFullYear();
    const month = String(tanggalTitip.getMonth() + 1).padStart(2, '0');
    const day = String(tanggalTitip.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    console.log('📅 Date prefix:', datePrefix);

    // Cari nomor terakhir untuk tanggal ini
    const { data: lastKonsinyasi, error: queryError } = await supabase
      .from('transaksi_konsinyasi')
      .select('kode_konsinyasi')
      .like('kode_konsinyasi', `KON-${datePrefix}-%`)
      .order('kode_konsinyasi', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('❌ Query error:', queryError);
      throw queryError;
    }

    console.log('🔍 Last konsinyasi:', lastKonsinyasi);

    let kodeNumber = 1;
    if (lastKonsinyasi?.kode_konsinyasi) {
      const lastNumber = parseInt(lastKonsinyasi.kode_konsinyasi.split('-').pop() || '0');
      kodeNumber = lastNumber + 1;
    }

    const kode_konsinyasi = `KON-${datePrefix}-${kodeNumber.toString().padStart(4, '0')}`;
    console.log('🏷️ Generated kode:', kode_konsinyasi);

    // Hitung total_nilai_titip
    const total_nilai_titip = body.detail.reduce((sum: number, item: any) => {
      const jumlah = parseFloat(item.jumlah_titip?.toString() || '0');
      const harga = parseFloat(item.harga_konsinyasi?.toString() || '0');
      return sum + (jumlah * harga);
    }, 0);

    console.log('💰 Total nilai titip:', total_nilai_titip);

    // Insert transaksi_konsinyasi
    const konsinyasiData = {
      kode_konsinyasi,
      tanggal_titip: body.tanggal_titip,
      toko_id: parseInt(body.toko_id),
      cabang_id: parseInt(body.cabang_id),
      pegawai_id: body.pegawai_id ? parseInt(body.pegawai_id) : null,
      total_nilai_titip,
      status: 'Aktif',
      keterangan: body.keterangan || null
    };

    console.log('💾 Inserting konsinyasi:', konsinyasiData);

    const { data: konsinyasi, error: insertError } = await supabase
      .from('transaksi_konsinyasi')
      .insert(konsinyasiData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return NextResponse.json(
        { error: `Gagal membuat konsinyasi: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Konsinyasi created:', konsinyasi.id);

    // Insert detail_konsinyasi (stock akan dikurangi saat konsinyasi diselesaikan)
    for (const [index, item] of body.detail.entries()) {
      console.log(`📦 Processing item ${index + 1}/${body.detail.length}`);

      const jumlahTitip = parseFloat(item.jumlah_titip?.toString() || '0');
      const hargaKonsinyasi = parseFloat(item.harga_konsinyasi?.toString() || '0');
      const hargaJualToko = parseFloat(item.harga_jual_toko?.toString() || '0');

      const detailData = {
        konsinyasi_id: konsinyasi.id,
        produk_id: parseInt(item.produk_id),
        jumlah_titip: jumlahTitip,
        jumlah_terjual: 0,
        jumlah_sisa: jumlahTitip,
        jumlah_kembali: 0,
        harga_konsinyasi: hargaKonsinyasi,
        harga_jual_toko: hargaJualToko,
        subtotal_nilai_titip: jumlahTitip * hargaKonsinyasi,
        keuntungan_toko: 0 // Belum ada yang terjual
      };

      console.log(`  💾 Inserting detail for produk ${item.produk_id}`);

      const { error: detailError } = await supabase
        .from('detail_konsinyasi')
        .insert(detailData);

      if (detailError) {
        console.error('❌ Detail insert error:', detailError);
        // Rollback - hapus konsinyasi
        await supabase.from('transaksi_konsinyasi').delete().eq('id', konsinyasi.id);
        return NextResponse.json(
          { error: `Gagal menambahkan detail produk: ${detailError.message}` },
          { status: 500 }
        );
      }

      console.log(`  ✅ Item ${index + 1} processed successfully`);
    }

    console.log('🎉 All items processed successfully');

    return NextResponse.json({
      success: true,
      data: konsinyasi,
      message: 'Konsinyasi berhasil dibuat'
    });

  } catch (error: any) {
    console.error('💥 Error creating konsinyasi:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Terjadi kesalahan saat membuat konsinyasi',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = await supabaseAuthenticated();
  const searchParams = request.nextUrl.searchParams;
  const cabangId = searchParams.get('cabang_id');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = searchParams.get('search') || '';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('transaksi_konsinyasi')
    .select(`
      id,
      kode_konsinyasi,
      tanggal_titip,
      total_nilai_titip,
      status,
      toko:toko_id (
        nama_toko
      ),
      cabang:cabang_id (
        nama_cabang
      ),
      detail_konsinyasi (
        id,
        jumlah_terjual,
        harga_konsinyasi
      )
    `, { count: 'exact' });

  if (search) {
    query = query.or(`kode_konsinyasi.ilike.%${search}%,toko(nama_toko).ilike.%${search}%`);
  }

  if (cabangId) {
    query = query.eq('cabang_id', cabangId);
  }

  query = query.order('tanggal_titip', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching transaksi konsinyasi:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit),
      totalRecords: count,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = await supabaseAuthenticated();
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID konsinyasi diperlukan' }, { status: 400 });
  }

  // Get detail konsinyasi
  const { data: konsinyasiData, error: fetchError } = await supabase
    .from('transaksi_konsinyasi')
    .select(`
      id,
      status,
      kode_konsinyasi,
      cabang_id,
      detail_konsinyasi(
        id,
        produk_id,
        jumlah_terjual,
        jumlah_kembali
      )
    `)
    .eq('id', id)
    .single();

  if (fetchError || !konsinyasiData) {
    console.error('Error fetching consignment for deletion:', fetchError);
    return NextResponse.json({ error: 'Konsinyasi tidak ditemukan' }, { status: 404 });
  }

  // Jika status "Selesai", kembalikan stock untuk barang yang sudah dikurangi saat selesai
  if (konsinyasiData.status === 'Selesai' && konsinyasiData.detail_konsinyasi) {
    for (const detail of konsinyasiData.detail_konsinyasi) {
      if (detail.produk_id) {
        const jumlahTerjual = parseFloat(detail.jumlah_terjual?.toString() || '0');
        const jumlahKembali = parseFloat(detail.jumlah_kembali?.toString() || '0');

        // Get product details
        const { data: produkData, error: produkError } = await supabase
          .from('produk')
          .select('id, nama_produk, kode_produk, satuan, stok')
          .eq('id', detail.produk_id)
          .single();

        if (produkError || !produkData) {
          console.error('Error fetching product details:', produkError);
          continue;
        }

        // Jika ada barang yang terjual, kembalikan stock (karena konsinyasi dihapus)
        if (jumlahTerjual > 0) {
          // Record stock masuk transaction to restore stock
          const { error: insertStockError } = await supabase
            .from('stock_barang')
            .insert({
              produk_id: detail.produk_id,
              cabang_id: konsinyasiData.cabang_id,
              jumlah: jumlahTerjual,
              tanggal: new Date().toISOString().split('T')[0],
              tipe: 'masuk',
              keterangan: `Konsinyasi Dihapus - ${konsinyasiData.kode_konsinyasi}`,
              nama_produk: produkData.nama_produk,
              kode_produk: produkData.kode_produk || '',
              satuan: produkData.satuan || 'Kg',
            });

          if (insertStockError) {
            console.error('Error restoring stock transaction:', insertStockError);
            // Continue with other items, don't fail the whole delete
          }


        }

        // Jika ada barang yang diretur dan dikembalikan, kurangi stock lagi (karena retur dihapus)
        if (jumlahKembali > 0) {
          // Record stock keluar transaction for retur reversal
          const { error: insertReturError } = await supabase
            .from('stock_barang')
            .insert({
              produk_id: detail.produk_id,
              cabang_id: konsinyasiData.cabang_id,
              jumlah: jumlahKembali,
              tanggal: new Date().toISOString().split('T')[0],
              tipe: 'keluar',
              keterangan: `Retur Konsinyasi Dihapus - ${konsinyasiData.kode_konsinyasi}`,
              nama_produk: produkData.nama_produk,
              kode_produk: produkData.kode_produk || '',
              satuan: produkData.satuan || 'Kg',
            });

          if (insertReturError) {
            console.error('Error reversing retur stock transaction:', insertReturError);
            // Continue with other items
          }

          // Update master produk.stok for retur reversal
          const currentMasterStock = parseFloat(produkData.stok?.toString() || '0');
          const newMasterStock = currentMasterStock - jumlahKembali;

          await supabase
            .from('produk')
            .update({
              stok: newMasterStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', detail.produk_id);
        }
      }
    }
  }

  // Delete related records first (since CASCADE delete is not working)
  console.log('🗑️ Deleting related records...');

  // Delete penjualan_konsinyasi records
  const { error: deletePenjualanError } = await supabase
    .from('penjualan_konsinyasi')
    .delete()
    .in('detail_konsinyasi_id',
      konsinyasiData.detail_konsinyasi?.map(d => d.id) || []
    );

  if (deletePenjualanError) {
    console.error('Error deleting penjualan_konsinyasi:', deletePenjualanError);
    return NextResponse.json({
      error: `Gagal menghapus data penjualan terkait: ${deletePenjualanError.message}`
    }, { status: 500 });
  }

  // Delete retur_konsinyasi records
  const { error: deleteReturError } = await supabase
    .from('retur_konsinyasi')
    .delete()
    .in('detail_konsinyasi_id',
      konsinyasiData.detail_konsinyasi?.map(d => d.id) || []
    );

  if (deleteReturError) {
    console.error('Error deleting retur_konsinyasi:', deleteReturError);
    return NextResponse.json({
      error: `Gagal menghapus data retur terkait: ${deleteReturError.message}`
    }, { status: 500 });
  }

  // Delete detail_konsinyasi records
  const { error: deleteDetailError } = await supabase
    .from('detail_konsinyasi')
    .delete()
    .eq('konsinyasi_id', id);

  if (deleteDetailError) {
    console.error('Error deleting detail_konsinyasi:', deleteDetailError);
    return NextResponse.json({
      error: `Gagal menghapus detail konsinyasi: ${deleteDetailError.message}`
    }, { status: 500 });
  }

  // Finally delete the main konsinyasi record
  const { error: deleteError } = await supabase
    .from('transaksi_konsinyasi')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error deleting konsinyasi:', deleteError);
    return NextResponse.json({
      error: `Gagal menghapus konsinyasi: ${deleteError.message}`
    }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    message: 'Konsinyasi berhasil dihapus' 
  });
}
