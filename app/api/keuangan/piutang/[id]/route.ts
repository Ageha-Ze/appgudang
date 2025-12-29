'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Detail piutang dengan history pembayaran
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const penjualanId = parseInt(id);

    if (isNaN(penjualanId)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // ✅ Get detail penjualan DENGAN detail_penjualan untuk kalkulasi total yang benar
    const { data: penjualan, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        id,
        nota_penjualan,
        tanggal,
        total,
        dibayar,
        status_pembayaran,
        jatuh_tempo,
        keterangan,
        cabang:cabang_id (
          id,
          nama_cabang
        ),
        customers:customer_id (
          id,
          nama,
          no_hp,
          alamat
        ),
        detail_penjualan (
          id,
          subtotal
        )
      `)
      .eq('id', penjualanId)
      .single();

    if (penjualanError) {
      console.error('Error fetching penjualan:', penjualanError);
      return NextResponse.json(
        { error: 'Data penjualan tidak ditemukan', details: penjualanError.message },
        { status: 404 }
      );
    }

    // Get history pembayaran dengan join ke tabel kas
    const { data: pembayaran, error: pembayaranError } = await supabase
      .from('cicilan_penjualan')
      .select(`
        id,
        jumlah_cicilan,
        tanggal_cicilan,
        keterangan,
        kas_id,
        kas:kas_id (
          id,
          nama_kas
        )
      `)
      .eq('penjualan_id', penjualanId)
      .order('tanggal_cicilan', { ascending: false });

    if (pembayaranError) {
      console.error('Error fetching pembayaran:', pembayaranError);
    }

    // ✅ HITUNG TOTAL REAL dari detail_penjualan
    const totalPiutang = penjualan.detail_penjualan?.reduce(
      (sum, detail) => sum + parseFloat(detail.subtotal?.toString() || '0'),
      0
    ) || parseFloat(penjualan.total?.toString() || '0');

    // 🔥 FIX UTAMA: HITUNG TERBAYAR DARI SUM CICILAN, BUKAN DARI FIELD dibayar!
    const terbayarDariCicilan = (pembayaran || []).reduce(
      (sum, cicilan) => sum + parseFloat(cicilan.jumlah_cicilan?.toString() || '0'),
      0
    );

    // Gunakan terbayar dari cicilan sebagai source of truth
    const terbayar = terbayarDariCicilan;
    let sisaPiutang = totalPiutang - terbayar;
    const persenPembayaran = totalPiutang > 0 ? (terbayar / totalPiutang) * 100 : 0;

    // 🔍 DEBUG LOG - Deteksi inkonsistensi data
    const dibayarFromDB = parseFloat(penjualan.dibayar?.toString() || '0');

    // ✅ DETECTION: Prevent negative balances when customer overpays
    if (terbayarDariCicilan > totalPiutang) {
      console.warn('💰 OVERPAYMENT DETECTED!');
      console.warn('   Customer paid:', terbayarDariCicilan, '(more than owed)');
      console.warn('   Transaction total:', totalPiutang);
      console.warn('   Correcting - setting sisa piutang = 0');
      sisaPiutang = 0;
    }


    // Handle relasi
    const cabang = Array.isArray(penjualan.cabang) 
      ? penjualan.cabang[0] 
      : penjualan.cabang;
    const customer = Array.isArray(penjualan.customers) 
      ? penjualan.customers[0] 
      : penjualan.customers;

    const result = {
      id: penjualan.id,
      nota: penjualan.nota_penjualan,
      tanggal: penjualan.tanggal 
        ? new Date(penjualan.tanggal).toISOString().split('T')[0] 
        : '',
      cabang: cabang?.nama_cabang || '-',
      cabangId: cabang?.id || 0,
      customer: customer?.nama || '-',
      customerId: customer?.id || 0,
      customerTelp: customer?.no_hp || '-',
      customerAlamat: customer?.alamat || '-',
      totalPiutang, // ✅ Total dari detail_penjualan
      terbayar, // ✅ Total dari SUM cicilan_penjualan (bukan dari field dibayar)
      sisaPiutang,
      persenPembayaran: Math.round(persenPembayaran),
      status: penjualan.status_pembayaran,
      jatuhTempo: penjualan.jatuh_tempo 
        ? new Date(penjualan.jatuh_tempo).toISOString().split('T')[0] 
        : '-',
      keterangan: penjualan.keterangan,
      pembayaran: (pembayaran || []).map(p => {
        const kas = Array.isArray(p.kas) ? p.kas[0] : p.kas;
        return {
          id: p.id,
          tanggal: p.tanggal_cicilan 
            ? new Date(p.tanggal_cicilan).toISOString().split('T')[0] 
            : '',
          jumlah: parseFloat(p.jumlah_cicilan?.toString() || '0'),
          keterangan: p.keterangan || '-',
          kas: kas?.nama_kas || `Kas ID: ${p.kas_id}`
        };
      })
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching detail piutang:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detail piutang', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Input pembayaran piutang
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const { jumlahBayar, tanggalBayar, keterangan, kasId } = await request.json();

    const penjualanId = parseInt(id);
    const amount = parseFloat(jumlahBayar);


    // Validasi input
    if (isNaN(penjualanId) || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Data pembayaran tidak valid' },
        { status: 400 }
      );
    }

    if (!kasId) {
      return NextResponse.json(
        { error: 'Akun kas harus dipilih' },
        { status: 400 }
      );
    }

    const kasIdInt = parseInt(kasId);
    if (isNaN(kasIdInt)) {
      return NextResponse.json(
        { error: 'ID kas tidak valid' },
        { status: 400 }
      );
    }

    // ✅ Fetch current data DENGAN detail_penjualan
    const { data: currentData, error: fetchError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        dibayar,
        total,
        status_pembayaran,
        nota_penjualan,
        customer_id,
        customers:customer_id(nama),
        detail_penjualan(subtotal)
      `)
      .eq('id', penjualanId)
      .single();

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Data penjualan tidak ditemukan' },
        { status: 404 }
      );
    }

    // 🔥 FIX: Ambil SUM cicilan yang sudah ada
    const { data: existingCicilan } = await supabase
      .from('cicilan_penjualan')
      .select('jumlah_cicilan')
      .eq('penjualan_id', penjualanId);

    const currentDibayarFromCicilan = (existingCicilan || []).reduce(
      (sum, c) => sum + parseFloat(c.jumlah_cicilan?.toString() || '0'),
      0
    );

    // ✅ HITUNG TOTAL REAL dari detail_penjualan
    const total = currentData.detail_penjualan?.reduce(
      (sum: number, detail: any) => sum + parseFloat(detail.subtotal?.toString() || '0'),
      0
    ) || parseFloat(currentData.total?.toString() || '0');

    const newDibayar = currentDibayarFromCicilan + amount;


    // Validasi pembayaran tidak melebihi total
    if (newDibayar > total) {
      console.error('❌ Pembayaran melebihi total piutang');
      return NextResponse.json(
        { error: `Jumlah pembayaran melebihi sisa piutang. Sisa: ${(total - currentDibayarFromCicilan).toLocaleString('id-ID')}` },
        { status: 400 }
      );
    }

    // Tentukan status baru
    const newStatus = newDibayar >= total ? 'Lunas' : 'Cicil';

    // 🔥 FIX: Update dibayar dengan nilai yang BENAR (dari sum cicilan)
    const { error: updateError } = await supabase
      .from('transaksi_penjualan')
      .update({
        dibayar: newDibayar, // ✅ Update dengan total cicilan yang benar
        status_pembayaran: newStatus
      })
      .eq('id', penjualanId);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      throw updateError;
    }


    // Insert into cicilan_penjualan
    const { data: cicilanData, error: insertError } = await supabase
      .from('cicilan_penjualan')
      .insert({
        penjualan_id: penjualanId,
        jumlah_cicilan: amount,
        tanggal_cicilan: tanggalBayar,
        keterangan: keterangan || 'Pembayaran piutang',
        kas_id: kasIdInt
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert cicilan error:', insertError);
      throw insertError;
    }


    // UPDATE KAS
    const { data: kasData, error: kasError } = await supabase
      .from('kas')
      .select('id, nama_kas, saldo')
      .eq('id', kasIdInt)
      .single();

    if (kasError || !kasData) {
      console.error('❌ Error fetching kas:', kasError);
      return NextResponse.json(
        { error: 'Data kas tidak ditemukan' },
        { status: 404 }
      );
    }

    const saldoLama = parseFloat(kasData.saldo.toString());
    const saldoBaru = saldoLama + amount;


    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ 
        saldo: saldoBaru,
        updated_at: new Date().toISOString()
      })
      .eq('id', kasIdInt);

    if (updateKasError) {
      console.error('❌ Error updating kas:', updateKasError);
      throw new Error('Gagal update saldo kas: ' + updateKasError.message);
    }


    // INSERT KE TRANSAKSI KAS
    const customer = Array.isArray(currentData.customers) 
      ? currentData.customers[0] 
      : currentData.customers;
    const customerName = customer?.nama || 'Customer';

    const { error: transaksiKasError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: kasIdInt,
        tanggal_transaksi: tanggalBayar,
        kredit: amount,
        debit: 0,
        keterangan: keterangan || `Pembayaran piutang dari ${customerName} - ${currentData.nota_penjualan}`
      });

    if (transaksiKasError) {
      console.error('⚠️ Warning - Error insert transaksi kas:', transaksiKasError);
    } else {
    }


    return NextResponse.json({
      success: true,
      message: newStatus === 'Lunas' 
        ? '🎉 Pembayaran berhasil! Piutang telah LUNAS.' 
        : 'Pembayaran berhasil dicatat dan kas diperbarui',
      data: {
        cicilan: cicilanData,
        newStatus,
        sisaPiutang: total - newDibayar,
        kas_info: {
          kas_id: kasData.id,
          nama_kas: kasData.nama_kas,
          jumlah_masuk: amount,
          saldo_sebelum: saldoLama,
          saldo_sesudah: saldoBaru,
        }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ ERROR INPUT PEMBAYARAN:', error);
    return NextResponse.json(
      { error: 'Failed to process pembayaran', details: error.message },
      { status: 500 }
    );
  }
}
