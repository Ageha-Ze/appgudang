// app/api/transaksi/pembelian/[id]/billing/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pembelian_id } = await context.params;
    const body = await request.json();
    const supabase = await supabaseAuthenticated();


    // ✅ Check if already billed (PREVENT DUPLICATE)
    const { data: checkData, error: checkError } = await supabase
      .from('transaksi_pembelian')
      .select('status')
      .eq('id', parseInt(pembelian_id))
      .single();

    if (checkError) throw checkError;

    if (checkData.status === 'billed') {
      return NextResponse.json({
        error: 'Pembelian sudah di-billing sebelumnya'
      }, { status: 400 });
    }

    // Get pembelian with detail
    const { data: pembelian, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang
        ),
        detail_pembelian (
          id,
          produk_id,
          jumlah,
          harga,
          subtotal
        )
      `)
      .eq('id', parseInt(pembelian_id))
      .single();

    if (pembelianError) throw pembelianError;

    const uang_muka = Number(body.uang_muka || 0);
    const biaya_kirim = Number(body.biaya_kirim || 0);
    const rekening_bayar = body.rekening_bayar || null;

    // Validasi: jika ada uang muka, rekening wajib diisi
    if (uang_muka > 0 && !rekening_bayar) {
      return NextResponse.json({
        error: 'Rekening bayar wajib diisi jika ada uang muka'
      }, { status: 400 });
    }

    // Calculate totals
    const detail_pembelian = pembelian.detail_pembelian || [];
    const subtotal = detail_pembelian.reduce(
      (sum: number, item: any) => sum + Number(item.subtotal || 0),
      0
    );
    const finalTotal = subtotal + biaya_kirim;

    // ✅ Update pembelian with jatuh_tempo for transfer payments
    const updateData: any = {
      total: subtotal,
      biaya_kirim: biaya_kirim,
      uang_muka: uang_muka,
      rekening_bayar: rekening_bayar,
      status: 'billed',
      status_barang: 'Belum Diterima',
      status_pembayaran: uang_muka >= finalTotal ? 'Lunas' : (uang_muka > 0 ? 'Cicil' : 'Belum Lunas'),
      updated_at: new Date().toISOString()
    };

    // Add jatuh_tempo for hutang payments
    if (body.jatuh_tempo && pembelian.jenis_pembayaran === 'hutang') {
      updateData.jatuh_tempo = body.jatuh_tempo;
    }

    const { error: updateError } = await supabase
      .from('transaksi_pembelian')
      .update(updateData)
      .eq('id', parseInt(pembelian_id));

    if (updateError) throw updateError;


    // ✅ Handle DP/Uang Muka (BAYAR = KURANGI KAS)
    if (uang_muka > 0) {
      // Check if uang_muka already recorded
      const { data: cicilanCheck } = await supabase
        .from('cicilan_pembelian')
        .select('id')
        .eq('pembelian_id', parseInt(pembelian_id))
        .eq('type', 'uang_muka')
        .limit(1);

      const uangMukaAlreadyRecorded = cicilanCheck && cicilanCheck.length > 0;

      if (!uangMukaAlreadyRecorded) {
        // Insert cicilan uang muka
        const { error: cicilanError } = await supabase
          .from('cicilan_pembelian')
          .insert({
            pembelian_id: parseInt(pembelian_id),
            tanggal_cicilan: pembelian.tanggal,
            jumlah_cicilan: uang_muka,
            rekening: rekening_bayar,
            type: 'uang_muka',
            tipe_cicilan: 'uang_muka',
            keterangan: 'Uang Muka / DP saat Billing'
          });

        if (cicilanError) {
          console.error('Error inserting cicilan:', cicilanError);
          throw cicilanError;
        }

        // ✅ KURANGI KAS (karena uang sudah keluar untuk DP)
        if (rekening_bayar) {
          const { data: kasData, error: kasGetError } = await supabase
            .from('kas')
            .select('*')
            .eq('nama_kas', rekening_bayar)
            .single();

          if (kasGetError) {
            console.error('Error getting kas:', kasGetError);
            throw new Error('Rekening tidak ditemukan');
          }
          
          if (kasData) {
            const kasSaldo = parseFloat(kasData.saldo.toString());
            
            // Validasi saldo cukup
            if (kasSaldo < uang_muka) {
              throw new Error(`Saldo kas tidak cukup! Saldo: Rp ${kasSaldo.toLocaleString('id-ID')}, DP: Rp ${uang_muka.toLocaleString('id-ID')}`);
            }
            
            const newSaldo = kasSaldo - uang_muka;

            // Update saldo kas
            await supabase
              .from('kas')
              .update({
                saldo: newSaldo,
                updated_at: new Date().toISOString()
              })
              .eq('id', kasData.id);

            // Insert transaksi kas (DEBIT = uang keluar)
            await supabase
              .from('transaksi_kas')
              .insert({
                kas_id: kasData.id,
                tanggal_transaksi: pembelian.tanggal,
                debit: uang_muka, // Debit = pengeluaran
                kredit: 0,
                keterangan: `DP Pembelian (Nota: ${pembelian.nota_supplier})`
              });

          }
        }
      } else {
      }
    }

    // ✅ Create or update hutang_pembelian
    const totalHutang = finalTotal;
    const dibayar = uang_muka;
    const sisa = Math.max(0, totalHutang - dibayar);

    const { data: existingHutang } = await supabase
      .from('hutang_pembelian')
      .select('*')
      .eq('pembelian_id', parseInt(pembelian_id))
      .limit(1);

    if (existingHutang && existingHutang.length > 0) {
      await supabase
        .from('hutang_pembelian')
        .update({
          total_hutang: totalHutang,
          dibayar: dibayar,
          sisa: sisa,
          status: sisa <= 0 ? 'Lunas' : 'Belum Lunas',
          updated_at: new Date().toISOString()
        })
        .eq('pembelian_id', parseInt(pembelian_id));
      
    } else {
      await supabase
        .from('hutang_pembelian')
        .insert({
          pembelian_id: parseInt(pembelian_id),
          suplier_id: body.suplier_id || pembelian.suplier_id,
          total_hutang: totalHutang,
          dibayar: dibayar,
          sisa: sisa,
          status: sisa <= 0 ? 'Lunas' : 'Belum Lunas'
        });
      
    }


    // Return updated data
    const { data: updatedPembelian } = await supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        suplier:suplier_id (
          id,
          nama
        ),
        cabang:cabang_id (
          id,
          nama_cabang
        )
      `)
      .eq('id', parseInt(pembelian_id))
      .single();

    return NextResponse.json({
      success: true,
      message: uang_muka > 0 
        ? `Billing berhasil. DP Rp ${uang_muka.toLocaleString('id-ID')} telah dibayarkan.`
        : 'Billing berhasil. Gunakan menu Pelunasan/Cicilan untuk pembayaran.',
      pembelian: updatedPembelian,
      subtotal,
      finalTotal,
      uang_muka,
      biaya_kirim,
      sisa_hutang: sisa
    });

  } catch (error: any) {
    console.error('❌ Error billing pembelian:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
