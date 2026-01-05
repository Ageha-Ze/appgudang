// app/api/transaksi/konsinyasi/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Detail konsinyasi by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;

    const { data, error } = await supabase
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
          nama_cabang
        ),
        pegawai:pegawai_id (
          id,
          nama
        ),
        detail_konsinyasi (
          *,
          produk:produk_id (
            id,
            nama_produk,
            kode_produk,
            satuan,
            stok
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update status konsinyasi dengan business logic
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;
    const body = await request.json();

    console.log('🔄 Update status konsinyasi:', id, 'to', body.status);

    // Validasi input
    if (!body.status) {
      return NextResponse.json(
        { error: 'Status wajib diisi' },
        { status: 400 }
      );
    }

    // Validasi status yang diperbolehkan
    const validStatuses = ['Aktif', 'Selesai', 'Batal'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Status tidak valid. Harus salah satu dari: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get konsinyasi data lengkap
    const { data: konsinyasi, error: getError } = await supabase
      .from('transaksi_konsinyasi')
      .select(`
        *,
        detail_konsinyasi (
          id,
          produk_id,
          jumlah_titip,
          jumlah_terjual,
          jumlah_kembali,
          jumlah_sisa,
          harga_konsinyasi,
          produk:produk_id (
            id,
            nama_produk,
            stok
          )
        )
      `)
      .eq('id', id)
      .single();

    if (getError || !konsinyasi) {
      console.error('Error fetching konsinyasi:', getError);
      return NextResponse.json(
        { error: 'Konsinyasi tidak ditemukan' },
        { status: 404 }
      );
    }

    if (getError || !konsinyasi) {
      console.error('Error fetching konsinyasi:', getError);
      return NextResponse.json(
        { error: 'Konsinyasi tidak ditemukan' },
        { status: 404 }
      );
    }

    const oldStatus = konsinyasi.status;
    const newStatus = body.status;

    console.log(`  Status: ${oldStatus} -> ${newStatus}`);

    // Validasi: Tidak boleh mengubah status yang sudah final
    if (oldStatus === 'Selesai') {
      return NextResponse.json(
        { error: 'Tidak bisa mengubah status konsinyasi yang sudah selesai' },
        { status: 400 }
      );
    }

    if (oldStatus === 'Batal') {
      return NextResponse.json(
        { error: 'Tidak bisa mengubah status konsinyasi yang sudah dibatalkan' },
        { status: 400 }
      );
    }

    // ============================================================
    // BUSINESS LOGIC: STATUS = SELESAI
    // ============================================================
    if (newStatus === 'Selesai') {
      console.log('🏁 Proses selesaikan konsinyasi...');

      const details = konsinyasi.detail_konsinyasi || [];

      // Kurangi stock berdasarkan jumlah yang terjual (sesuai user input di transaksi penjualan)
      for (const detail of details) {
        const jumlahTerjual = parseFloat(detail.jumlah_terjual?.toString() || '0');

        // Calculate current stock for this branch (same as stock-barang page logic)
        // This is the actual available stock that users see
        const { data: stockTransactions, error: stockError } = await supabase
          .from('stock_barang')
          .select('jumlah, tipe')
          .eq('produk_id', detail.produk_id)
          .eq('cabang_id', konsinyasi.cabang_id);

        if (stockError) {
          console.error('❌ Error getting stock transactions:', stockError);
          return NextResponse.json({
            error: `Gagal mengambil data stock untuk produk ${detail.produk?.nama_produk}: ${stockError.message}`
          }, { status: 500 });
        }

        // Calculate current stock: masuk + , keluar -
        let currentStock = 0;
        stockTransactions?.forEach((transaction: any) => {
          const amount = parseFloat(transaction.jumlah?.toString() || '0');
          if (transaction.tipe === 'masuk') {
            currentStock += amount;
          } else if (transaction.tipe === 'keluar') {
            currentStock -= amount;
          }
        });

        console.log(`\n📦 Produk ${detail.produk_id} (${detail.produk?.nama_produk})`);
        console.log(`  - Jumlah terjual: ${jumlahTerjual}`);
        console.log(`  - Stock transactions found: ${stockTransactions?.length || 0}`);
        console.log(`  - Current stock (calculated from transactions): ${currentStock}`);

        // Kurangi stock untuk barang yang terjual
        if (jumlahTerjual > 0) {
          // Validasi stock mencukupi
          if (currentStock < jumlahTerjual) {
            console.error(`❌ Stock tidak mencukupi untuk ${detail.produk?.nama_produk}`);
            return NextResponse.json({
              error: `Stock ${detail.produk?.nama_produk} tidak mencukupi. Tersedia: ${currentStock}, dibutuhkan: ${jumlahTerjual}`
            }, { status: 400 });
          }

          // Record stock keluar transaction
          const { error: insertStockError } = await supabase
            .from('stock_barang')
            .insert({
              produk_id: detail.produk_id,
              cabang_id: konsinyasi.cabang_id,
              jumlah: jumlahTerjual,
              tanggal: new Date().toISOString().split('T')[0],
              tipe: 'keluar',
              keterangan: `Konsinyasi Selesai - ${konsinyasi.kode_konsinyasi}`,
              nama_produk: detail.produk?.nama_produk,
              kode_produk: detail.produk?.kode_produk || '',
              satuan: detail.produk?.satuan || 'Kg',
            });

          if (insertStockError) {
            console.error('❌ Error recording stock transaction:', insertStockError);
            return NextResponse.json({
              error: `Gagal mencatat transaksi stock untuk produk ${detail.produk?.nama_produk}: ${insertStockError.message}`
            }, { status: 500 });
          }

          console.log(`  ✅ Stock reduced successfully (branch transaction recorded)`);
        } else {
          console.log(`  ℹ️ Tidak ada penjualan tercatat, stock tidak dikurangi`);
        }

        // Tambahkan stock untuk barang yang dikembalikan (retur)
        const jumlahKembali = parseFloat(detail.jumlah_kembali?.toString() || '0');
        if (jumlahKembali > 0) {
          // Record stock masuk transaction for retur
          const { error: insertReturError } = await supabase
            .from('stock_barang')
            .insert({
              produk_id: detail.produk_id,
              cabang_id: konsinyasi.cabang_id,
              jumlah: jumlahKembali,
              tanggal: new Date().toISOString().split('T')[0],
              tipe: 'masuk',
              keterangan: `Retur Konsinyasi - ${konsinyasi.kode_konsinyasi}`,
              nama_produk: detail.produk?.nama_produk,
              kode_produk: detail.produk?.kode_produk || '',
              satuan: detail.produk?.satuan || 'Kg',
            });

          if (insertReturError) {
            console.error('❌ Error recording retur stock transaction:', insertReturError);
            return NextResponse.json({
              error: `Gagal mencatat transaksi stock retur untuk produk ${detail.produk?.nama_produk}: ${insertReturError.message}`
            }, { status: 500 });
          }

          console.log(`  - Jumlah kembali: ${jumlahKembali}`);
          console.log(`  ✅ Stock retur transaction recorded successfully`);
        }
      }
    }

    // ============================================================
    // BUSINESS LOGIC: STATUS = BATAL
    // ============================================================
    if (newStatus === 'Batal') {
      console.log('❌ Proses pembatalan konsinyasi...');

      // Cek apakah sudah ada penjualan
      const detailIds = (konsinyasi.detail_konsinyasi || []).map((d: any) => d.id);
      
      if (detailIds.length > 0) {
        const { data: penjualan } = await supabase
          .from('penjualan_konsinyasi')
          .select('id, jumlah_terjual')
          .in('detail_konsinyasi_id', detailIds);

        if (penjualan && penjualan.length > 0) {
          const totalTerjual = penjualan.reduce((sum, p) => 
            sum + parseFloat(p.jumlah_terjual?.toString() || '0'), 0
          );
          
          console.log(`⚠️ Sudah ada ${totalTerjual} unit terjual`);
          
          return NextResponse.json({
            error: `Tidak bisa membatalkan konsinyasi yang sudah ada penjualan (${totalTerjual} unit terjual). Gunakan status "Selesai" untuk menutup konsinyasi ini.`
          }, { status: 400 });
        }
      }

      console.log('✅ Tidak ada penjualan, konsinyasi bisa dibatalkan');

      // Update detail konsinyasi: tandai semua sebagai kembali
      const details = konsinyasi.detail_konsinyasi || [];
      
      for (const detail of details) {
        const jumlahTitip = parseFloat(detail.jumlah_titip?.toString() || '0');
        
        await supabase
          .from('detail_konsinyasi')
          .update({
            jumlah_kembali: jumlahTitip,
            jumlah_sisa: 0,
          })
          .eq('id', detail.id);
      }

      console.log('✅ Semua barang ditandai sebagai kembali');
    }

    // ============================================================
    // UPDATE STATUS KONSINYASI
    // ============================================================
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Tambahan field berdasarkan status
    if (newStatus === 'Selesai') {
      updateData.tanggal_selesai = new Date().toISOString().split('T')[0];
    }

    if (newStatus === 'Batal') {
      updateData.alasan_batal = body.alasan || null;
    }

    const { data, error } = await supabase
      .from('transaksi_konsinyasi')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating status:', error);
      throw error;
    }

    console.log('🎉 Status updated successfully');

    // Response message berdasarkan status
    let message = `Status berhasil diubah menjadi "${newStatus}"`;
    let note = null;

    if (newStatus === 'Selesai') {
      message += '. Stock telah disesuaikan berdasarkan penjualan dan retur.';
      note = 'Stock dikurangi untuk barang yang terjual dan ditambah untuk barang yang dikembalikan (retur).';
    }

    if (newStatus === 'Batal') {
      message += '. Semua barang dianggap dikembalikan.';
      note = 'Stock tidak berubah karena tidak ada transaksi penjualan';
    }

    return NextResponse.json({
      success: true,
      message,
      note,
      data
    });

  } catch (error: any) {
    console.error('❌ Error updating status:', error);
    return NextResponse.json({ 
      error: error.message || 'Gagal update status konsinyasi'
    }, { status: 500 });
  }
}
