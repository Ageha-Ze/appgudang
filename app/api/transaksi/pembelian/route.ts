// app/api/transaksi/pembelian/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { calculatePembelianTotals } from '@/lib/transaksi/calculatePembelianTotals';

// GET - List semua pembelian
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Fetch all data first without pagination for proper search filtering
    let query = supabase
      .from('transaksi_pembelian')
      .select(`
        *,
        suplier (id, nama),
        cabang (id, nama_cabang, kode_cabang),
        detail_pembelian (id, jumlah, harga, subtotal)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    const { data: allData, error } = await query;
    if (error) throw error;

    // Calculate tagihan for all data
    let dataWithTagihan = await Promise.all(
      (allData || []).map(async (p) => {
        // Use centralized helper to derive subtotal/finalTotal
        const { subtotal, finalTotal } = calculatePembelianTotals(p as any);

        // Ambil total cicilan
        const { data: cicilanList } = await supabase
          .from('cicilan_pembelian')
          .select('jumlah_cicilan')
          .eq('pembelian_id', p.id);

        const totalCicilan =
          cicilanList?.reduce(
            (sum, c) => sum + Number(c.jumlah_cicilan || 0),
            0
          ) || 0;

        // Hitung tagihan akhir: finalTotal - (uang_muka + totalCicilan)
        const tagihan = finalTotal - ((p.uang_muka || 0) + totalCicilan);

        return {
          ...p,
          subtotal,
          finalTotal,
          tagihan: Math.max(0, tagihan),
        };
      })
    );

    // Apply search filter if needed
    if (search) {
      const searchLower = search.toLowerCase();
      dataWithTagihan = dataWithTagihan.filter((item: any) => {
        return (
          item.nota_supplier?.toLowerCase().includes(searchLower) ||
          item.status?.toLowerCase().includes(searchLower) ||
          item.status_barang?.toLowerCase().includes(searchLower) ||
          item.status_pembayaran?.toLowerCase().includes(searchLower) ||
          item.suplier?.nama?.toLowerCase().includes(searchLower) ||
          item.cabang?.nama_cabang?.toLowerCase().includes(searchLower) ||
          item.keterangan?.toLowerCase().includes(searchLower) ||
          new Date(item.tanggal).toLocaleDateString('id-ID').includes(searchLower) ||
          item.total?.toString().includes(searchLower) ||
          item.tagihan?.toString().includes(searchLower) ||
          item.subtotal?.toString().includes(searchLower) ||
          item.finalTotal?.toString().includes(searchLower)
        );
      });
    }

    // Calculate pagination based on filtered data
    const totalRecords = dataWithTagihan.length;
    const totalPages = Math.ceil(totalRecords / limit);
    
    // Apply pagination
    const paginatedData = dataWithTagihan.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching pembelian:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create pembelian baru
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();


    // ✅ Validasi required fields
    if (!body.tanggal || !body.suplier_id || !body.cabang_id) {
      return NextResponse.json(
        { error: 'Tanggal, Supplier, dan Cabang wajib diisi' },
        { status: 400 }
      );
    }

    // ✅ Validasi kas_id jika ada uang muka
    const uangMuka = body.show_uang_muka ? parseFloat(body.uang_muka || '0') : 0;
    
    if (uangMuka > 0 && !body.kas_id) {
      return NextResponse.json(
        { error: 'Kas wajib dipilih jika ada uang muka' },
        { status: 400 }
      );
    }

    // ✅ Generate nota supplier (improved: filter by today's date)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    const { data: lastPembelian } = await supabase
      .from('transaksi_pembelian')
      .select('nota_supplier')
      .like('nota_supplier', `PB-${today}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let notaNumber = 1;

    if (lastPembelian?.nota_supplier) {
      const lastNumber = parseInt(lastPembelian.nota_supplier.split('-').pop() || '0');
      notaNumber = lastNumber + 1;
    }

    const nota_supplier = `PB-${today}-${notaNumber.toString().padStart(4, '0')}`;


    // ✅ Prepare initial totals (will be recalculated after detail added)
    const biayaKirim = body.show_biaya_kirim ? parseFloat(body.biaya_kirim || '0') : 0;

    // ✅ Determine initial status_pembayaran
    // Will be updated later if uang_muka >= finalTotal
    let statusPembayaran = 'Belum Lunas';
    if (body.jenis_pembayaran === 'Tunai' && uangMuka > 0) {
      // Will check against finalTotal after calculating
      statusPembayaran = 'Belum Lunas'; // Default, will update later
    }

    // ✅ Prepare pembelian data
    const pembelianData = {
      tanggal: body.tanggal,
      suplier_id: body.suplier_id,
      cabang_id: body.cabang_id,
      nota_supplier,
      total: 0, // Will be calculated from detail
      biaya_kirim: biayaKirim,
      uang_muka: uangMuka,
      kas_id: body.kas_id || null,
      jenis_pembayaran: body.jenis_pembayaran || 'Tunai',
      status: 'pending',
      status_barang: 'Belum Diterima',
      status_pembayaran: statusPembayaran,
      keterangan: body.keterangan || '',
    };


    // ✅ Insert pembelian
    const { data: pembelian, error: insertError } = await supabase
      .from('transaksi_pembelian')
      .insert(pembelianData)
      .select(`
        *,
        suplier(id, nama),
        cabang(id, nama_cabang, kode_cabang)
      `)
      .single();

    if (insertError) {
      console.error('Error inserting pembelian:', insertError);
      throw insertError;
    }


    // ✅ Update kas jika ada uang muka
    if (uangMuka > 0 && body.kas_id) {

      // Get current saldo kas
      const { data: kas, error: kasError } = await supabase
        .from('kas')
        .select('saldo, nama_kas')
        .eq('id', body.kas_id)
        .single();

      if (kasError) {
        console.error('Error fetching kas:', kasError);
        // Rollback pembelian
        await supabase
          .from('transaksi_pembelian')
          .delete()
          .eq('id', pembelian.id);
        
        return NextResponse.json({
          error: 'Kas tidak ditemukan'
        }, { status: 404 });
      }

      const saldoLama = parseFloat(kas.saldo?.toString() || '0');

      // ✅ Validasi: Cek saldo mencukupi
      if (saldoLama < uangMuka) {
        // Rollback pembelian
        await supabase
          .from('transaksi_pembelian')
          .delete()
          .eq('id', pembelian.id);
        
        return NextResponse.json({
          error: `Saldo kas ${kas.nama_kas} tidak mencukupi. Tersedia: ${saldoLama}, Dibutuhkan: ${uangMuka}`
        }, { status: 400 });
      }

      const saldoBaru = saldoLama - uangMuka;


      // Update saldo kas
      const { error: updateKasError } = await supabase
        .from('kas')
        .update({ 
          saldo: saldoBaru,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.kas_id);

      if (updateKasError) {
        console.error('Error updating kas:', updateKasError);
        // Rollback pembelian
        await supabase
          .from('transaksi_pembelian')
          .delete()
          .eq('id', pembelian.id);
        
        throw new Error('Gagal update saldo kas');
      }

      // Insert transaksi kas
      const { error: transaksiKasError } = await supabase
        .from('transaksi_kas')
        .insert({
          kas_id: body.kas_id,
          tanggal_transaksi: body.tanggal,
          debit: uangMuka, // Debit = uang keluar
          kredit: 0,
          keterangan: `Uang muka pembelian ${nota_supplier}`
        });

      if (transaksiKasError) {
        console.error('⚠️ Warning: Failed to record transaksi kas:', transaksiKasError);
        // Don't rollback, saldo already updated
      }

    }

    // ✅ Compute canonical totals and attach for client
    let pembelianEnriched: any = pembelian;
    try {
      const { subtotal, finalTotal } = calculatePembelianTotals(pembelianEnriched as any);
      
      // Calculate initial tagihan (before any cicilan)
      const tagihan = finalTotal - uangMuka;
      
      pembelianEnriched = { 
        ...pembelianEnriched, 
        subtotal, 
        finalTotal, 
        tagihan: Math.max(0, tagihan)
      };


      // ✅ Update status pembayaran if uang_muka >= finalTotal
      if (uangMuka >= finalTotal && finalTotal > 0) {
        await supabase
          .from('transaksi_pembelian')
          .update({ status_pembayaran: 'Lunas' })
          .eq('id', pembelian.id);
        
        pembelianEnriched.status_pembayaran = 'Lunas';
      }
    } catch (e) {
      console.error('Error calculating totals:', e);
    }


    return NextResponse.json({
      success: true,
      data: pembelian,
      pembelian: pembelianEnriched,
      message: 'Pembelian berhasil dibuat' + (uangMuka > 0 ? ' dan uang muka tercatat' : ''),
      kas_updated: uangMuka > 0
    });
  } catch (error: any) {
    console.error('❌ Error creating pembelian:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal membuat pembelian' },
      { status: 500 }
    );
  }
}
