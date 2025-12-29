// app/api/transaksi/pembelian/[id]/lunas/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();


    // Validasi input
    if (!body.rekening) {
      return NextResponse.json(
        { error: 'Pilih rekening terlebih dahulu' },
        { status: 400 }
      );
    }

    // 1. Get pembelian data
    const { data: pembelian, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        total,
        biaya_kirim,
        uang_muka,
        status_pembayaran,
        detail_pembelian (subtotal)
      `)
      .eq('id', id)
      .single();

    if (pembelianError) throw pembelianError;

    // 2. Hitung total dari detail
    const subtotal = pembelian.detail_pembelian?.reduce(
      (sum: number, d: any) => sum + parseFloat(d.subtotal?.toString() || '0'),
      0
    ) || 0;
    
    const biayaKirim = parseFloat(pembelian.biaya_kirim?.toString() || '0');
    const totalReal = subtotal + biayaKirim;

    // 3. Get cicilan yang sudah dibayar
    const { data: cicilans } = await supabase
      .from('cicilan_pembelian')
      .select('jumlah_cicilan')
      .eq('pembelian_id', id);

    const sudahDibayar = cicilans?.reduce(
      (sum, c) => sum + parseFloat(c.jumlah_cicilan?.toString() || '0'),
      0
    ) || 0;

    const sisaPiutang = totalReal - sudahDibayar;
    const nilaiDiskon = parseFloat(body.nilai_diskon || '0');
    const sisaTagihan = sisaPiutang - nilaiDiskon;


    // Validasi
    if (nilaiDiskon > sisaPiutang) {
      return NextResponse.json(
        { error: 'Nilai diskon melebihi sisa hutang' },
        { status: 400 }
      );
    }

    if (sisaTagihan < 0) {
      return NextResponse.json(
        { error: 'Sisa tagihan tidak valid' },
        { status: 400 }
      );
    }

    // 4. Get kas info
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('id, saldo, nama_kas')
      .eq('nama_kas', body.rekening)
      .single();

    if (kasError || !kas) {
      return NextResponse.json(
        { error: 'Rekening tidak ditemukan' },
        { status: 404 }
      );
    }

    const saldoKasLama = parseFloat(kas.saldo?.toString() || '0');

    // ✅ VALIDASI SALDO KAS - HARUS CUKUP!
    if (sisaTagihan > saldoKasLama) {
      return NextResponse.json({
        error: `Saldo kas tidak cukup. Saldo tersedia: Rp. ${saldoKasLama.toLocaleString('id-ID')}`
      }, { status: 400 });
    }


    // 5. Update transaksi_pembelian
    const totalDibayarBaru = sudahDibayar + sisaTagihan;
    
    const { error: updatePembelianError } = await supabase
      .from('transaksi_pembelian')
      .update({
        status_pembayaran: 'Lunas',
      })
      .eq('id', id);

    if (updatePembelianError) throw updatePembelianError;


    // 6. Update hutang_pembelian (jika ada)
    const { data: hutang } = await supabase
      .from('hutang_pembelian')
      .select('*')
      .eq('pembelian_id', id)
      .maybeSingle();

    if (hutang) {
      // When using diskon, treat it as additional payment towards the debt
      const dibayarWithDiskon = totalDibayarBaru + nilaiDiskon;

      await supabase
        .from('hutang_pembelian')
        .update({
          dibayar: dibayarWithDiskon,
          sisa: 0,
          status: 'Lunas'
        })
        .eq('pembelian_id', id);

    }

    // 7. ✅ KAS BERKURANG (bayar supplier)
    const saldoKasBaru = saldoKasLama - sisaTagihan;
    

    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ saldo: saldoKasBaru })
      .eq('id', kas.id);

    if (updateKasError) throw updateKasError;


    // 8. Insert transaksi kas (DEBIT = uang keluar)
    const keteranganKas = `Pelunasan pembelian #${id}${nilaiDiskon > 0 ? ` (Diskon: Rp ${nilaiDiskon.toLocaleString('id-ID')})` : ''}`;
    
    const { error: insertTransaksiKasError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: kas.id,
        tanggal_transaksi: new Date().toISOString().split('T')[0],
        debit: sisaTagihan, // ✅ DEBIT = uang keluar
        kredit: 0,
        keterangan: keteranganKas
      });

    if (insertTransaksiKasError) throw insertTransaksiKasError;


    // 9. Insert cicilan history
    const keteranganCicilan = `Pelunasan${nilaiDiskon > 0 ? ` (Diskon: Rp ${nilaiDiskon.toLocaleString('id-ID')})` : ''}`;
    
    const { error: insertCicilanError } = await supabase
      .from('cicilan_pembelian')
      .insert({
        pembelian_id: parseInt(id),
        tanggal_cicilan: new Date().toISOString().split('T')[0],
        jumlah_cicilan: sisaTagihan,
        rekening: body.rekening,
        type: 'pelunasan',
        keterangan: keteranganCicilan
      });

    if (insertCicilanError) throw insertCicilanError;


    return NextResponse.json({
      success: true,
      message: '🎉 Pelunasan berhasil! Hutang LUNAS!',
      data: {
        sisa: 0,
        status: 'Lunas',
        jumlahDibayar: sisaTagihan,
        totalDibayar: totalDibayarBaru,
        saldoKasBaru,
        diskon: nilaiDiskon
      }
    });
  } catch (error: any) {
    console.error('❌ ERROR PELUNASAN:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal proses pelunasan' },
      { status: 500 }
    );
  }
}
