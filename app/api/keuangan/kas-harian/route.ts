import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Ambil transaksi kas harian
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tanggal = searchParams.get('tanggal') || new Date().toISOString().split('T')[0];
    const kasId = searchParams.get('kas_id');

    let query = supabase.from('kas_harian').select('*');

    // Filter berdasarkan tanggal
    query = query
      .gte('tanggal', tanggal)
      .lt('tanggal', new Date(new Date(tanggal).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    // Filter berdasarkan kas_id jika ada
    if (kasId) {
      query = query.eq('kas_id', kasId);
    }

    // Order by created_at
    query = query.order('created_at', { ascending: true });

    const { data: transaksiData, error: transaksiError } = await query;

    if (transaksiError) {
      throw transaksiError;
    }

    // Format data dengan waktu
    const formattedData = transaksiData?.map(item => ({
      id: item.id,
      kas_id: item.kas_id,
      tanggal: item.tanggal,
      waktu: new Date(item.created_at).toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      jenis: item.jenis,
      kategori: item.kategori,
      keterangan: item.keterangan,
      jumlah: Number(item.jumlah),
      saldo_setelah: Number(item.saldo_setelah), // Ini saldo running balance kas yang bersangkutan
      created_at: item.created_at
    })) || [];


    // Hitung saldo awal, masuk, keluar hanya untuk kas yang dipilih
    let saldoAwal = 0;
    let totalMasuk = 0;
    let totalKeluar = 0;

    if (kasId) {
      // Debug: cek tanggal yang digunakan
      
      // Ambil saldo akhir transaksi terakhir sebelum tanggal ini (tidak peduli tanggal)
      const { data: transaksiTerakhir, error: errLast } = await supabase
        .from('kas_harian')
        .select('saldo_setelah, tanggal, created_at')
        .eq('kas_id', kasId)
        .lt('tanggal', tanggal)
        .order('created_at', { ascending: false })
        .limit(1);


      if (transaksiTerakhir && transaksiTerakhir.length > 0) {
        saldoAwal = Number(transaksiTerakhir[0].saldo_setelah);
      } else {
        // Jika belum ada transaksi sebelumnya, ambil dari tabel kas
        const { data: kasData } = await supabase
          .from('kas')
          .select('saldo')
          .eq('id', kasId)
          .single();
        
        if (kasData) {
          saldoAwal = Number(kasData.saldo);
        } else {
        }
      }

      // Hitung total masuk dan keluar untuk kas ini
      totalMasuk = formattedData
        .filter(t => t.jenis === 'masuk')
        .reduce((sum, t) => sum + t.jumlah, 0);

      totalKeluar = formattedData
        .filter(t => t.jenis === 'keluar')
        .reduce((sum, t) => sum + t.jumlah, 0);
    } else {
      // Jika tidak filter kas, hitung total semua kas
      // Group by kas_id untuk menghitung saldo awal masing-masing
      const kasIds = [...new Set(formattedData.map(t => t.kas_id))];
      
      for (const kid of kasIds) {
        const { data: lastTrans } = await supabase
          .from('kas_harian')
          .select('saldo_setelah')
          .eq('kas_id', kid)
          .lt('tanggal', tanggal)
          .order('created_at', { ascending: false })
          .limit(1);

        saldoAwal += lastTrans && lastTrans.length > 0 ? Number(lastTrans[0].saldo_setelah) : 0;
      }

      totalMasuk = formattedData
        .filter(t => t.jenis === 'masuk')
        .reduce((sum, t) => sum + t.jumlah, 0);

      totalKeluar = formattedData
        .filter(t => t.jenis === 'keluar')
        .reduce((sum, t) => sum + t.jumlah, 0);
    }

    const saldoAkhir = saldoAwal + totalMasuk - totalKeluar;

    return NextResponse.json({
      success: true,
      data: formattedData,
      saldo: {
        saldo_awal: saldoAwal,
        total_masuk: totalMasuk,
        total_keluar: totalKeluar,
        saldo_akhir: saldoAkhir
      }
    });

  } catch (error: any) {
    console.error('Error fetching kas harian:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil data kas harian'
      },
      { status: 500 }
    );
  }
}

