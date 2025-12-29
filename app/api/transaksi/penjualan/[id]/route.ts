// app/api/transaksi/penjualan/[id]/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { 
  validateStockDeletion, 
  restoreStock, 
  restoreKasFromTransaction,
  logAuditTrail 
} from '@/lib/helpers/stockSafety';

// GET - Detail penjualan
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('transaksi_penjualan')
      .select(`
        *,
        customer:customer_id (id, nama, kode_customer),
        pegawai:pegawai_id (
          id, 
          nama, 
          jabatan,
          cabang_id,
          cabang:cabang_id (
            id,
            nama_cabang,
            kode_cabang,
            alamat,
            no_telp,
            email
          )
        ),
        detail_penjualan (
          id,
          jumlah,
          harga,
          subtotal,
          produk:produk_id (
            id,
            nama_produk,
            kode_produk,
            satuan
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Fetch total cicilan for this penjualan
    const { data: cicilans } = await supabase
      .from('cicilan_penjualan')
      .select('jumlah_cicilan')
      .eq('penjualan_id', id);

    const totalCicilan = cicilans?.reduce((sum, c) => sum + parseFloat(c.jumlah_cicilan.toString()), 0) || 0;

    // Calculate totals
    const subtotal = data.detail_penjualan?.reduce((sum: number, d: any) => sum + parseFloat(d.subtotal.toString()), 0) || 0;
    const biayaOngkir = parseFloat(data.biaya_ongkir?.toString() || '0');
    const biayaPotong = parseFloat(data.biaya_potong?.toString() || '0');
    const nilaiDiskon = parseFloat(data.nilai_diskon?.toString() || '0');
    const uangMuka = parseFloat(data.uang_muka?.toString() || '0');
    const finalTotal = subtotal + biayaOngkir + biayaPotong - nilaiDiskon;
    const tagihan = finalTotal - uangMuka - totalCicilan;

    // Set status_pembayaran berdasarkan status billing dan jenis pembayaran
    let statusPembayaran = data.status_pembayaran || 'Belum Dibayar';

    if (data.status === 'pending') {
      statusPembayaran = 'Belum Dibayar';
    } else if (data.status === 'billed') {
      if (data.jenis_pembayaran === 'tunai') {
        statusPembayaran = 'Lunas';
      } else if (data.jenis_pembayaran === 'hutang') {
        if (tagihan <= 0) {
          statusPembayaran = 'Lunas';
        } else {
          statusPembayaran = 'Hutang';
        }
      }
    }

    return NextResponse.json({ 
      data: {
        ...data,
        status_pembayaran: statusPembayaran,
        calculated_totals: {
          subtotal,
          biaya_ongkir: biayaOngkir,
          biaya_potong: biayaPotong,
          nilai_diskon: nilaiDiskon,
          uang_muka: uangMuka,
          final_total: finalTotal,
          total_cicilan: totalCicilan,
          tagihan
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}



// ============================================================
// ✅ ULTIMATE CLEAN DELETE with Foreign Keys
// ============================================================
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID penjualan tidak valid' },
        { status: 400 }
      );
    }


    // ============================================================
    // STEP 1: Get penjualan data
    // ============================================================
    const { data: penjualan, error: fetchError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        id, nota_penjualan, tanggal, total, dibayar,
        status, status_pembayaran, status_diterima, jenis_pembayaran,
        kas_id, cabang_id, customer_id
      `)
      .eq('id', id)
      .single();

    if (fetchError || !penjualan) {
      return NextResponse.json(
        { success: false, error: 'Data penjualan tidak ditemukan' },
        { status: 404 }
      );
    }


    // ============================================================
    // STEP 2: Validate - Check cicilan
    // ============================================================
    const { data: cicilan } = await supabase
      .from('cicilan_penjualan')
      .select('id, jumlah_cicilan')
      .eq('penjualan_id', id);

    if (cicilan && cicilan.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Tidak bisa hapus penjualan yang sudah ada pembayaran/cicilan' 
        },
        { status: 400 }
      );
    }

    // ============================================================
    // STEP 3: Validate Stock Safety (pakai helper)
    // ============================================================
    const stockValidation = await validateStockDeletion('penjualan', parseInt(id));
    
    if (!stockValidation.safe) {
      return NextResponse.json({
        success: false,
        error: stockValidation.message
      }, { status: 400 });
    }

    // ============================================================
    // STEP 4: Restore Stock (pakai helper)
    // ============================================================
    const stockResult = await restoreStock('penjualan', parseInt(id));

    // ============================================================
    // STEP 5: Restore Kas (if tunai)
    // ============================================================
    let kasResult = null;
    if (penjualan.jenis_pembayaran === 'tunai' && 
        penjualan.status === 'billed' && 
        penjualan.kas_id) {
      
      const jumlahDibayar = parseFloat(penjualan.dibayar?.toString() || '0');
      
      if (jumlahDibayar > 0) {
        try {
          kasResult = await restoreKasFromTransaction(
            penjualan.kas_id,
            jumlahDibayar,
            penjualan.nota_penjualan,
            true // Money came in (kredit), so we subtract to reverse
          );
          
        } catch (kasError: any) {
          console.error('⚠️ Warning: Kas restore failed:', kasError.message);
          // Don't block deletion, just warn
        }
      }
    }

    // ============================================================
    // STEP 6: Delete Piutang (if hutang)
    // ============================================================
    let piutangDeleted = false;
    if (penjualan.jenis_pembayaran === 'hutang') {
      const { error: deletePiutangError } = await supabase
        .from('piutang_penjualan')
        .delete()
        .eq('penjualan_id', parseInt(id));

      if (!deletePiutangError) {
        piutangDeleted = true;
      } else {
        console.error('⚠️ Warning: Piutang delete failed:', deletePiutangError);
      }
    }

    // ============================================================
    // STEP 7: Log Audit Trail
    // ============================================================
    const userId = request.headers.get('x-user-id');
    await logAuditTrail(
      'DELETE',
      'transaksi_penjualan',
      parseInt(id),
      penjualan,
      undefined,
      userId ? parseInt(userId) : undefined,
      request.headers.get('x-forwarded-for') || undefined
    );

    // ============================================================
    // STEP 8: Delete Detail Penjualan (or CASCADE)
    // ============================================================
    const { error: deleteDetailError } = await supabase
      .from('detail_penjualan')
      .delete()
      .eq('penjualan_id', id);

    if (deleteDetailError) {
      console.error('⚠️ Warning: Detail delete failed:', deleteDetailError);
    }

    // ============================================================
    // STEP 9: Delete Transaksi Penjualan
    // ============================================================
    const { error: deletePenjualanError } = await supabase
      .from('transaksi_penjualan')
      .delete()
      .eq('id', id);

    if (deletePenjualanError) {
      throw deletePenjualanError;
    }

    // ============================================================
    // STEP 10: Build Response
    // ============================================================
    const executionTime = Date.now() - startTime;
    const actions: string[] = [];

    if (stockResult.restored) actions.push(`stock dikembalikan (${stockResult.count} items)`);
    if (kasResult) actions.push(`uang dikembalikan ke kas (Rp ${kasResult.amount})`);
    if (piutangDeleted) actions.push('piutang dihapus');

    const message = actions.length > 0
      ? `Penjualan berhasil dibatalkan dan ${actions.join(', ')}`
      : 'Penjualan berhasil dibatalkan';


    return NextResponse.json({
      success: true,
      message: message,
      deleted: {
        penjualan_id: id,
        nota: penjualan.nota_penjualan,
        stock_restored: stockResult.restored,
        stock_items: stockResult.count,
        kas_restored: kasResult !== null,
        kas_amount: kasResult?.amount || 0,
        piutang_deleted: piutangDeleted,
        execution_time_ms: executionTime
      },
      details: {
        stock_products: stockResult.products || [],
        validation: stockValidation
      }
    });

  } catch (error: any) {
    console.error('❌ ERROR DELETE PENJUALAN:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Gagal menghapus penjualan' 
      },
      { status: 500 }
    );
  }
}

