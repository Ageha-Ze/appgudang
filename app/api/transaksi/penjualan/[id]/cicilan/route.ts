// app/api/transaksi/penjualan/[id]/cicilan/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('cicilan_penjualan')
      .select(`
        *,
        kas:kas_id (
          id,
          nama_kas,
          no_rekening
        )
      `)
      .eq('penjualan_id', id)
      .order('tanggal_cicilan', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();


    // Validasi
    if (!body.kas_id) {
      return NextResponse.json(
        { error: 'Rekening kas harus dipilih' },
        { status: 400 }
      );
    }

    if (!body.jumlah_cicilan || body.jumlah_cicilan <= 0) {
      return NextResponse.json(
        { error: 'Jumlah cicilan harus lebih dari 0' },
        { status: 400 }
      );
    }

    // 1. Get penjualan data
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select('total, dibayar, status_pembayaran, customer_id')
      .eq('id', id)
      .single();

    if (penjualanError) throw penjualanError;

    const total = parseFloat(penjualan.total || '0');
    const dibayarSebelumnya = parseFloat(penjualan.dibayar || '0');
    const sisa = total - dibayarSebelumnya;
    const jumlahCicilan = parseFloat(body.jumlah_cicilan);


    // 2. Validasi cicilan tidak melebihi sisa
    if (jumlahCicilan > sisa) {
      return NextResponse.json(
        { error: `Cicilan melebihi sisa tagihan. Sisa: Rp. ${sisa.toLocaleString('id-ID')}` },
        { status: 400 }
      );
    }

    const dibayarBaru = dibayarSebelumnya + jumlahCicilan;
    const sisaBaru = total - dibayarBaru;
    const statusBaru = sisaBaru <= 0 ? 'Lunas' : 'Cicil';


    // 3. Update transaksi_penjualan
    await supabase
      .from('transaksi_penjualan')
      .update({
        dibayar: dibayarBaru,
        status_pembayaran: statusBaru,
        tanggal_transaksi_terakhir: body.tanggal_cicilan
      })
      .eq('id', id);


    // 4. Update piutang_penjualan (jika ada)
    const { data: piutang } = await supabase
      .from('piutang_penjualan')
      .select('*')
      .eq('penjualan_id', id)
      .single();

    if (piutang) {
      await supabase
        .from('piutang_penjualan')
        .update({
          dibayar: dibayarBaru,
          sisa: sisaBaru,
          status: statusBaru === 'Lunas' ? 'lunas' : (dibayarBaru > 0 ? 'cicil' : 'belum_lunas')
        })
        .eq('penjualan_id', id);

    }

    // 5. Get kas data
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('saldo, nama_kas')
      .eq('id', body.kas_id)
      .single();

    if (kasError) throw kasError;

    // 6. ✅ KAS BERTAMBAH (customer bayar cicilan)
    const saldoKasLama = parseFloat(kas.saldo);
    const saldoKasBaru = saldoKasLama + jumlahCicilan;
    

    await supabase
      .from('kas')
      .update({ saldo: saldoKasBaru })
      .eq('id', body.kas_id);

    // 7. ✅ Insert transaksi kas (KREDIT = uang masuk)
    await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: body.kas_id,
        tanggal_transaksi: body.tanggal_cicilan,
        kredit: jumlahCicilan,
        debit: 0,
        keterangan: body.keterangan || `Cicilan penjualan #${id}`
      });

    // 8. Insert history cicilan
    await supabase
      .from('cicilan_penjualan')
      .insert({
        penjualan_id: parseInt(id),
        tanggal_cicilan: body.tanggal_cicilan,
        jumlah_cicilan: jumlahCicilan,
        kas_id: body.kas_id,
        keterangan: body.keterangan || ''
      });


    return NextResponse.json({
      success: true,
      message: statusBaru === 'Lunas' 
        ? '🎉 Cicilan berhasil! Piutang LUNAS!' 
        : `Cicilan berhasil! Sisa: Rp. ${sisaBaru.toLocaleString('id-ID')}`,
      data: {
        dibayar: dibayarBaru,
        sisa: sisaBaru,
        status: statusBaru,
        saldoKasBaru
      }
    });
  } catch (error: any) {
    console.error('❌ Error cicilan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
