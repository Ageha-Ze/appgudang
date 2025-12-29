'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Fetch history cicilan
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('cicilan_hutang_umum')
      .select(`
        *,
        kas:kas_id (id, nama_kas)
      `)
      .eq('hutang_id', id)
      .order('tanggal_cicilan', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching cicilan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Add cicilan or pelunasan
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();

    const { tanggal_cicilan, jumlah_cicilan, kas_id, keterangan, is_pelunasan } = body;


    // Get hutang info
    const { data: hutang, error: hutangError } = await supabase
      .from('hutang_umum')
      .select('dibayar, sisa, nominal_total, pihak')
      .eq('id', id)
      .single();

    if (hutangError || !hutang) {
      return NextResponse.json({ error: 'Hutang tidak ditemukan' }, { status: 404 });
    }


    let jumlahBayar = Number(jumlah_cicilan);

    // Jika pelunasan, bayar semua sisa
    if (is_pelunasan) {
      jumlahBayar = Number(hutang.sisa);
    }

    // Validasi jumlah cicilan tidak melebihi sisa
    if (jumlahBayar > Number(hutang.sisa)) {
      return NextResponse.json(
        { error: 'Jumlah cicilan melebihi sisa hutang' },
        { status: 400 }
      );
    }

    // ✅ Validasi saldo kas
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('saldo, nama_kas')
      .eq('id', kas_id)
      .single();

    if (kasError || !kas) {
      return NextResponse.json({ error: 'Kas tidak ditemukan' }, { status: 404 });
    }

    const kasSaldo = parseFloat(kas.saldo.toString());
    if (kasSaldo < jumlahBayar) {
      return NextResponse.json(
        { error: `Saldo kas tidak cukup. Saldo tersedia: Rp. ${kasSaldo.toLocaleString('id-ID')}` },
        { status: 400 }
      );
    }

    // ✅ Update kas DULU (kurangi saldo)
    const newKasSaldo = kasSaldo - jumlahBayar;
    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ saldo: newKasSaldo })
      .eq('id', kas_id);

    if (updateKasError) throw updateKasError;


    // Insert cicilan
    const { error: cicilanError } = await supabase
      .from('cicilan_hutang_umum')
      .insert({
        hutang_id: Number(id),
        tanggal_cicilan,
        jumlah_cicilan: jumlahBayar,
        kas_id: Number(kas_id),
        keterangan: keterangan || (is_pelunasan ? 'Pelunasan' : null),
      });

    if (cicilanError) throw cicilanError;

    // Update hutang
    const dibayarBaru = Number(hutang.dibayar) + jumlahBayar;
    const sisaBaru = Number(hutang.nominal_total) - dibayarBaru;


    const { error: updateError } = await supabase
      .from('hutang_umum')
      .update({
        dibayar: dibayarBaru,
        sisa: Math.max(0, sisaBaru), // ✅ Ensure tidak negatif
        status: sisaBaru <= 0 ? 'Lunas' : (dibayarBaru > 0 ? 'Cicil' : 'Belum Lunas'), // ✅ Fix status
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Insert transaksi kas (debit = uang keluar untuk bayar hutang)
    const { error: kasTransaksiError } = await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: Number(kas_id),
        tanggal_transaksi: tanggal_cicilan,
        debit: jumlahBayar, // ✅ Debit karena uang keluar untuk bayar hutang
        kredit: 0,
        keterangan: `Pembayaran ${is_pelunasan ? 'pelunasan' : 'cicilan'} hutang - ${hutang.pihak} #${id}`,
      });

    if (kasTransaksiError) throw kasTransaksiError;


    return NextResponse.json({
      success: true,
      message: is_pelunasan ? 'Hutang berhasil dilunasi' : 'Cicilan berhasil ditambahkan',
    });
  } catch (error: any) {
    console.error('❌ Error adding cicilan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// DELETE - Delete cicilan

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const cicilanId = searchParams.get('cicilanId');
    const hutangId = searchParams.get('hutangId');

    if (!cicilanId || !hutangId) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }


    // 1. Get cicilan info
    const { data: cicilan, error: cicilanError } = await supabase
      .from('cicilan_hutang_umum')
      .select('jumlah_cicilan, kas_id, tanggal_cicilan')
      .eq('id', cicilanId)
      .single();

    if (cicilanError || !cicilan) {
      return NextResponse.json({ error: 'Cicilan tidak ditemukan' }, { status: 404 });
    }

    const jumlahCicilan = parseFloat(cicilan.jumlah_cicilan.toString());


    // 2. Get kas info and restore saldo (kembalikan uang ke kas)
    const { data: kas, error: kasError } = await supabase
      .from('kas')
      .select('saldo, nama_kas')
      .eq('id', cicilan.kas_id)
      .single();

    if (kas && !kasError) {
      const kasSaldo = parseFloat(kas.saldo.toString());
      const newSaldo = kasSaldo + jumlahCicilan;

      // Update kas
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
          kredit: jumlahCicilan,
          keterangan: `Pembatalan cicilan hutang #${hutangId}`,
        });
    }

    // 3. Delete transaksi_kas yang terkait dengan cicilan ini (cleanup)
    await supabase
      .from('transaksi_kas')
      .delete()
      .eq('kas_id', cicilan.kas_id)
      .eq('debit', jumlahCicilan)
      .eq('tanggal_transaksi', cicilan.tanggal_cicilan)
      .ilike('keterangan', `%hutang%${hutangId}%`);

    // 4. Delete cicilan
    const { error: deleteError } = await supabase
      .from('cicilan_hutang_umum')
      .delete()
      .eq('id', cicilanId);

    if (deleteError) throw deleteError;


    // 5. Get hutang info untuk recalculate
    const { data: hutang, error: hutangError } = await supabase
      .from('hutang_umum')
      .select('nominal_total, dibayar')
      .eq('id', hutangId)
      .single();

    if (hutangError || !hutang) {
      throw new Error('Hutang tidak ditemukan');
    }

    // 6. Recalculate total dibayar dari cicilan yang tersisa
    const { data: remainingCicilan, error: remainingError } = await supabase
      .from('cicilan_hutang_umum')
      .select('jumlah_cicilan')
      .eq('hutang_id', hutangId);

    if (remainingError) throw remainingError;

    const totalDibayar = (remainingCicilan || []).reduce(
      (sum: number, c: any) => sum + parseFloat(c.jumlah_cicilan || 0),
      0
    );

    const nominalTotal = parseFloat(hutang.nominal_total.toString());
    const sisaBaru = nominalTotal - totalDibayar;

    // ✅ Determine correct status
    let newStatus: 'Lunas' | 'Cicil' | 'Belum Lunas';
    if (sisaBaru <= 0) {
      newStatus = 'Lunas';
    } else if (totalDibayar > 0) {
      newStatus = 'Cicil';
    } else {
      newStatus = 'Belum Lunas';
    }


    // 7. Update hutang dengan data yang benar
    const { error: updateHutangError } = await supabase
      .from('hutang_umum')
      .update({
        dibayar: totalDibayar,
        sisa: Math.max(0, sisaBaru),
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hutangId);

    if (updateHutangError) throw updateHutangError;


    return NextResponse.json({
      success: true,
      message: 'Cicilan berhasil dihapus dan saldo kas dikembalikan',
      data: {
        dibayar_baru: totalDibayar,
        sisa_baru: sisaBaru,
        status_baru: newStatus,
      },
    });
  } catch (error: any) {
    console.error('❌ Error deleting cicilan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