// Helper function untuk format currency
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Fungsi untuk handle transfer antar kas
async function handleTransfer(body: any) {
  try {
    const { dari_kas_id, ke_kas_id, jumlah, keterangan, tanggal } = body;

    // Validasi
    if (!dari_kas_id || !ke_kas_id || !jumlah || !tanggal) {
      return NextResponse.json(
        { success: false, message: 'Data transfer tidak lengkap' },
        { status: 400 }
      );
    }

    if (dari_kas_id === ke_kas_id) {
      return NextResponse.json(
        { success: false, message: 'Tidak bisa transfer ke kas yang sama' },
        { status: 400 }
      );
    }

    if (jumlah <= 0) {
      return NextResponse.json(
        { success: false, message: 'Jumlah transfer harus lebih dari 0' },
        { status: 400 }
      );
    }

    // Ambil info kas dan saldo dari tabel kas
    const { data: kasData } = await supabase
      .from('kas')
      .select('*')
      .in('id', [dari_kas_id, ke_kas_id]);

    const dariKas = kasData?.find(k => k.id === dari_kas_id);
    const keKas = kasData?.find(k => k.id === ke_kas_id);

    if (!dariKas || !keKas) {
      return NextResponse.json(
        { success: false, message: 'Kas tidak ditemukan' },
        { status: 404 }
      );
    }

    // Ambil saldo dari tabel kas
    const saldoDari = Number(dariKas.saldo);
    const saldoKe = Number(keKas.saldo);

    // Cek saldo mencukupi
    if (saldoDari < jumlah) {
      return NextResponse.json(
        { success: false, message: `Saldo ${dariKas.nama_kas} tidak mencukupi. Saldo saat ini: ${saldoDari}` },
        { status: 400 }
      );
    }

    // Ambil saldo terakhir dari kas_harian untuk konsistensi running balance
    const { data: lastDariKas } = await supabase
      .from('kas_harian')
      .select('saldo_setelah')
      .eq('kas_id', dari_kas_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const runningBalanceDari = lastDariKas && lastDariKas.length > 0 
      ? Number(lastDariKas[0].saldo_setelah) 
      : saldoDari;

    const { data: lastKeKas } = await supabase
      .from('kas_harian')
      .select('saldo_setelah')
      .eq('kas_id', ke_kas_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const runningBalanceKe = lastKeKas && lastKeKas.length > 0 
      ? Number(lastKeKas[0].saldo_setelah) 
      : saldoKe;

    const now = new Date().toISOString();
    const keteranganFinal = keterangan || `Transfer dari ${dariKas.nama_kas} ke ${keKas.nama_kas}`;

    // Insert transaksi keluar di kas pengirim
    const { data: transKeluar, error: errorKeluar } = await supabase
      .from('kas_harian')
      .insert([
        {
          kas_id: dari_kas_id,
          tanggal,
          jenis: 'keluar',
          kategori: 'Transfer Keluar',
          keterangan: `${keteranganFinal} (ke ${keKas.nama_kas})`,
          jumlah: Number(jumlah),
          saldo_setelah: runningBalanceDari - Number(jumlah),
          created_at: now
        }
      ])
      .select()
      .single();

    if (errorKeluar) {
      throw errorKeluar;
    }

    // Insert transaksi masuk di kas penerima
    const { data: transMasuk, error: errorMasuk } = await supabase
      .from('kas_harian')
      .insert([
        {
          kas_id: ke_kas_id,
          tanggal,
          jenis: 'masuk',
          kategori: 'Transfer Masuk',
          keterangan: `${keteranganFinal} (dari ${dariKas.nama_kas})`,
          jumlah: Number(jumlah),
          saldo_setelah: runningBalanceKe + Number(jumlah),
          created_at: new Date(Date.parse(now) + 1).toISOString() // +1ms agar urutan jelas
        }
      ])
      .select()
      .single();

    if (errorMasuk) {
      // Rollback transaksi keluar jika gagal
      await supabase
        .from('kas_harian')
        .delete()
        .eq('id', transKeluar.id);
      
      throw errorMasuk;
    }

    // Update saldo di tabel kas
    const { error: updateDariError } = await supabase
      .from('kas')
      .update({ saldo: saldoDari - Number(jumlah) })
      .eq('id', dari_kas_id);

    if (updateDariError) {
      console.error('Error updating kas pengirim:', updateDariError);
      // Rollback transaksi
      await supabase.from('kas_harian').delete().in('id', [transKeluar.id, transMasuk.id]);
      throw new Error('Gagal update saldo kas pengirim');
    }

    const { error: updateKeError } = await supabase
      .from('kas')
      .update({ saldo: saldoKe + Number(jumlah) })
      .eq('id', ke_kas_id);

    if (updateKeError) {
      console.error('Error updating kas penerima:', updateKeError);
      // Rollback semua transaksi dan update kas pengirim
      await supabase.from('kas_harian').delete().in('id', [transKeluar.id, transMasuk.id]);
      await supabase.from('kas').update({ saldo: saldoDari }).eq('id', dari_kas_id);
      throw new Error('Gagal update saldo kas penerima');
    }


    return NextResponse.json({
      success: true,
      message: 'Transfer berhasil',
      data: {
        keluar: transKeluar,
        masuk: transMasuk
      }
    });

  } catch (error: any) {
    console.error('Error transfer:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal melakukan transfer'
      },
      { status: 500 }
    );
  }
}

// POST - Tambah transaksi kas atau transfer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle transfer antar kas
    if (action === 'transfer') {
      return await handleTransfer(body);
    }

    // Handle transaksi kas biasa
    const { kas_id, tanggal, jenis, kategori, keterangan, jumlah } = body;

    // Validasi input
    if (!kas_id || !tanggal || !jenis || !kategori || !keterangan || !jumlah) {
      return NextResponse.json(
        { success: false, message: 'Semua field harus diisi' },
        { status: 400 }
      );
    }

    if (jumlah <= 0) {
      return NextResponse.json(
        { success: false, message: 'Jumlah harus lebih dari 0' },
        { status: 400 }
      );
    }

    // Ambil info kas dan saldo dari tabel kas
    const { data: kasInfo } = await supabase
      .from('kas')
      .select('*')
      .eq('id', kas_id)
      .single();

    if (!kasInfo) {
      return NextResponse.json(
        { success: false, message: 'Kas tidak ditemukan' },
        { status: 404 }
      );
    }

    // Ambil saldo terakhir dari kas_harian untuk running balance
    const { data: lastTransaction, error: lastError } = await supabase
      .from('kas_harian')
      .select('saldo_setelah')
      .eq('kas_id', kas_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const saldoSebelumnya = lastTransaction && lastTransaction.length > 0 
      ? Number(lastTransaction[0].saldo_setelah) 
      : Number(kasInfo.saldo);

    // Hitung saldo setelah transaksi
    const saldoSetelah = jenis === 'masuk' 
      ? saldoSebelumnya + Number(jumlah)
      : saldoSebelumnya - Number(jumlah);

    // Cek jika saldo akan minus
    if (saldoSetelah < 0) {
      return NextResponse.json(
        { success: false, message: `Saldo tidak mencukupi. Saldo saat ini: ${formatCurrency(saldoSebelumnya)}` },
        { status: 400 }
      );
    }

    // Insert transaksi baru
    const { data: newTransaction, error: insertError } = await supabase
      .from('kas_harian')
      .insert([
        {
          kas_id: Number(kas_id),
          tanggal,
          jenis,
          kategori,
          keterangan,
          jumlah: Number(jumlah),
          saldo_setelah: saldoSetelah,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // CRITICAL: Update saldo di tabel kas
    const { error: updateKasError } = await supabase
      .from('kas')
      .update({ saldo: saldoSetelah })
      .eq('id', kas_id);

    if (updateKasError) {
      console.error('Error updating kas saldo:', updateKasError);
      // Rollback transaksi
      await supabase.from('kas_harian').delete().eq('id', newTransaction.id);
      throw new Error('Gagal update saldo kas');
    }


    return NextResponse.json({
      success: true,
      message: 'Transaksi berhasil disimpan',
      data: newTransaction
    });

  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal menyimpan transaksi'
      },
      { status: 500 }
    );
  }
}

// DELETE - Hapus transaksi kas
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID transaksi tidak valid' },
        { status: 400 }
      );
    }

    // Ambil data transaksi yang akan dihapus
    const { data: transactionToDelete, error: fetchError } = await supabase
      .from('kas_harian')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !transactionToDelete) {
      return NextResponse.json(
        { success: false, message: 'Transaksi tidak ditemukan' },
        { status: 404 }
      );
    }


    // Hapus transaksi
    const { error: deleteError } = await supabase
      .from('kas_harian')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Ambil transaksi setelahnya untuk kas yang sama
    const { data: laterTransactions } = await supabase
      .from('kas_harian')
      .select('*')
      .eq('kas_id', transactionToDelete.kas_id)
      .gt('created_at', transactionToDelete.created_at)
      .order('created_at', { ascending: true });

    // Hitung adjustment
    const adjustment = transactionToDelete.jenis === 'masuk' 
      ? -Number(transactionToDelete.jumlah)
      : Number(transactionToDelete.jumlah);


    if (laterTransactions && laterTransactions.length > 0) {
      // Update setiap transaksi setelahnya
      for (const trans of laterTransactions) {
        const newSaldo = Number(trans.saldo_setelah) + adjustment;
        
        await supabase
          .from('kas_harian')
          .update({ 
            saldo_setelah: newSaldo
          })
          .eq('id', trans.id);
      }

      // Update saldo di tabel kas dengan saldo transaksi terakhir yang sudah disesuaikan
      const lastTrans = laterTransactions[laterTransactions.length - 1];
      const finalSaldo = Number(lastTrans.saldo_setelah) + adjustment;
      
      
      await supabase
        .from('kas')
        .update({ 
          saldo: finalSaldo
        })
        .eq('id', transactionToDelete.kas_id);
    } else {
      // Jika tidak ada transaksi setelahnya, ambil saldo dari transaksi sebelumnya
      const { data: beforeTrans } = await supabase
        .from('kas_harian')
        .select('saldo_setelah')
        .eq('kas_id', transactionToDelete.kas_id)
        .lt('created_at', transactionToDelete.created_at)
        .order('created_at', { ascending: false })
        .limit(1);

      const newSaldo = beforeTrans && beforeTrans.length > 0 
        ? Number(beforeTrans[0].saldo_setelah)
        : 0;


      await supabase
        .from('kas')
        .update({ saldo: newSaldo })
        .eq('id', transactionToDelete.kas_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Transaksi berhasil dihapus dan saldo telah diperbarui'
    });

  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal menghapus transaksi'
      },
      { status: 500 }
    );
  }
}

