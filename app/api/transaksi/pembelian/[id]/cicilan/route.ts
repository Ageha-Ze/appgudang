'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - List cicilan by pembelian_id
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('cicilan_pembelian')
      .select('*')
      .eq('pembelian_id', id)
      .order('tanggal_cicilan', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Add cicilan
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id: pembelian_id } = await context.params;
    const body = await request.json();

    // Validate and update kas saldo
    if (body.rekening) {
      let kas = null;
      const rekeningValue = body.rekening.toString();

      // Try to find by ID first (if it's a number)
      const rekeningNum = parseInt(rekeningValue, 10);
      if (!isNaN(rekeningNum)) {
        const { data, error } = await supabase
          .from('kas')
          .select('*')
          .eq('id', rekeningNum)
          .single();

        if (!error && data) {
          kas = data;
        }
      }

      // If not found by ID, try by nama_kas
      if (!kas) {
        const { data, error } = await supabase
          .from('kas')
          .select('*')
          .eq('nama_kas', rekeningValue)
          .single();

        if (!error && data) {
          kas = data;
        }
      }

      // If still not found, return error
      if (!kas) {
        console.error('Kas lookup failed for rekening:', rekeningValue);
        return NextResponse.json({ error: 'Data kas tidak ditemukan' }, { status: 404 });
      }

      const kasSaldo = parseFloat(kas.saldo?.toString() || '0');
      const jumlahBayar = parseFloat(body.jumlah_cicilan?.toString() || '0');

      if (kasSaldo < jumlahBayar) {
        return NextResponse.json(
          { error: `Saldo kas tidak cukup. Saldo tersedia: Rp. ${kasSaldo.toLocaleString('id-ID')}` },
          { status: 400 }
        );
      }

      const newSaldo = kasSaldo - jumlahBayar;

      const { error: updateKasError } = await supabase
        .from('kas')
        .update({ saldo: newSaldo })
        .eq('id', kas.id);

      if (updateKasError) throw updateKasError;

      await supabase
        .from('transaksi_kas')
        .insert({
          kas_id: kas.id,
          tanggal_transaksi: body.tanggal_cicilan,
          debit: jumlahBayar,
          kredit: 0,
          keterangan: body.keterangan || `Pembayaran cicilan pembelian (ID: ${pembelian_id})` // ✅ Fix keterangan
        });
    }

    // Insert cicilan - ✅ Fix: tambahkan keterangan dan tipe_cicilan
    const { data: cicilan, error: cicilanError } = await supabase
      .from('cicilan_pembelian')
      .insert({
        pembelian_id: parseInt(pembelian_id),
        tanggal_cicilan: body.tanggal_cicilan,
        jumlah_cicilan: body.jumlah_cicilan,
        rekening: body.rekening,
        type: "cicilan",  // ✅ Gunakan 'type' bukan 'tipe_cicilan'
        tipe_cicilan: body.tipe_cicilan || 'cash', // ✅ Add tipe_cicilan field
        keterangan: body.keterangan || '' // ✅ Fix keterangan
      })
      .select()
      .single();

    if (cicilanError) throw cicilanError;

    if (body.rekening) {
      const { error: updateRekeningError } = await supabase
        .from('transaksi_pembelian')
        .update({ rekening_bayar: body.rekening })
        .eq('id', pembelian_id);
      
      if (updateRekeningError) {
        console.warn('Warning: Could not update rekening_bayar', updateRekeningError);
      }
    }

    // Update hutang_pembelian
    const { data: hutang, error: hutangError } = await supabase
      .from('hutang_pembelian')
      .select('*')
      .eq('pembelian_id', pembelian_id)
      .single();

    let hutangData = null;

    if (hutang) {
      const newDibayar = parseFloat(hutang.dibayar.toString()) + parseFloat(body.jumlah_cicilan.toString());
      const newSisa = parseFloat(hutang.total_hutang.toString()) - newDibayar;
      const newStatus = newSisa <= 0 ? 'Lunas' : 'Belum Lunas';

      const { data: updatedHutang, error: updateHutangError } = await supabase
        .from('hutang_pembelian')
        .update({
          dibayar: newDibayar,
          sisa: newSisa,
          status: newStatus
        })
        .eq('pembelian_id', pembelian_id)
        .select()
        .single();

      if (updateHutangError) throw updateHutangError;

      hutangData = updatedHutang;

      await supabase
        .from('transaksi_pembelian')
        .update({
          status_pembayaran: newSisa <= 0 ? 'Lunas' : 'Cicil'
        })
        .eq('id', pembelian_id);
    }

    let updatedPembelian = null;
    try {
      const result = await supabase
        .from('transaksi_pembelian')
        .select('*, suplier(id, nama), cabang(id, nama_cabang, kode_cabang), detail_pembelian(id, jumlah, harga, subtotal)')
        .eq('id', pembelian_id)
        .single();

      if ('data' in result) {
        updatedPembelian = result.data;
      }
    } catch (e) {}

    return NextResponse.json({
      data: cicilan,
      hutang: hutangData,
      pembelian: updatedPembelian,
      message: 'Cicilan berhasil ditambahkan'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update cicilan - ✅ Fix: kembalikan kas dulu sebelum potong yang baru
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id: pembelianId } = await context.params;
    const body = await request.json();

    const {
      cicilanId,
      tanggal_cicilan,
      jumlah_cicilan,
      rekening,
      keterangan,
    } = body;

    // Validasi
    if (!cicilanId || !tanggal_cicilan || !jumlah_cicilan || !rekening) {
      return NextResponse.json(
        { error: 'Field wajib tidak lengkap' },
        { status: 400 }
      );
    }

    // 1. Get old cicilan data
    const { data: oldCicilan, error: oldCicilanError } = await supabase
      .from('cicilan_pembelian')
      .select('*')
      .eq('id', cicilanId)
      .eq('pembelian_id', pembelianId)
      .single();

    if (oldCicilanError || !oldCicilan) {
      throw new Error('Cicilan tidak ditemukan');
    }

    const oldJumlah = parseFloat(oldCicilan.jumlah_cicilan || 0);
    const newJumlah = parseFloat(jumlah_cicilan);

    // 2. Get old kas info and RETURN money first
    let oldKas: any = null;
    
    // Try by ID first
    const oldRekeningNum = parseInt(oldCicilan.rekening, 10);
    if (!isNaN(oldRekeningNum)) {
      const { data } = await supabase
        .from('kas')
        .select('*')
        .eq('id', oldRekeningNum)
        .single();
      oldKas = data;
    }

    // If not found, try by nama_kas
    if (!oldKas) {
      const { data } = await supabase
        .from('kas')
        .select('*')
        .eq('nama_kas', oldCicilan.rekening)
        .single();
      oldKas = data;
    }

    // ✅ STEP 1: Return old money to old kas first
    if (oldKas && oldJumlah > 0) {
      const oldKasSaldo = parseFloat(oldKas.saldo || 0);
      const restoredSaldo = oldKasSaldo + oldJumlah;


      const { error: updateOldKasError } = await supabase
        .from('kas')
        .update({ saldo: restoredSaldo })
        .eq('id', oldKas.id);

      if (updateOldKasError) throw updateOldKasError;

      // Delete old transaksi_kas entry
      const { error: deleteTransaksiError } = await supabase
        .from('transaksi_kas')
        .delete()
        .eq('kas_id', oldKas.id)
        .eq('debit', oldJumlah)
        .ilike('keterangan', `%pembelian%${pembelianId}%`);

      if (deleteTransaksiError) {
        console.warn('Could not delete old transaksi_kas:', deleteTransaksiError);
      }
    }

    // 3. Get new kas info
    let newKas: any = null;
    const newRekeningNum = parseInt(rekening, 10);

    if (!isNaN(newRekeningNum)) {
      const { data } = await supabase
        .from('kas')
        .select('*')
        .eq('id', newRekeningNum)
        .single();
      newKas = data;
    }

    if (!newKas) {
      const { data } = await supabase
        .from('kas')
        .select('*')
        .eq('nama_kas', rekening)
        .single();
      newKas = data;
    }

    if (!newKas) {
      throw new Error('Rekening tidak ditemukan');
    }

    // ✅ STEP 2: Deduct from new kas (after restoration, balance should be enough)
    const newKasSaldo = parseFloat(newKas.saldo || 0);
    const finalSaldo = newKasSaldo - newJumlah;


    if (finalSaldo < 0) {
      throw new Error(`Saldo kas ${newKas.nama_kas} tidak mencukupi (tersedia: ${newKasSaldo}, butuh: ${newJumlah})`);
    }

    const { error: updateNewKasError } = await supabase
      .from('kas')
      .update({ saldo: finalSaldo })
      .eq('id', newKas.id);

    if (updateNewKasError) throw updateNewKasError;

    // Insert new transaksi_kas
    const { error: insertTransaksiError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: newKas.id,
        tanggal_transaksi: tanggal_cicilan,
        debit: newJumlah,
        kredit: 0,
        keterangan: keterangan || `Cicilan pembelian #${pembelianId} (Updated)`, // ✅ Fix keterangan
      });

    if (insertTransaksiError) throw insertTransaksiError;

    // 4. Update cicilan_pembelian - ✅ Fix: simpan keterangan
    const { error: updateCicilanError } = await supabase
      .from('cicilan_pembelian')
      .update({
        tanggal_cicilan: tanggal_cicilan,
        jumlah_cicilan: newJumlah,
        rekening: rekening,
        keterangan: keterangan || '', // ✅ Fix keterangan
      })
      .eq('id', cicilanId);

    if (updateCicilanError) throw updateCicilanError;

    // 5. Recalculate hutang_pembelian
    const { data: cicilanSum } = await supabase
      .from('cicilan_pembelian')
      .select('jumlah_cicilan')
      .eq('pembelian_id', pembelianId);

    const totalCicilan = (cicilanSum || []).reduce(
      (sum: number, c: any) => sum + parseFloat(c.jumlah_cicilan || 0),
      0
    );

    const { data: pembelian } = await supabase
      .from('transaksi_pembelian')
      .select('total')
      .eq('id', pembelianId)
      .single();

    const totalHutang = parseFloat(pembelian?.total || 0);
    const sisaHutang = Math.max(0, totalHutang - totalCicilan);

    const { error: updateHutangError } = await supabase
      .from('hutang_pembelian')
      .update({
        dibayar: totalCicilan,
        sisa: sisaHutang,
        status: sisaHutang <= 0 ? 'Lunas' : 'Belum Lunas',
      })
      .eq('pembelian_id', pembelianId);

    if (updateHutangError) throw updateHutangError;

    // 6. Update status_pembayaran
    const { error: updateStatusError } = await supabase
      .from('transaksi_pembelian')
      .update({
        status_pembayaran: sisaHutang <= 0 ? 'Lunas' : 'Cicil',
      })
      .eq('id', pembelianId);

    if (updateStatusError) throw updateStatusError;

    // 7. Get updated pembelian data
    const { data: updatedPembelian } = await supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        suplier:suplier_id (id, nama),
        cabang:cabang_id (id, nama_cabang)
      `)
      .eq('id', pembelianId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Cicilan berhasil diupdate',
      data: {
        old_amount: oldJumlah,
        new_amount: newJumlah,
        sisa_hutang: sisaHutang,
      },
      pembelian: updatedPembelian,
    });
  } catch (error: any) {
    console.error('❌ Error updating cicilan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete cicilan
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const cicilanId = searchParams.get('cicilanId');
    const pembelianId = searchParams.get('pembelianId');

    if (!cicilanId || !pembelianId) {
      return NextResponse.json({ error: 'Missing cicilanId or pembelianId' }, { status: 400 });
    }

    const { data: cicilan } = await supabase
      .from('cicilan_pembelian')
      .select('jumlah_cicilan, rekening')
      .eq('id', cicilanId)
      .single();

    if (cicilan) {
      const { data: kas } = await supabase
        .from('kas')
        .select('*')
        .eq('nama_kas', cicilan.rekening)
        .single();

      if (kas) {
        const kasSaldo = parseFloat(kas.saldo.toString());
        const jumlahKembali = parseFloat(cicilan.jumlah_cicilan.toString());
        const newSaldo = kasSaldo + jumlahKembali;

        await supabase
          .from('kas')
          .update({ saldo: newSaldo })
          .eq('id', kas.id);

        await supabase
          .from('transaksi_kas')
          .insert({
            kas_id: kas.id,
            tanggal_transaksi: new Date().toISOString().split('T')[0],
            debit: 0,
            kredit: jumlahKembali,
            keterangan: `Pembatalan cicilan pembelian (ID: ${pembelianId})`
          });
      }

      await supabase
        .from('cicilan_pembelian')
        .delete()
        .eq('id', cicilanId);

      const { data: hutang } = await supabase
        .from('hutang_pembelian')
        .select('*')
        .eq('pembelian_id', pembelianId)
        .single();

      if (hutang) {
        const newDibayar = parseFloat(hutang.dibayar.toString()) - parseFloat(cicilan.jumlah_cicilan.toString());
        const newSisa = parseFloat(hutang.total_hutang.toString()) - newDibayar;
        const newStatus = newSisa <= 0 ? 'Lunas' : 'Belum Lunas';

        await supabase
          .from('hutang_pembelian')
          .update({
            dibayar: newDibayar,
            sisa: newSisa,
            status: newStatus
          })
          .eq('pembelian_id', pembelianId);

        await supabase
          .from('transaksi_pembelian')
          .update({
            status_pembayaran: newSisa <= 0 ? 'Lunas' : newDibayar > 0 ? 'Cicil' : 'Belum Lunas'
          })
          .eq('id', pembelianId);

        try {
          const decJumlah = parseFloat(cicilan.jumlah_cicilan.toString());
          const { data: existingDec, error: existingDecError } = await supabase
            .from('transaksi_pembelian')
            .select('uang_muka')
            .eq('id', pembelianId)
            .single();

          if (existingDecError) throw existingDecError;

          const currentDec = existingDec?.uang_muka ? parseFloat(existingDec.uang_muka.toString()) : 0;
          const newUangMukaDec = Math.max(0, currentDec - decJumlah);

          const { error: updateDecError } = await supabase
            .from('transaksi_pembelian')
            .update({ uang_muka: newUangMukaDec })
            .eq('id', pembelianId);

          if (updateDecError) throw updateDecError;
        } catch (e) {
          console.warn('Could not decrement uang_muka automatically', e);
        }
      }
    }

    let updatedPembelian = null;
    try {
      const result = await supabase
        .from('transaksi_pembelian')
        .select('*, suplier(id, nama), cabang(id, nama_cabang, kode_cabang), detail_pembelian(id, jumlah, harga, subtotal)')
        .eq('id', pembelianId)
        .single();

      if ('data' in result) {
        updatedPembelian = result.data;
      }
    } catch (e) {}

    return NextResponse.json({ message: 'Cicilan berhasil dihapus', pembelian: updatedPembelian });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
