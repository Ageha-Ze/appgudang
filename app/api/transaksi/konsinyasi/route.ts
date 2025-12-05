// app/api/transaksi/konsinyasi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - List transaksi konsinyasi
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Fetch all data first WITH detail_konsinyasi for calculation
    let query = supabase
      .from('transaksi_konsinyasi')
      .select(`
        *,
        toko:toko_id (
          id,
          kode_toko,
          nama_toko
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        ),
        pegawai:pegawai_id (
          id,
          nama
        ),
        detail_konsinyasi (
          id,
          jumlah_titip,
          jumlah_terjual,
          jumlah_sisa,
          jumlah_kembali,
          subtotal_nilai_titip,
          harga_konsinyasi
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    const { data: allData, error } = await query;

    if (error) throw error;

    // Apply search filter
    let filteredData = allData || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((item: any) => 
        item.kode_konsinyasi?.toLowerCase().includes(searchLower) ||
        item.toko?.nama_toko?.toLowerCase().includes(searchLower) ||
        item.cabang?.nama_cabang?.toLowerCase().includes(searchLower) ||
        item.status?.toLowerCase().includes(searchLower) ||
        new Date(item.tanggal_titip).toLocaleDateString('id-ID').includes(searchLower)
      );
    }

    // Pagination
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const paginatedData = filteredData.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching transaksi konsinyasi:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create transaksi konsinyasi
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const body = await request.json();

    console.log('📦 Creating konsinyasi:', body);

    // ✅ Validasi
    if (!body.tanggal_titip || !body.toko_id || !body.cabang_id) {
      return NextResponse.json(
        { error: 'Tanggal, Toko, dan Cabang wajib diisi' },
        { status: 400 }
      );
    }

    if (!body.detail || body.detail.length === 0) {
      return NextResponse.json(
        { error: 'Detail barang harus diisi minimal 1 item' },
        { status: 400 }
      );
    }

    // ✅ Validasi: Cek stock availability (info saja, tidak dikurangi)
    for (const item of body.detail) {
      const { data: produk } = await supabase
        .from('produk')
        .select('stok, nama_produk')
        .eq('id', item.produk_id)
        .single();

      if (produk) {
        const stokTersedia = parseFloat(produk.stok?.toString() || '0');
        const jumlahDiminta = parseFloat(item.jumlah_titip?.toString() || '0');

        if (stokTersedia < jumlahDiminta) {
          return NextResponse.json({
            error: `Stock ${produk.nama_produk} tidak mencukupi! Tersedia: ${stokTersedia}, Diminta: ${jumlahDiminta}`
          }, { status: 400 });
        }
      }
    }

    // ✅ Generate kode konsinyasi: KON-YYYYMMDD-0001
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    const { data: lastKonsinyasi } = await supabase
      .from('transaksi_konsinyasi')
      .select('kode_konsinyasi')
      .like('kode_konsinyasi', `KON-${today}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nomorUrut = 1;
    if (lastKonsinyasi?.kode_konsinyasi) {
      const lastNumber = parseInt(lastKonsinyasi.kode_konsinyasi.split('-').pop() || '0');
      nomorUrut = lastNumber + 1;
    }

    const kode_konsinyasi = `KON-${today}-${nomorUrut.toString().padStart(4, '0')}`;

    console.log('📝 Generated code:', kode_konsinyasi);

    // ✅ Calculate total nilai titip
    const total_nilai_titip = body.detail.reduce((sum: number, item: any) => 
      sum + (parseFloat(item.jumlah_titip) * parseFloat(item.harga_konsinyasi)), 0
    );

    // ✅ Insert transaksi konsinyasi
    const { data: konsinyasi, error: konsinyasiError } = await supabase
      .from('transaksi_konsinyasi')
      .insert({
        kode_konsinyasi,
        tanggal_titip: body.tanggal_titip,
        toko_id: body.toko_id,
        cabang_id: body.cabang_id,
        pegawai_id: body.pegawai_id || null,
        total_nilai_titip,
        status: 'Aktif',
        keterangan: body.keterangan || null,
      })
      .select()
      .single();

    if (konsinyasiError) {
      console.error('Error inserting konsinyasi:', konsinyasiError);
      throw konsinyasiError;
    }

    console.log('✅ Konsinyasi created:', konsinyasi.id);

    // ✅ Insert detail konsinyasi
    const detailData = body.detail.map((item: any) => ({
      konsinyasi_id: konsinyasi.id,
      produk_id: item.produk_id,
      jumlah_titip: parseFloat(item.jumlah_titip),
      jumlah_sisa: parseFloat(item.jumlah_titip), // Awalnya sama dengan jumlah titip
      jumlah_terjual: 0,
      jumlah_kembali: 0,
      harga_konsinyasi: parseFloat(item.harga_konsinyasi),
      harga_jual_toko: parseFloat(item.harga_jual_toko),
      subtotal_nilai_titip: parseFloat(item.jumlah_titip) * parseFloat(item.harga_konsinyasi),
      keuntungan_toko: 0,
    }));

    const { error: detailError } = await supabase
      .from('detail_konsinyasi')
      .insert(detailData);

    if (detailError) {
      console.error('Error inserting detail:', detailError);
      // Rollback: hapus transaksi konsinyasi
      await supabase
        .from('transaksi_konsinyasi')
        .delete()
        .eq('id', konsinyasi.id);
      
      throw detailError;
    }

    console.log('✅ Detail konsinyasi created');

    // ❌ TIDAK ADA UPDATE STOCK DI SINI!
    // Stock TIDAK dikurangi saat kirim konsinyasi
    // Stock baru dikurangi saat ada penjualan dari toko
    console.log('ℹ️ Stock NOT reduced (konsinyasi = pinjam barang, masih milik kita)');

    // ✅ Fetch complete data
    const { data: completeData } = await supabase
      .from('transaksi_konsinyasi')
      .select(`
        *,
        toko:toko_id (id, nama_toko, kode_toko),
        cabang:cabang_id (id, nama_cabang, kode_cabang),
        pegawai:pegawai_id (id, nama),
        detail_konsinyasi (
          *,
          produk:produk_id (id, nama_produk, kode_produk, satuan)
        )
      `)
      .eq('id', konsinyasi.id)
      .single();

    console.log('✅ Konsinyasi created successfully');

    return NextResponse.json({
      success: true,
      message: 'Konsinyasi berhasil dibuat. Stock akan dikurangi saat ada penjualan dari toko.',
      data: completeData,
      note: 'Stock produk tidak dikurangi karena barang masih milik kita (hanya dititipkan ke toko)'
    });
  } catch (error: any) {
    console.error('❌ Error creating konsinyasi:', error);
    return NextResponse.json({ 
      error: error.message || 'Gagal membuat konsinyasi'
    }, { status: 500 });
  }
}