// PUT - Update transaksi kas
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, jenis, kategori, keterangan, jumlah } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID transaksi tidak valid' },
        { status: 400 }
      );
    }

    // Ambil data transaksi lama
    const { data: oldTransaction, error: fetchError } = await supabase
      .from('kas_harian')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !oldTransaction) {
      return NextResponse.json(
        { success: false, message: 'Transaksi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Ambil transaksi sebelumnya untuk menghitung saldo
    const { data: previousTransaction } = await supabase
      .from('kas_harian')
      .select('saldo_setelah')
      .lt('created_at', oldTransaction.created_at)
      .order('created_at', { ascending: false })
      .limit(1);

    const saldoSebelumnya = previousTransaction && previousTransaction.length > 0 
      ? Number(previousTransaction[0].saldo_setelah) 
      : 0;

    // Hitung saldo baru setelah transaksi
    const saldoSetelah = jenis === 'masuk' 
      ? saldoSebelumnya + Number(jumlah)
      : saldoSebelumnya - Number(jumlah);

    if (saldoSetelah < 0) {
      return NextResponse.json(
        { success: false, message: 'Saldo tidak mencukupi untuk transaksi ini' },
        { status: 400 }
      );
    }

    // Update transaksi
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('kas_harian')
      .update({
        jenis,
        kategori,
        keterangan,
        jumlah: Number(jumlah),
        saldo_setelah: saldoSetelah
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update saldo untuk transaksi setelahnya
    const { data: laterTransactions } = await supabase
      .from('kas_harian')
      .select('*')
      .gt('created_at', oldTransaction.created_at)
      .order('created_at', { ascending: true });

    if (laterTransactions && laterTransactions.length > 0) {
      const adjustment = saldoSetelah - Number(oldTransaction.saldo_setelah);

      for (const trans of laterTransactions) {
        await supabase
          .from('kas_harian')
          .update({ 
            saldo_setelah: Number(trans.saldo_setelah) + adjustment 
          })
          .eq('id', trans.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transaksi berhasil diupdate',
      data: updatedTransaction
    });

  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengupdate transaksi'
      },
      { status: 500 }
    );
  }
}
