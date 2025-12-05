// app/api/transaksi/konsinyasi/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Detail konsinyasi by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
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
    const supabase = await supabaseServer();
    const { id } = await params;
    const body = await request.json();

    console.log('🔄 Updating konsinyasi status:', { id, new_status: body.status });

    // ✅ Validasi input
    if (!body.status) {
      return NextResponse.json(
        { error: 'Status wajib diisi' },
        { status: 400 }
      );
    }

    // ✅ Validasi status yang diperbolehkan
    const validStatuses = ['pending', 'Aktif', 'Selesai', 'Batal'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Status tidak valid. Harus salah satu dari: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // ✅ Get konsinyasi data lengkap
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

    const oldStatus = konsinyasi.status;
    const newStatus = body.status;

    console.log('📊 Current status:', oldStatus, '→', newStatus);

    // ✅ Validasi: Tidak boleh mengubah status yang sudah final
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

    // ✅ Business Logic: Handle status change
    if (newStatus === 'Selesai') {
      console.log('📦 Finishing konsinyasi...');

      // ⚠️ IMPORTANT: Stock tidak perlu dikembalikan karena:
      // - Saat kirim konsinyasi: stock TIDAK dikurangi
      // - Saat penjualan: stock SUDAH dikurangi
      // - Saat retur: stock SUDAH dikembalikan
      // - Jumlah_sisa = barang yang masih di toko tapi BELUM terjual & BELUM diretur
      // - Barang ini SUDAH ADA di stock kita (tidak pernah berkurang)
      
      // Yang perlu dilakukan: Update detail konsinyasi saja
      const details = konsinyasi.detail_konsinyasi || [];
      
      for (const detail of details) {
        const jumlahSisa = parseFloat(detail.jumlah_sisa?.toString() || '0');
        
        if (jumlahSisa > 0) {
          console.log(`  ℹ️ Closing detail: ${detail.produk?.nama_produk}, sisa di toko: ${jumlahSisa}`);
          console.log(`    Stock TIDAK berubah (barang sisa masih ada di stock kita)`);

          // ✅ Update detail konsinyasi: pindahkan sisa ke jumlah_kembali
          const { error: updateDetailError } = await supabase
            .from('detail_konsinyasi')
            .update({
              jumlah_kembali: parseFloat(detail.jumlah_kembali?.toString() || '0') + jumlahSisa,
              jumlah_sisa: 0,
              keterangan: `Selesai - Sisa ${jumlahSisa} pcs dianggap kembali`
            })
            .eq('id', detail.id);

          if (updateDetailError) {
            console.error('Error updating detail:', updateDetailError);
            return NextResponse.json({
              error: `Gagal update detail konsinyasi`
            }, { status: 500 });
          }

          console.log(`    ✅ Detail updated (marked as returned)`);
        }
      }

      console.log('✅ Konsinyasi marked as finished (no stock changes needed)');
    }

    if (newStatus === 'Batal') {
      console.log('🚫 Canceling konsinyasi...');

      // ⚠️ IMPORTANT: Cek dulu apakah sudah ada penjualan
      const { data: penjualan } = await supabase
        .from('penjualan_konsinyasi')
        .select('id, jumlah_terjual')
        .in('detail_konsinyasi_id', 
          (konsinyasi.detail_konsinyasi || []).map((d: any) => d.id)
        );

      if (penjualan && penjualan.length > 0) {
        const totalTerjual = penjualan.reduce((sum, p) => sum + parseFloat(p.jumlah_terjual?.toString() || '0'), 0);
        
        return NextResponse.json({
          error: `Tidak bisa membatalkan konsinyasi yang sudah ada penjualan (${totalTerjual} pcs terjual). Selesaikan konsinyasi saja.`
        }, { status: 400 });
      }

      // Jika belum ada penjualan, stock tidak perlu dikembalikan
      // Karena saat kirim konsinyasi, stock TIDAK dikurangi
      console.log('ℹ️ No sales yet, stock remains unchanged (nothing to return)');

      // Update detail konsinyasi: tandai semua barang sebagai kembali
      const details = konsinyasi.detail_konsinyasi || [];
      
      for (const detail of details) {
        const jumlahTotal = parseFloat(detail.jumlah_titip?.toString() || '0');
        
        const { error: updateDetailError } = await supabase
          .from('detail_konsinyasi')
          .update({
            jumlah_kembali: jumlahTotal,
            jumlah_sisa: 0,
            keterangan: 'Dibatalkan - Dianggap semua kembali'
          })
          .eq('id', detail.id);

        if (updateDetailError) {
          console.error('Error updating detail:', updateDetailError);
        }
      }

      console.log('✅ Konsinyasi marked as canceled (no stock changes)');
    }

    // ✅ Update status konsinyasi
    const { data, error } = await supabase
      .from('transaksi_konsinyasi')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === 'selesai' && { tanggal_selesai: new Date().toISOString().split('T')[0] }),
        ...(newStatus === 'dibatalkan' && { 
          tanggal_dibatalkan: new Date().toISOString().split('T')[0],
          alasan_batal: body.alasan || null
        }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating status:', error);
      throw error;
    }

    console.log('✅ Status updated successfully');

    return NextResponse.json({
      success: true,
      message: `Status berhasil diubah ke "${newStatus}"${
        newStatus === 'Selesai' ? '. Semua detail konsinyasi ditutup.' : 
        newStatus === 'Batal' ? '. Konsinyasi dibatalkan.' : ''
      }`,
      data,
      note: newStatus === 'Selesai' || newStatus === 'dibatalkan' 
        ? 'Stock tidak berubah karena barang yang tidak terjual sudah ada di stock kita (tidak pernah dikurangi saat kirim konsinyasi)'
        : null
    });
  } catch (error: any) {
    console.error('❌ Error updating status:', error);
    return NextResponse.json({ 
      error: error.message || 'Gagal update status konsinyasi'
    }, { status: 500 });
  }
}
