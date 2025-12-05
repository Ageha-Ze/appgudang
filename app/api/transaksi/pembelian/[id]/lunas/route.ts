// app/api/transaksi/pembelian/[id]/lunas/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const { id: pembelian_id } = await context.params;
    const body = await request.json();

    console.log('Processing pelunasan:', body);

    // Get pembelian data first
    const { data: pembelian, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select('*')
      .eq('id', pembelian_id)
      .single();

    if (pembelianError) throw pembelianError;

    // Calculate total amount and remaining balance (similar to sales logic)
    const totalAmount = parseFloat(pembelian.total.toString()) + parseFloat(pembelian.biaya_kirim.toString());
    const uangMuka = parseFloat(pembelian.uang_muka.toString());
    const sudahDibayar = parseFloat(pembelian.dibayar?.toString() || '0');
    const sisaHutang = totalAmount - sudahDibayar;

    console.log('💰 PEMBELIAN CALCULATION:');
    console.log('   Total Amount (total + biaya_kirim):', totalAmount);
    console.log('   Uang Muka:', uangMuka);
    console.log('   Sudah Dibayar:', sudahDibayar);
    console.log('   Sisa Hutang:', sisaHutang);

    // Get kas data untuk validasi saldo
    if (body.rekening) {
      console.log('Getting kas data for rekening:', body.rekening);

      const { data: kas, error: kasError } = await supabase
        .from('kas')
        .select('*')
        .eq('nama_kas', body.rekening)
        .eq('cabang_id', pembelian.cabang_id || 1)
        .single();

      if (kasError) {
        console.error('Error getting kas:', kasError);
        throw kasError;
      }

      if (!kas) {
        return NextResponse.json(
          { error: 'Data kas tidak ditemukan' },
          { status: 404 }
        );
      }

      console.log('Kas data found:', kas);

      const kasSaldo = parseFloat(kas.saldo.toString());

      console.log('Saldo validation:', {
        kas_nama: kas.nama_kas,
        saldo_sekarang: kasSaldo,
        sisa_hutang: sisaHutang,
        cukup: kasSaldo >= sisaHutang
      });

      // Validasi: saldo harus cukup untuk pembayaran
      if (kasSaldo < sisaHutang) {
        return NextResponse.json(
          { error: `Saldo kas tidak cukup. Saldo tersedia: Rp. ${kasSaldo.toLocaleString('id-ID')}` },
          { status: 400 }
        );
      }

      // PENTING: Kurangi saldo kas (KELUAR untuk pembelian)
      const newSaldo = kasSaldo - sisaHutang;

      console.log('Updating kas saldo:', {
        old_saldo: kasSaldo,
        sisa_hutang: sisaHutang,
        new_saldo: newSaldo
      });

      const { error: updateKasError } = await supabase
        .from('kas')
        .update({ saldo: newSaldo })
        .eq('id', kas.id);

      if (updateKasError) {
        console.error('Error updating kas:', updateKasError);
        throw updateKasError;
      }

      console.log(`✅ Kas ${kas.nama_kas} updated: ${kasSaldo} - ${sisaHutang} = ${newSaldo}`);

      // Insert transaksi kas (debit = keluar)
      const { error: transaksiKasError } = await supabase
        .from('transaksi_kas')
        .insert({
          kas_id: kas.id,
          tanggal_transaksi: new Date().toISOString().split('T')[0],
          debit: sisaHutang, // Debit = uang keluar
          kredit: 0,
          keterangan: `Pelunasan pembelian (ID: ${pembelian_id})`
        });

      if (transaksiKasError) {
        console.error('Error insert transaksi_kas:', transaksiKasError);
        // Don't throw, just log
      } else {
        console.log('✅ Transaksi kas recorded');
      }
    } else {
      console.warn('⚠️ No rekening provided, skipping kas update');
    }

    // Check if pelunasan already exists
    const { data: existingPelunasan } = await supabase
      .from('cicilan_pembelian')
      .select('id')
      .eq('pembelian_id', parseInt(pembelian_id))
      .eq('type', 'pelunasan')
      .limit(1);

    if (existingPelunasan && existingPelunasan.length > 0) {
      return NextResponse.json(
        { error: 'Pelunasan sudah dilakukan sebelumnya' },
        { status: 400 }
      );
    }

    // Insert cicilan untuk pelunasan
    const { error: cicilanError } = await supabase
      .from('cicilan_pembelian')
      .insert({
        pembelian_id: parseInt(pembelian_id),
        tanggal_cicilan: new Date().toISOString().split('T')[0],
        jumlah_cicilan: sisaHutang,
        rekening: body.rekening,
        type: 'pelunasan',
        keterangan: body.keterangan || ''
      });

    if (cicilanError) throw cicilanError;

    // Update or create hutang record (try update first, then insert)
    const totalHutang = totalAmount;
    const dibayarTotal = sudahDibayar + sisaHutang;

    // First try to update existing hutang record
    const { data: updateResult, error: updateError } = await supabase
      .from('hutang_pembelian')
      .update({
        total_hutang: totalHutang,
        dibayar: dibayarTotal,
        sisa: 0,
        status: 'Lunas'
      })
      .eq('pembelian_id', parseInt(pembelian_id))
      .select();

    if (updateError) {
      console.error('Error updating hutang:', updateError);
      throw updateError;
    }

    // If no rows were updated, create new hutang record
    if (!updateResult || updateResult.length === 0) {
      console.log('No existing hutang record found, creating new one');
      const { error: insertError } = await supabase
        .from('hutang_pembelian')
        .insert({
          pembelian_id: parseInt(pembelian_id),
          suplier_id: pembelian.suplier_id,
          total_hutang: totalHutang,
          dibayar: dibayarTotal,
          sisa: 0,
          status: 'Lunas'
        });

      if (insertError) {
        console.error('Error creating hutang:', insertError);
        throw insertError;
      }
    } else {
      console.log('Updated existing hutang record');
    }

    // Update status pembayaran di transaksi_pembelian
    const { error: updateTransaksiError } = await supabase
      .from('transaksi_pembelian')
      .update({
        status_pembayaran: 'Lunas',
        rekening_bayar: body.rekening,
        tanggal_diterima: new Date().toISOString().split('T')[0] // opsional

      })
      .eq('id', pembelian_id);

    if (updateTransaksiError) throw updateTransaksiError;

    return NextResponse.json({
      message: 'Pelunasan berhasil diproses'
    });
  } catch (error: any) {
    console.error('Error processing pelunasan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
