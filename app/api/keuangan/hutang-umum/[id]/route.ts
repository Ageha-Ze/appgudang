'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Fetch detail hutang
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('hutang_umum')
      .select(`
        *,
        kas:kas_id (id, nama_kas)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching hutang detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update hutang
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();

    const {
      jenis_hutang,
      tanggal_transaksi,
      pihak,
      keterangan,
      nominal_total,
      kas_id,
    } = body;

    // Get existing hutang untuk cek perubahan nominal
    const { data: existingHutang } = await supabase
      .from('hutang_umum')
      .select('nominal_total, dibayar')
      .eq('id', id)
      .single();

    const nominalBaru = Number(nominal_total);
    const dibayar = Number(existingHutang?.dibayar || 0);
    const sisaBaru = nominalBaru - dibayar;

    // Update hutang
    const { data, error } = await supabase
      .from('hutang_umum')
      .update({
        jenis_hutang,
        tanggal_transaksi,
        pihak,
        keterangan: keterangan || null,
        nominal_total: nominalBaru,
        sisa: sisaBaru,
        status: sisaBaru <= 0 ? 'Lunas' : (dibayar > 0 ? 'Cicil' : 'Belum Lunas'),
        kas_id: Number(kas_id),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Hutang berhasil diupdate',
      data,
    });
  } catch (error: any) {
    console.error('Error updating hutang:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete hutang (✅ Fix: hapus cicilan dulu, kembalikan kas)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;


    // 1. Get hutang data
    const { data: hutang, error: hutangError } = await supabase
      .from('hutang_umum')
      .select('*')
      .eq('id', id)
      .single();

    if (hutangError || !hutang) {
      return NextResponse.json({ error: 'Hutang tidak ditemukan' }, { status: 404 });
    }


    // 2. Get all cicilan for this hutang
    const { data: cicilanList, error: cicilanError } = await supabase
      .from('cicilan_hutang_umum')
      .select('id, jumlah_cicilan, kas_id')
      .eq('hutang_id', id);

    if (cicilanError) throw cicilanError;


    // 3. Restore kas for each cicilan (kembalikan uang cicilan ke kas)
    if (cicilanList && cicilanList.length > 0) {
      for (const cicilan of cicilanList) {
        // Get kas info
        const { data: kas, error: kasError } = await supabase
          .from('kas')
          .select('saldo, nama_kas')
          .eq('id', cicilan.kas_id)
          .single();

        if (kas && !kasError) {
          const kasSaldo = parseFloat(kas.saldo.toString());
          const jumlahKembali = parseFloat(cicilan.jumlah_cicilan.toString());
          const newSaldo = kasSaldo + jumlahKembali;

          // Update kas (kembalikan uang)
          const { error: updateKasError } = await supabase
            .from('kas')
            .update({ saldo: newSaldo })
            .eq('id', cicilan.kas_id);

          if (updateKasError) {
            console.warn('⚠️ Could not update kas:', updateKasError);
          } else {
          }

          // Insert transaksi kas (kredit = uang masuk kembali)
          await supabase
            .from('transaksi_kas')
            .insert({
              kas_id: cicilan.kas_id,
              tanggal_transaksi: new Date().toISOString().split('T')[0],
              debit: 0,
              kredit: jumlahKembali,
              keterangan: `Pembatalan hutang #${id} - pengembalian cicilan`,
            });
        }
      }
    }

    // 4. Delete all cicilan first (to avoid FK constraint)
    const { error: deleteCicilanError } = await supabase
      .from('cicilan_hutang_umum')
      .delete()
      .eq('hutang_id', id);

    if (deleteCicilanError) throw deleteCicilanError;


    // 5. Delete transaksi kas related to this hutang (optional cleanup)
    await supabase
      .from('transaksi_kas')
      .delete()
      .ilike('keterangan', `%hutang #${id}%`);

    // 6. Now delete the hutang (FK constraint satisfied)
    const { error: deleteHutangError } = await supabase
      .from('hutang_umum')
      .delete()
      .eq('id', id);

    if (deleteHutangError) throw deleteHutangError;


    return NextResponse.json({
      success: true,
      message: 'Hutang dan semua cicilan berhasil dihapus. Kas telah dikembalikan.',
    });
  } catch (error: any) {
    console.error('❌ Error deleting hutang:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
