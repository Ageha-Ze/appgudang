// app/api/transaksi/konsinyasi/retur/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const body = await request.json();

    console.log('📦 Processing retur konsinyasi:', body);

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
    console.log('🔍 Searching for detail_konsinyasi_id:', body.detail_konsinyasi_id, 'type:', typeof body.detail_konsinyasi_id);

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

    console.log('📋 Query result:', { detail: detail ? 'FOUND' : 'NOT FOUND', error: detailError });

    if (detailError || !detail) {
      console.error('❌ Error fetching detail:', detailError);

      // Let's also check if the record exists at all
      const { data: allDetails } = await supabase
        .from('detail_konsinyasi')
        .select('id')
        .limit(10);

      console.log('📊 First 10 detail_konsinyasi IDs:', allDetails?.map(d => d.id));

      return NextResponse.json(
        { error: `Detail konsinyasi tidak ditemukan. ID: ${body.detail_konsinyasi_id}` },
        { status: 404 }
      );
    }

    console.log('📋 Detail konsinyasi:', {
      produk: detail.produk?.nama_produk,
      jumlah_sisa: detail.jumlah_sisa,
      jumlah_kembali: detail.jumlah_kembali,
      status_konsinyasi: detail.konsinyasi?.status
    });

    // ✅ Validasi: Cek status konsinyasi
    if (detail.konsinyasi?.status === 'selesai' || detail.konsinyasi?.status === 'dibatalkan') {
      return NextResponse.json(
        { error: `Tidak bisa retur, konsinyasi sudah ${detail.konsinyasi.status}` },
        { status: 400 }
      );
    }

    // ✅ Validasi: Jumlah tidak melebihi sisa
    if (jumlah > detail.jumlah_sisa) {
      return NextResponse.json(
        { 
          error: `Jumlah retur (${jumlah}) melebihi sisa barang (${detail.jumlah_sisa})` 
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
      console.log('⚠️ Duplicate retur detected, skipping...');
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
        keterangan: body.keterangan || null,
      })
      .select()
      .single();

    if (returError) {
      console.error('Error inserting retur:', returError);
      throw returError;
    }

    console.log('✅ Retur inserted:', retur.id);

    // ✅ Update detail konsinyasi
    const newJumlahSisa = detail.jumlah_sisa - jumlah;
    const newJumlahKembali = detail.jumlah_kembali + jumlah;

    console.log(`📊 Updating detail: sisa ${detail.jumlah_sisa} → ${newJumlahSisa}, kembali ${detail.jumlah_kembali} → ${newJumlahKembali}`);

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

    // ✅ Kembalikan stock HANYA jika kondisi "Baik"
    if (body.kondisi === 'Baik') {
      console.log('📦 Returning stock to inventory...');

      const currentStok = parseFloat(detail.produk?.stok?.toString() || '0');
      const newStok = currentStok + jumlah;

      console.log(`  ${detail.produk?.nama_produk}: ${currentStok} + ${jumlah} = ${newStok}`);

      // Update stock produk
      const { error: updateStockError } = await supabase
        .from('produk')
        .update({ 
          stok: newStok,
          updated_at: new Date().toISOString()
        })
        .eq('id', detail.produk_id);

      if (updateStockError) {
        console.error('Error updating stock:', updateStockError);
        // Rollback detail konsinyasi
        await supabase
          .from('detail_konsinyasi')
          .update({
            jumlah_sisa: detail.jumlah_sisa,
            jumlah_kembali: detail.jumlah_kembali,
          })
          .eq('id', body.detail_konsinyasi_id);
        // Rollback retur
        await supabase
          .from('retur_konsinyasi')
          .delete()
          .eq('id', retur.id);
        throw new Error('Gagal update stock produk');
      }

      // ✅ Cek duplikasi stock_barang sebelum insert
      const { data: existingStock } = await supabase
        .from('stock_barang')
        .select('id')
        .eq('produk_id', detail.produk_id)
        .eq('cabang_id', detail.konsinyasi?.cabang_id)
        .eq('tanggal', body.tanggal_retur)
        .eq('tipe', 'masuk')
        .eq('keterangan', `Retur Konsinyasi #${retur.id} - ${body.kondisi}`)
        .maybeSingle();

      if (!existingStock) {
        // Insert stock movement
        const { error: stockBarangError } = await supabase
          .from('stock_barang')
          .insert({
            produk_id: detail.produk_id,
            cabang_id: detail.konsinyasi?.cabang_id,
            jumlah: jumlah,
            tanggal: body.tanggal_retur,
            tipe: 'masuk',
            keterangan: `Retur Konsinyasi #${retur.id} - ${body.kondisi}`,
            hpp: parseFloat(detail.harga?.toString() || '0')
          });

        if (stockBarangError) {
          console.error('⚠️ Warning: Failed to insert stock_barang:', stockBarangError);
          // Don't rollback, stock sudah berubah dan itu yang penting
        } else {
          console.log('  ✅ Stock history recorded');
        }
      } else {
        console.log('  ⏭️ Stock history already exists, skipping insert');
      }

      console.log('✅ Stock returned successfully');
    } else {
      console.log(`⚠️ Kondisi: ${body.kondisi}, stock NOT returned`);
    }

    return NextResponse.json({
      success: true,
      message: `Retur berhasil dicatat${body.kondisi === 'Baik' ? ' dan stock dikembalikan' : ''}`,
      data: {
        retur_id: retur.id,
        produk: detail.produk?.nama_produk,
        jumlah_retur: jumlah,
        kondisi: body.kondisi,
        stock_returned: body.kondisi === 'Baik',
        new_stock: body.kondisi === 'Baik' 
          ? parseFloat(detail.produk?.stok?.toString() || '0') + jumlah
          : parseFloat(detail.produk?.stok?.toString() || '0')
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating retur:', error);
    return NextResponse.json({ 
      error: error.message || 'Gagal mencatat retur konsinyasi'
    }, { status: 500 });
  }
}