// DELETE - Hapus transaksi konsinyasi
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID konsinyasi tidak valid' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting konsinyasi:', id);

    // ✅ 1. Get detail konsinyasi lengkap
    const { data: konsinyasi, error: konsinyasiError } = await supabase
      .from('transaksi_konsinyasi')
      .select(`
        *,
        detail_konsinyasi (
          id,
          produk_id,
          jumlah_titip,
          jumlah_terjual,
          jumlah_sisa,
          jumlah_kembali,
          produk:produk_id (
            id,
            nama_produk,
            stok
          )
        )
      `)
      .eq('id', id)
      .single();

    if (konsinyasiError || !konsinyasi) {
      console.error('Error fetching konsinyasi:', konsinyasiError);
      return NextResponse.json(
        { error: 'Konsinyasi tidak ditemukan' },
        { status: 404 }
      );
    }

    console.log('📦 Konsinyasi:', konsinyasi.kode_konsinyasi);
    console.log('📊 Status:', konsinyasi.status);

    // ✅ 2. Validasi: Tidak bisa hapus jika status final
    if (konsinyasi.status === 'selesai') {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus konsinyasi yang sudah selesai' },
        { status: 400 }
      );
    }

    // ✅ 3. Validasi: Cek apakah ada penjualan
    const { data: penjualan } = await supabase
      .from('penjualan_konsinyasi')
      .select('id, jumlah_terjual, total_nilai_kita, kas_id')
      .in('detail_konsinyasi_id', konsinyasi.detail_konsinyasi.map((d: any) => d.id));

    if (penjualan && penjualan.length > 0) {
      const totalTerjual = penjualan.reduce((sum, p) => 
        sum + parseFloat(p.jumlah_terjual?.toString() || '0'), 0
      );
      
      return NextResponse.json({
        error: `Tidak dapat menghapus konsinyasi yang sudah ada penjualan (${totalTerjual} pcs terjual). Selesaikan konsinyasi terlebih dahulu.`
      }, { status: 400 });
    }

    console.log('✅ No sales found, safe to delete');

    // ✅ 4. Hapus retur konsinyasi terkait (jika ada)
    const { error: deleteReturError } = await supabase
      .from('retur_konsinyasi')
      .delete()
      .in('detail_konsinyasi_id', konsinyasi.detail_konsinyasi.map((d: any) => d.id));

    if (deleteReturError) {
      console.error('⚠️ Warning: Error deleting retur:', deleteReturError);
    } else {
      console.log('✅ Retur deleted (if any)');
    }

    // ❌ TIDAK ADA STOCK RETURN DI SINI!
    // Karena stock tidak dikurangi saat kirim konsinyasi,
    // maka tidak perlu dikembalikan saat delete
    console.log('ℹ️ Stock NOT returned (was never reduced)');

    // ✅ 5. Hapus detail konsinyasi
    const { error: deleteDetailError } = await supabase
      .from('detail_konsinyasi')
      .delete()
      .eq('konsinyasi_id', id);

    if (deleteDetailError) {
      console.error('Error deleting detail:', deleteDetailError);
      throw deleteDetailError;
    }

    console.log('✅ Detail konsinyasi deleted');

    // ✅ 6. Hapus transaksi konsinyasi
    const { error: deleteKonsinyasiError } = await supabase
      .from('transaksi_konsinyasi')
      .delete()
      .eq('id', id);

    if (deleteKonsinyasiError) {
      console.error('Error deleting konsinyasi:', deleteKonsinyasiError);
      throw deleteKonsinyasiError;
    }

    console.log('✅ Konsinyasi deleted');

    return NextResponse.json({
      success: true,
      message: 'Konsinyasi berhasil dihapus',
      note: 'Stock tidak berubah karena tidak pernah dikurangi saat kirim konsinyasi'
    });
  } catch (error: any) {
    console.error('❌ Error deleting konsinyasi:', error);
    return NextResponse.json({ 
      error: error.message || 'Terjadi kesalahan saat menghapus konsinyasi' 
    }, { status: 500 });
  }
}