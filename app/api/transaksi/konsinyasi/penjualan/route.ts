// app/api/transaksi/konsinyasi/penjualan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const body = await request.json();

    console.log('📦 Creating penjualan konsinyasi:', body);

    // ✅ Validasi input
    if (!body.detail_konsinyasi_id || !body.jumlah_terjual || !body.tanggal_jual || !body.kas_id) {
      return NextResponse.json(
        { error: 'Detail konsinyasi, jumlah terjual, tanggal jual, dan kas wajib diisi' },
        { status: 400 }
      );
    }

    const jumlah = parseFloat(body.jumlah_terjual);

    if (jumlah <= 0) {
      return NextResponse.json(
        { error: 'Jumlah terjual harus lebih dari 0' },
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
          status,
          cabang_id,
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
      console.error('Error fetching detail konsinyasi:', detailError);
      return NextResponse.json(
        { error: 'Detail konsinyasi tidak ditemukan' },
        { status: 404 }
      );
    }

    console.log('📋 Detail konsinyasi:', {
      produk: detail.produk?.nama_produk,
      jumlah_sisa: detail.jumlah_sisa,
      status_konsinyasi: detail.konsinyasi?.status
    });

    // ✅ Validasi: Cek status konsinyasi
    if (detail.konsinyasi?.status !== 'Aktif') {
      return NextResponse.json(
        { error: `Tidak bisa jual, konsinyasi ${detail.konsinyasi?.status}` },
        { status: 400 }
      );
    }

    // ✅ Validasi: Jumlah tidak melebihi sisa
    if (jumlah > detail.jumlah_sisa) {
      return NextResponse.json(
        {
          error: `Jumlah terjual (${jumlah}) melebihi sisa barang (${detail.jumlah_sisa})`
        },
        { status: 400 }
      );
    }

    // ✅ Get kas untuk validasi
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('id, nama_kas, saldo')
      .eq('id', body.kas_id)
      .single();

    if (kasError || !kas) {
      return NextResponse.json(
        { error: 'Kas tidak ditemukan' },
        { status: 404 }
      );
    }

    console.log('💰 Kas:', kas.nama_kas, 'Saldo:', kas.saldo);

    // ✅ Calculate nilai jual
    const hargaJualToko = parseFloat(detail.harga_jual_toko?.toString() || '0');
    const hargaKonsinyasi = parseFloat(detail.harga_konsinyasi?.toString() || '0');
    const totalNilaiKita = jumlah * hargaKonsinyasi;
    const totalPenjualan = jumlah * hargaJualToko;
    const keuntunganToko = totalPenjualan - totalNilaiKita;

    console.log('💰 Calculations:', {
      hargaJualToko,
      hargaKonsinyasi,
      totalNilaiKita,
      totalPenjualan,
      keuntunganToko
    });

    // ✅ Insert penjualan konsinyasi
    const { data: penjualan, error: penjualanError } = await supabase
      .from('penjualan_konsinyasi')
      .insert({
        detail_konsinyasi_id: body.detail_konsinyasi_id,
        tanggal_jual: body.tanggal_jual,
        jumlah_terjual: jumlah,
        harga_jual_toko: hargaJualToko,
        total_penjualan: totalPenjualan,
        total_nilai_kita: totalNilaiKita,
        keuntungan_toko: keuntunganToko,
        kas_id: body.kas_id,
        tanggal_pembayaran: body.tanggal_pembayaran || body.tanggal_jual,
        status_pembayaran: 'Lunas',
        keterangan: body.keterangan || null,
      })
      .select()
      .single();

    if (penjualanError) {
      console.error('Error inserting penjualan:', penjualanError);
      throw penjualanError;
    }

    console.log('✅ Penjualan inserted:', penjualan.id);

    // ✅ Update detail konsinyasi
    const newJumlahTerjual = detail.jumlah_terjual + jumlah;
    const newJumlahSisa = detail.jumlah_sisa - jumlah;
    const newKeuntunganToko = detail.keuntungan_toko + keuntunganToko;

    console.log(`📊 Updating detail: terjual ${detail.jumlah_terjual} → ${newJumlahTerjual}, sisa ${detail.jumlah_sisa} → ${newJumlahSisa}`);

    const { error: updateDetailError } = await supabase
      .from('detail_konsinyasi')
      .update({
        jumlah_terjual: newJumlahTerjual,
        jumlah_sisa: newJumlahSisa,
        keuntungan_toko: newKeuntunganToko,
      })
      .eq('id', body.detail_konsinyasi_id);

    if (updateDetailError) {
      console.error('Error updating detail:', updateDetailError);
      // Rollback: hapus penjualan yang baru dibuat
      await supabase
        .from('penjualan_konsinyasi')
        .delete()
        .eq('id', penjualan.id);
      throw new Error('Gagal update detail konsinyasi');
    }

    // ✅ Update kas (tambah pemasukan) - menggunakan total_nilai_kita karena kita dapat kembali harga konsinyasi
    const newSaldo = parseFloat(kas.saldo.toString()) + totalNilaiKita;

    console.log(`💵 Kas ${kas.nama_kas}: ${kas.saldo} + ${totalNilaiKita} = ${newSaldo}`);

    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ saldo: newSaldo })
      .eq('id', body.kas_id);

    if (updateKasError) {
      console.error('Error updating kas:', updateKasError);
      // Rollback detail konsinyasi
      await supabase
        .from('detail_konsinyasi')
        .update({
          jumlah_terjual: detail.jumlah_terjual,
          jumlah_sisa: detail.jumlah_sisa,
          keuntungan_toko: detail.keuntungan_toko,
        })
        .eq('id', body.detail_konsinyasi_id);
      // Rollback penjualan
      await supabase
        .from('penjualan_konsinyasi')
        .delete()
        .eq('id', penjualan.id);
      throw new Error('Gagal update saldo kas');
    }

    // ✅ Insert transaksi kas (kredit = masuk) - catat pemasukan harga konsinyasi
    const { error: transaksiKasError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: body.kas_id,
        tanggal_transaksi: body.tanggal_pembayaran || body.tanggal_jual,
        debit: 0,
        kredit: totalNilaiKita,
        keterangan: `Penjualan Konsinyasi #${penjualan.id} - ${detail.produk?.nama_produk}`
      });

    if (transaksiKasError) {
      console.error('⚠️ Warning: Failed to insert transaksi_kas:', transaksiKasError);
      // Don't rollback, kas sudah berubah dan itu yang penting
    } else {
      console.log('  ✅ Kas transaction recorded');
    }

    // ✅ Kurangi stock produk (karena barang sudah terjual)
    const currentStok = parseFloat(detail.produk?.stok?.toString() || '0');
    const newStok = currentStok - jumlah;

    console.log(`📦 Stock ${detail.produk?.nama_produk}: ${currentStok} - ${jumlah} = ${newStok}`);

    const { error: updateStockError } = await supabase
      .from('produk')
      .update({
        stok: newStok,
        updated_at: new Date().toISOString()
      })
      .eq('id', detail.produk_id);

    if (updateStockError) {
      console.error('Error updating stock:', updateStockError);
      // Rollback kas
      await supabase
        .from('kas')
        .update({ saldo: kas.saldo })
        .eq('id', body.kas_id);
      // Rollback detail konsinyasi
      await supabase
        .from('detail_konsinyasi')
        .update({
          jumlah_terjual: detail.jumlah_terjual,
          jumlah_sisa: detail.jumlah_sisa,
          keuntungan_toko: detail.keuntungan_toko,
        })
        .eq('id', body.detail_konsinyasi_id);
      // Rollback penjualan
      await supabase
        .from('penjualan_konsinyasi')
        .delete()
        .eq('id', penjualan.id);
      throw new Error('Gagal update stock produk');
    }

    // ✅ Insert stock_barang (keluar)
    const { error: stockBarangError } = await supabase
      .from('stock_barang')
      .insert({
        produk_id: detail.produk_id,
        cabang_id: detail.konsinyasi?.cabang_id,
        jumlah: jumlah,
        tanggal: body.tanggal_jual,
        tipe: 'keluar',
        keterangan: `Penjualan Konsinyasi #${penjualan.id} - ${detail.produk?.nama_produk}`,
        hpp: hargaKonsinyasi
      });

    if (stockBarangError) {
      console.error('⚠️ Warning: Failed to insert stock_barang:', stockBarangError);
      // Don't rollback, stock sudah dikurangi dan itu yang penting
    } else {
      console.log('  ✅ Stock movement recorded');
    }

    return NextResponse.json({
      success: true,
      message: 'Penjualan konsinyasi berhasil dicatat dan kas diperbarui',
      data: {
        penjualan_id: penjualan.id,
        produk: detail.produk?.nama_produk,
        jumlah_terjual: jumlah,
        total_penjualan: totalPenjualan,
        keuntungan_toko: keuntunganToko,
        new_stock: newStok,
        kas_updated: true
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating penjualan konsinyasi:', error);
    return NextResponse.json({
      error: error.message || 'Gagal mencatat penjualan konsinyasi'
    }, { status: 500 });
  }
}
