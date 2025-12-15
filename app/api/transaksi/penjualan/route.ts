// app/api/transaksi/penjualan/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - List penjualan
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transaksi_penjualan')
      .select(`
        *,
        customer:customer_id (id, nama, kode_customer),
        pegawai:pegawai_id (
          id,
          nama,
          jabatan,
          cabang:cabang_id (
            id,
            nama_cabang,
            kode_cabang
          )
        ),
        detail_penjualan (
          id,
          jumlah,
          harga,
          subtotal,
          produk:produk_id (
            id,
            nama_produk,
            kode_produk
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    const { data: allData, error } = await query;

    if (error) throw error;

    let dataWithNotaAndTagihan = await Promise.all((allData || []).map(async (item) => {
      const totalPenjualan = item.detail_penjualan?.reduce(
        (sum: number, detail: any) => sum + (detail.subtotal || 0),
        0
      ) || 0;

      const finalTotal = item.total || totalPenjualan;
      const dibayar = parseFloat(item.dibayar || '0');
      const sisaTagihan = finalTotal - dibayar;

      // Fix status_pembayaran: if not billed, should be 'Belum Lunas' regardless of database default
      const statusPembayaran = item.status === 'billed' ? item.status_pembayaran : 'Belum Lunas';

      // Generate PJ format if nota_penjualan is null or missing
      let nota_penjualan = item.nota_penjualan;
      if (!nota_penjualan) {
        const tanggal = new Date(item.tanggal).toISOString().split('T')[0].replace(/-/g, '');
        const nomorUrut = String(item.id).padStart(4, '0');
        nota_penjualan = `PJ-${tanggal}-${nomorUrut}`;
      }

      return {
        ...item,
        nota_penjualan,
        total: totalPenjualan,
        sisa_tagihan: sisaTagihan,
        status_pembayaran: statusPembayaran
      };
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      dataWithNotaAndTagihan = dataWithNotaAndTagihan.filter((item: any) => {
        const notaMatch = item.nota_penjualan?.toLowerCase().includes(searchLower);
        const statusMatch = item.status?.toLowerCase().includes(searchLower);
        const statusPembayaranMatch = item.status_pembayaran?.toLowerCase().includes(searchLower);
        const customerNamaMatch = item.customer?.nama?.toLowerCase().includes(searchLower);
        const customerKodeMatch = item.customer?.kode_customer?.toLowerCase().includes(searchLower);
        const pegawaiNamaMatch = item.pegawai?.nama?.toLowerCase().includes(searchLower);
        const pegawaiJabatanMatch = item.pegawai?.jabatan?.toLowerCase().includes(searchLower);
        const cabangNamaMatch = item.pegawai?.cabang?.nama_cabang?.toLowerCase().includes(searchLower);
        const cabangKodeMatch = item.pegawai?.cabang?.kode_cabang?.toLowerCase().includes(searchLower);
        const jenisPembayaranMatch = item.jenis_pembayaran?.toLowerCase().includes(searchLower);
        const keteranganMatch = item.keterangan?.toLowerCase().includes(searchLower);
        const tanggalMatch = new Date(item.tanggal).toLocaleDateString('id-ID').includes(searchLower);
        const totalMatch = item.total?.toString().includes(searchLower);
        const produkMatch = item.detail_penjualan?.some((detail: any) => 
          detail.produk?.nama_produk?.toLowerCase().includes(searchLower) ||
          detail.produk?.kode_produk?.toLowerCase().includes(searchLower)
        );

        return (
          notaMatch || statusMatch || statusPembayaranMatch || customerNamaMatch ||
          customerKodeMatch || pegawaiNamaMatch || pegawaiJabatanMatch ||
          cabangNamaMatch || cabangKodeMatch || jenisPembayaranMatch ||
          keteranganMatch || tanggalMatch || totalMatch || produkMatch
        );
      });
    }

    const totalRecords = dataWithNotaAndTagihan.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const paginatedData = dataWithNotaAndTagihan.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching penjualan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create penjualan baru
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    if (!body.tanggal || !body.customer_id || !body.pegawai_id) {
      return NextResponse.json(
        { error: 'Tanggal, Customer, dan Pegawai (Sales) wajib diisi' },
        { status: 400 }
      );
    }

    const jenisPembayaranValid = ['tunai', 'kredit', 'transfer'];
    const jenisPembayaran = body.jenis_pembayaran?.toLowerCase() || 'tunai';
    
    if (!jenisPembayaranValid.includes(jenisPembayaran)) {
      return NextResponse.json(
        { error: 'Jenis pembayaran tidak valid. Pilih: tunai, kredit, atau transfer' },
        { status: 400 }
      );
    }

    // ✅ GET CABANG_ID DARI PEGAWAI
    const { data: pegawai, error: pegawaiError } = await supabase
      .from('pegawai')
      .select('cabang_id')
      .eq('id', body.pegawai_id)
      .single();

    if (pegawaiError) {
      console.error('Error fetching pegawai:', pegawaiError);
      return NextResponse.json(
        { error: 'Pegawai tidak ditemukan' },
        { status: 400 }
      );
    }

    const penjualanData = {
      tanggal: body.tanggal,
      customer_id: body.customer_id,
      pegawai_id: body.pegawai_id,
      cabang_id: pegawai.cabang_id, // ✅ TAMBAHKAN CABANG_ID
      total: 0,
      dibayar: 0,
      jenis_pembayaran: jenisPembayaran,
      status: 'pending',
      status_pembayaran: jenisPembayaran === 'tunai' ? 'Belum Lunas' : 'Belum Lunas', // Explicitly set for both cases
      keterangan: body.keterangan || ''
    };

    console.log('📝 Creating penjualan with data:', penjualanData);

    const { data, error } = await supabase
      .from('transaksi_penjualan')
      .insert(penjualanData)
      .select(`
        *,
        customer:customer_id (id, nama, kode_customer),
        pegawai:pegawai_id (
          id,
          nama,
          jabatan,
          cabang:cabang_id (
            id,
            nama_cabang,
            kode_cabang
          )
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `)
      .single();

    if (error) throw error;

    // Generate nota_penjualan like pembelian format: PJ-YYYYMMDD-XXXX
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    const { data: lastPenjualan } = await supabase
      .from('transaksi_penjualan')
      .select('nota_penjualan')
      .like('nota_penjualan', `PJ-${today}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let notaNumber = 1;

    if (lastPenjualan?.nota_penjualan) {
      const lastNumber = parseInt(lastPenjualan.nota_penjualan.split('-').pop() || '0');
      notaNumber = lastNumber + 1;
    }

    const nota_penjualan = `PJ-${today}-${notaNumber.toString().padStart(4, '0')}`;

    // Save nota_penjualan to database
    const { error: updateError } = await supabase
      .from('transaksi_penjualan')
      .update({ nota_penjualan })
      .eq('id', data.id);

    if (updateError) {
      console.error('Error updating nota_penjualan:', updateError);
      // Don't throw here, just log - nota will still be generated dynamically in GET
    } else {
      console.log('✅ Nota penjualan saved to database:', nota_penjualan);
    }

    console.log('✅ Penjualan created with cabang_id:', data.cabang_id);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        nota_penjualan,
        sisa_tagihan: 0
      },
      message: 'Penjualan berhasil dibuat'
    });
  } catch (error: any) {
    console.error('Error creating penjualan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Hapus penjualan DAN kembalikan stock
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID penjualan tidak valid' },
        { status: 400 }
      );
    }

    console.log('DELETE PENJUALAN ID:', id);

    // 1. Get penjualan data dengan detail
    const { data: penjualan, error: fetchError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        id,
        nota_penjualan,
        total,
        dibayar,
        status_pembayaran,
        detail_penjualan (
          id,
          produk_id,
          jumlah,
          harga,
          subtotal
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetch penjualan:', fetchError);
      return NextResponse.json(
        { error: 'Data penjualan tidak ditemukan' },
        { status: 404 }
      );
    }

    console.log('Penjualan:', penjualan.nota_penjualan);
    console.log('Detail items:', penjualan.detail_penjualan?.length || 0);

    // 2. Cek apakah sudah ada cicilan/pembayaran
    const { data: cicilan } = await supabase
      .from('cicilan_penjualan')
      .select('id')
      .eq('penjualan_id', id);

    if (cicilan && cicilan.length > 0) {
      return NextResponse.json(
        { error: 'Tidak bisa hapus penjualan yang sudah ada pembayaran/cicilan' },
        { status: 400 }
      );
    }

    // 3. KEMBALIKAN STOCK untuk setiap produk
    if (penjualan.detail_penjualan && penjualan.detail_penjualan.length > 0) {
      for (const detail of penjualan.detail_penjualan) {
        console.log(`Kembalikan stock produk ID ${detail.produk_id}: +${detail.jumlah}`);

        // Get current stock
        const { data: produk, error: produkError } = await supabase
          .from('produk')
          .select('stok, nama_produk')
          .eq('id', detail.produk_id)
          .single();

        if (produkError) {
          console.error(`Error get produk ${detail.produk_id}:`, produkError);
          continue; // Skip this product but continue with others
        }

        const stokLama = parseFloat(produk.stok?.toString() || '0');
        const stokBaru = stokLama + parseFloat(detail.jumlah?.toString() || '0');

        console.log(`   ${produk.nama_produk}: ${stokLama} -> ${stokBaru}`);

        // Update stock
        const { error: updateStockError } = await supabase
          .from('produk')
          .update({ stok: stokBaru })
          .eq('id', detail.produk_id);

        if (updateStockError) {
          console.error(`Error update stock produk ${detail.produk_id}:`, updateStockError);
        } else {
          console.log('   Stock updated');
        }

        // Insert history stock (opsional - untuk audit trail)
        await supabase
          .from('history_stok')
          .insert({
            produk_id: detail.produk_id,
            tanggal: new Date().toISOString(),
            jumlah: parseFloat(detail.jumlah?.toString() || '0'),
            tipe: 'masuk',
            keterangan: `Pengembalian stock dari penghapusan penjualan #${penjualan.nota_penjualan}`
          });
      }
    }

    // 4. Delete detail_penjualan (akan auto-delete karena ON DELETE CASCADE, tapi kita explicit)
    const { error: deleteDetailError } = await supabase
      .from('detail_penjualan')
      .delete()
      .eq('penjualan_id', id);

    if (deleteDetailError) {
      console.error('Error delete detail:', deleteDetailError);
    } else {
      console.log('Detail penjualan deleted');
    }

    // 5. Delete transaksi_penjualan
    const { error: deletePenjualanError } = await supabase
      .from('transaksi_penjualan')
      .delete()
      .eq('id', id);

    if (deletePenjualanError) {
      console.error('Error delete penjualan:', deletePenjualanError);
      throw deletePenjualanError;
    }

    console.log('Penjualan deleted');
    console.log('DELETE SUKSES! Stock sudah dikembalikan.');

    return NextResponse.json({
      success: true,
      message: 'Penjualan berhasil dihapus dan stock dikembalikan'
    });

  } catch (error: any) {
    console.error('ERROR DELETE PENJUALAN:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus penjualan' },
      { status: 500 }
    );
  }
}