// PATCH - Update penjualan
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();

    // Cek apakah customer berubah dan perlu reset cicilan
    if (body.reset_cicilan === true && body.customer_id) {

      const { data: currentPenjualan } = await supabase
        .from('transaksi_penjualan')
        .select('customer_id, uang_muka')
        .eq('id', id)
        .single();

      if (currentPenjualan && currentPenjualan.customer_id !== body.customer_id) {
        
        const { data: cicilans } = await supabase
          .from('cicilan_penjualan')
          .select('id, jumlah_cicilan, kas_id, tanggal_cicilan')
          .eq('penjualan_id', id);


        if (cicilans && cicilans.length > 0) {
          for (const cicilan of cicilans) {
            if (cicilan.kas_id) {
              const { data: kas } = await supabase
                .from('kas')
                .select('*')
                .eq('id', cicilan.kas_id)
                .single();

              if (kas) {
                const kasSaldo = parseFloat(kas.saldo.toString());
                const jumlahCicilan = parseFloat(cicilan.jumlah_cicilan.toString());
                const newSaldo = kasSaldo - jumlahCicilan;

                await supabase
                  .from('kas')
                  .update({ saldo: newSaldo })
                  .eq('id', kas.id);


                await supabase
                  .from('transaksi_kas')
                  .insert({
                    kas_id: kas.id,
                    tanggal_transaksi: new Date().toISOString().split('T')[0],
                    debit: jumlahCicilan,
                    kredit: 0,
                    keterangan: 'Reset cicilan - Ganti customer (Penjualan ID: ' + id + ')'
                  });
              }
            }
          }

          const { error: deleteCicilanError } = await supabase
            .from('cicilan_penjualan')
            .delete()
            .eq('penjualan_id', id);

          if (deleteCicilanError) {
            console.error('Error deleting cicilans:', deleteCicilanError);
            throw deleteCicilanError;
          }

        }

        if (currentPenjualan.uang_muka && currentPenjualan.uang_muka > 0) {
          const { data: penjualanDetail } = await supabase
            .from('transaksi_penjualan')
            .select('kas_id')
            .eq('id', id)
            .single();

          if (penjualanDetail?.kas_id) {
            const { data: kas } = await supabase
              .from('kas')
              .select('*')
              .eq('id', penjualanDetail.kas_id)
              .single();

            if (kas) {
              const kasSaldo = parseFloat(kas.saldo.toString());
              const uangMuka = parseFloat(currentPenjualan.uang_muka.toString());
              const newSaldo = kasSaldo - uangMuka;

              await supabase
                .from('kas')
                .update({ saldo: newSaldo })
                .eq('id', kas.id);


              await supabase
                .from('transaksi_kas')
                .insert({
                  kas_id: kas.id,
                  tanggal_transaksi: new Date().toISOString().split('T')[0],
                  debit: uangMuka,
                  kredit: 0,
                  keterangan: 'Reset uang muka - Ganti customer (Penjualan ID: ' + id + ')'
                });
            }
          }
        }

        const { data: piutang } = await supabase
          .from('piutang_penjualan')
          .select('*')
          .eq('penjualan_id', id)
          .single();

        if (piutang) {
          await supabase
            .from('piutang_penjualan')
            .update({
              dibayar: 0,
              sisa: piutang.total_piutang,
              status: 'belum_lunas'
            })
            .eq('penjualan_id', id);

        }

        await supabase
          .from('transaksi_penjualan')
          .update({ 
            uang_muka: 0,
            status_pembayaran: 'Belum Lunas'
          })
          .eq('id', id);

      }
    }

    const updateData: any = {};
    
    if (body.tanggal) updateData.tanggal = body.tanggal;
    if (body.customer_id) updateData.customer_id = body.customer_id;
    if (body.pegawai_id) updateData.pegawai_id = body.pegawai_id;
    if (body.jenis_pembayaran) updateData.jenis_pembayaran = body.jenis_pembayaran;

    const { error } = await supabase
      .from('transaksi_penjualan')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    const { data: updatedPenjualan } = await supabase
      .from('transaksi_penjualan')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({ 
      message: 'Data berhasil diupdate',
      data: updatedPenjualan,
      reset_performed: body.reset_cicilan === true
    });
  } catch (error: any) {
    console.error('Error updating penjualan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
