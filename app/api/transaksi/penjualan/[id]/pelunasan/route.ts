// app/api/transaksi/penjualan/[id]/pelunasan/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { id } = await context.params;
    const body = await request.json();

    console.log('🔥 PELUNASAN START - ID:', id);
    console.log('📦 Body:', body);

    // Validasi kas_id
    if (!body.kas_id) {
      return NextResponse.json(
        { error: 'Pilih rekening kas terlebih dahulu' },
        { status: 400 }
      );
    }

    // 1. Get penjualan data dengan detail_penjualan
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        total,
        dibayar,
        status_pembayaran,
        nilai_diskon,
        detail_penjualan (
          subtotal
        )
      `)
      .eq('id', id)
      .single();

    if (penjualanError) {
      console.error('❌ Error get penjualan:', penjualanError);
      throw penjualanError;
    }

    // 🔥 HITUNG TOTAL REAL dari detail_penjualan
    const totalFromDetails = penjualan.detail_penjualan?.reduce(
      (sum: number, detail: any) => sum + parseFloat(detail.subtotal?.toString() || '0'),
      0
    ) || 0;

    const totalFromField = parseFloat(penjualan.total?.toString() || '0');

    // Use the higher value to ensure we don't miss any amounts
    const totalReal = Math.max(totalFromDetails, totalFromField);

    console.log('🔍 TOTAL CALCULATION DEBUG:');
    console.log('   Total from details:', totalFromDetails);
    console.log('   Total from field:', totalFromField);
    console.log('   Total Real used:', totalReal);

    // 🔥 HITUNG SUDAH DIBAYAR REAL dari cicilan yang ada
    const { data: existingCicilan } = await supabase
      .from('cicilan_penjualan')
      .select('jumlah_cicilan')
      .eq('penjualan_id', id);

    const sudahDibayarReal = (existingCicilan || []).reduce(
      (sum, c) => sum + parseFloat(c.jumlah_cicilan?.toString() || '0'),
      0
    );

    const sisaPiutangReal = totalReal - sudahDibayarReal;
    const nilaiDiskon = parseFloat(body.nilai_diskon || '0');
    const sisaTagihan = sisaPiutangReal - nilaiDiskon;

    // 🔥 HITUNG TOTAL DIBAYAR - Check if dibayar field already includes cicilan
    const dibayarDariField = parseFloat(penjualan.dibayar?.toString() || '0');

    // If dibayar field already includes cicilan amounts, don't double count
    const totalSudahDibayar = dibayarDariField >= sudahDibayarReal
      ? dibayarDariField  // dibayar field already includes cicilan
      : sudahDibayarReal + dibayarDariField; // add them up

    console.log('📊 PERHITUNGAN PELUNASAN:');
    console.log('   Total Real:', totalReal);
    console.log('   Sudah Dibayar (dari field DB):', dibayarDariField);

    // Validasi - Use dibayar field as it's maintained by cicilan API
    const sisaPiutangAktual = totalReal - dibayarDariField;

    if (nilaiDiskon > sisaPiutangAktual) {
      return NextResponse.json(
        { error: 'Nilai diskon melebihi sisa tagihan' },
        { status: 400 }
      );
    }

    // TEMPORARILY DISABLE VALIDATION TO DEBUG
    /*
    if (sisaPiutangAktual <= 0) {
      return NextResponse.json(
        { error: 'Piutang sudah lunas' },
        { status: 400 }
      );
    }
    */

    if (sisaTagihan < 0) {
      return NextResponse.json(
        { error: 'Sisa tagihan tidak valid' },
        { status: 400 }
      );
    }

    // 2. Get kas
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('saldo, nama_kas')
      .eq('id', body.kas_id)
      .single();

    if (kasError) {
      console.error('❌ Error get kas:', kasError);
      throw kasError;
    }

    const saldoKasLama = parseFloat(kas.saldo);
    console.log('🏦 Kas:', kas.nama_kas, '- Saldo Lama:', saldoKasLama);

    // 3. Hitung total dibayar baru (REAL dari cicilan + pelunasan ini)
    const totalDibayarBaru = sudahDibayarReal + sisaTagihan;
    
    console.log('💰 Total Dibayar Baru:', sudahDibayarReal, '+', sisaTagihan, '=', totalDibayarBaru);

    // 4. Update transaksi_penjualan
    const updateData: any = {
      dibayar: totalDibayarBaru, // ✅ Update dengan total cicilan yang benar
      status_pembayaran: 'Lunas',
      tanggal_transaksi_terakhir: body.tanggal_pelunasan
    };

    // Jika ada diskon, tambahkan ke nilai_diskon
    if (nilaiDiskon > 0) {
      const diskonSebelumnya = parseFloat(penjualan.nilai_diskon || '0');
      updateData.nilai_diskon = diskonSebelumnya + nilaiDiskon;
      
      console.log('💸 Diskon Sebelumnya:', diskonSebelumnya, '+ Diskon Baru:', nilaiDiskon, '= Total Diskon:', updateData.nilai_diskon);
    }

    const { error: updatePenjualanError } = await supabase
      .from('transaksi_penjualan')
      .update(updateData)
      .eq('id', id);

    if (updatePenjualanError) {
      console.error('❌ Error update penjualan:', updatePenjualanError);
      throw updatePenjualanError;
    }

    console.log('✅ Penjualan updated - dibayar:', totalDibayarBaru, 'status: Lunas');

    // 5. Update piutang_penjualan (jika ada)
    const { data: piutang } = await supabase
      .from('piutang_penjualan')
      .select('*')
      .eq('penjualan_id', id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

    if (piutang) {
      await supabase
        .from('piutang_penjualan')
        .update({
          dibayar: totalDibayarBaru,
          sisa: 0,
          status: 'Lunas'
        })
        .eq('penjualan_id', id);

      console.log('✅ Piutang penjualan updated');
    }

    // 6. KAS BERTAMBAH (uang masuk dari pelunasan)
    const saldoKasBaru = saldoKasLama + sisaTagihan;
    
    console.log('🏦 Update Kas:', saldoKasLama, '+', sisaTagihan, '=', saldoKasBaru);

    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ 
        saldo: saldoKasBaru,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.kas_id);

    if (updateKasError) {
      console.error('❌ Error update kas:', updateKasError);
      throw updateKasError;
    }

    console.log('✅ Kas updated');

    // 7. Insert transaksi kas (KREDIT = uang masuk)
    const keteranganKas = `Pelunasan penjualan #${id}${nilaiDiskon > 0 ? ` (Diskon: Rp ${nilaiDiskon.toLocaleString('id-ID')})` : ''}`;
    
    const { error: insertTransaksiKasError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: body.kas_id,
        tanggal_transaksi: body.tanggal_pelunasan,
        debit: 0,
        kredit: sisaTagihan, // ✅ Yang masuk ke kas = sisa tagihan setelah diskon
        keterangan: keteranganKas
      });

    if (insertTransaksiKasError) {
      console.error('❌ Error insert transaksi kas:', insertTransaksiKasError);
      throw insertTransaksiKasError;
    }

    console.log('✅ Transaksi kas inserted - Kredit:', sisaTagihan);

    // 8. Insert cicilan history
    const keteranganCicilan = `Pelunasan${nilaiDiskon > 0 ? ` (Diskon: Rp ${nilaiDiskon.toLocaleString('id-ID')})` : ''}`;
    
    const { error: insertCicilanError } = await supabase
      .from('cicilan_penjualan')
      .insert({
        penjualan_id: parseInt(id),
        tanggal_cicilan: body.tanggal_pelunasan,
        jumlah_cicilan: sisaTagihan, // ✅ Jumlah yang dibayar = sisa tagihan
        kas_id: body.kas_id,
        keterangan: keteranganCicilan
      });

    if (insertCicilanError) {
      console.error('❌ Error insert cicilan:', insertCicilanError);
      throw insertCicilanError;
    }

    console.log('✅ Cicilan penjualan inserted - Jumlah:', sisaTagihan);
    console.log('🎉 PELUNASAN SUKSES!');

    return NextResponse.json({
      success: true,
      message: '🎉 Pelunasan berhasil! Piutang LUNAS!',
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
