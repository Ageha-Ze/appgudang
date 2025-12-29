// app/api/transaksi/pembelian/[id]/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { calculatePembelianTotals } from '@/lib/transaksi/calculatePembelianTotals';
import { 
  validateStockDeletion, 
  restoreStock, 
  logAuditTrail 
} from '@/lib/helpers/stockSafety';

// GET - Detail pembelian by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;


    // Validasi ID
    if (!id || id === 'undefined') {
      return NextResponse.json(
        { success: false, // ✅ Tambahkan
          error: 'ID tidak valid' },
        { status: 400 }
      );
    }

    // Query dengan select relasi yang lengkap
    const { data: pembelian, error: pembelianError } = await supabase
      .from('transaksi_pembelian')
      .select('*')
      .eq('id', id)
      .single();

    if (pembelianError) {
      console.error('Supabase error:', pembelianError);
      return NextResponse.json(
        { error: pembelianError.message, details: pembelianError },
        { status: 500 }
      );
    }

    if (!pembelian) {
      return NextResponse.json(
        { error: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }

    // Fetch related data separately untuk memastikan data lengkap
    const { data: suplier } = await supabase
      .from('suplier')
      .select('id, nama, alamat, no_telp') // ✅ Tambahkan alamat & no_telp
      .eq('id', pembelian.suplier_id)
      .single();

    const { data: cabang } = await supabase
      .from('cabang')
      .select('id, nama_cabang, kode_cabang, alamat, no_telp') // ✅ Tambahkan alamat & no_telp
      .eq('id', pembelian.cabang_id)
      .single();

    const { data: detail_pembelian } = await supabase
      .from('detail_pembelian')
      .select('*')
      .eq('pembelian_id', id);

    // ✅ PENTING: Fetch produk untuk setiap detail dengan kode_produk
    const detailsWithProduk = await Promise.all(
      (detail_pembelian || []).map(async (detail) => {
        const { data: produk, error: produkError } = await supabase
          .from('produk')
          .select('id, nama_produk, kode_produk, satuan, is_jerigen, harga, hpp')
          .eq('id', detail.produk_id)
          .single();
        
        if (produkError) {
          console.error('Error fetching produk for detail:', detail.id, produkError);
        }
        
        
        return { ...detail, produk };
      })
    );

    const data = {
      ...pembelian,
      suplier,
      cabang,
      detail_pembelian: detailsWithProduk
    };

    // Compute canonical totals and outstanding tagihan
    try {
      const { subtotal, finalTotal } = calculatePembelianTotals(data as any);

      const { data: cicilanList } = await supabase
        .from('cicilan_pembelian')
        .select('jumlah_cicilan')
        .eq('pembelian_id', id);

      const totalCicilan = (cicilanList || []).reduce((s: number, c: any) => s + Number(c.jumlah_cicilan || 0), 0);
      const tagihan = Math.max(0, finalTotal - ((data.uang_muka || 0) + totalCicilan));

      data.subtotal = subtotal;
      data.finalTotal = finalTotal;
      data.tagihan = tagihan;
    } catch (e) {
      console.warn('Could not compute totals for pembelian detail', e);
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Exception:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// 🔍 Helper: Check if purchase stock has been consumed by sales
async function checkPurchaseStockConsumed(purchaseId: number) {
  try {
    const supabase = await supabaseAuthenticated();

    // Step 1: Get purchased items and quantities
    const { data: purchaseDetails } = await supabase
      .from('detail_pembelian')
      .select('produk_id, jumlah')
      .eq('pembelian_id', purchaseId);

    if (!purchaseDetails || purchaseDetails.length === 0) {
      return 0; // No stock was ever added from this purchase
    }

    let totalConsumedFromPurchase = 0;

    // Step 2: For each purchased product, check if stock level has decreased
    for (const detail of purchaseDetails) {
      const purchasedAmount = parseFloat(detail.jumlah?.toString() || '0');

      // Get current stock level
      const { data: currentStock } = await supabase
        .from('produk')
        .select('stok, nama_produk')
        .eq('id', detail.produk_id)
        .single();

      const currentStockLevel = parseFloat(currentStock?.stok?.toString() || '0');


      // If current stock is less than purchased amount, it was consumed
      // This accounts for sales, consignment, stock opname, or any consumption
      const consumedForProduct = purchasedAmount - currentStockLevel;

      if (consumedForProduct > 0) {
        totalConsumedFromPurchase += consumedForProduct;
      }
    }

    if (totalConsumedFromPurchase > 0) {
      return totalConsumedFromPurchase;
    }

    return 0;

  } catch (error) {
    console.error('Error checking purchase stock consumption:', error);
    throw error;
  }
}

// Move helper function to end of file

// PATCH - Update pembelian
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;
    const body = await request.json();


    // Validasi ID
    if (!id || id === 'undefined') {
      return NextResponse.json(
        { error: 'ID tidak valid' },
        { status: 400 }
      );
    }

    // ✅ Jika suplier_id diubah, auto-update cabang_id dari suplier
    let updateData = { ...body };
    
    if (body.suplier_id) {
      
      const { data: suplier, error: suplierError } = await supabase
        .from('suplier')
        .select('cabang_id')
        .eq('id', body.suplier_id)
        .single();

      if (suplierError) {
        console.error('Error fetching suplier:', suplierError);
        return NextResponse.json(
          { error: 'Supplier tidak ditemukan' },
          { status: 400 }
        );
      }

      // ✅ Override cabang_id dengan cabang dari supplier
      updateData.cabang_id = suplier.cabang_id;
    }

    // Update data
    const { data: updatedRow, error } = await supabase
      .from('transaksi_pembelian')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        suplier:suplier_id (
          id,
          nama,
          cabang:cabang_id (
            id,
            nama_cabang,
            kode_cabang
          )
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Data berhasil diupdate',
      data: updatedRow
    });
  } catch (error: any) {
    console.error('Error in PATCH:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// ✅ CLEAN DELETE PEMBELIAN with Helper Functions
// ============================================================
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await context.params;

    if (!id || id === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'ID tidak valid' },
        { status: 400 }
      );
    }


    // ============================================================
    // STEP 1: Get pembelian data
    // ============================================================
    const { data: pembelian, error: getPembelianError } = await supabase
      .from('transaksi_pembelian')
      .select(`
        id, nota_supplier, tanggal, total, 
        status_barang, jenis_pembayaran,
        cabang_id, suplier_id
      `)
      .eq('id', id)
      .single();

    if (getPembelianError || !pembelian) {
      return NextResponse.json(
        { success: false, error: 'Data pembelian tidak ditemukan' },
        { status: 404 }
      );
    }


    // ============================================================
    // STEP 2: Validate Stock Safety
    // ============================================================
    const stockValidation = await validateStockDeletion('pembelian', parseInt(id));
    
    if (!stockValidation.safe) {
      return NextResponse.json({
        success: false,
        error: stockValidation.message
      }, { status: 400 });
    }

    // ============================================================
    // STEP 3: Restore Stock (Remove from inventory)
    // ============================================================
    const stockResult = await restoreStock('pembelian', parseInt(id));

    // ============================================================
    // STEP 4: Restore Kas from Cicilan
    // ============================================================
    const { data: cicilanList } = await supabase
      .from('cicilan_pembelian')
      .select('id, jumlah_cicilan, rekening, kas_id')
      .eq('pembelian_id', id);

    const kasRestorations = [];
    
    if (cicilanList && cicilanList.length > 0) {
      
      for (const cicilan of cicilanList) {
        // Use kas_id if available, otherwise try to find by rekening name
        let kasId = cicilan.kas_id;
        
        if (!kasId && cicilan.rekening) {
          const { data: kas } = await supabase
            .from('kas')
            .select('id')
            .eq('nama_kas', cicilan.rekening)
            .single();
          
          kasId = kas?.id;
        }

        if (kasId) {
          const jumlahKembali = parseFloat(cicilan.jumlah_cicilan.toString());
          
          // Get kas data
          const { data: kas } = await supabase
            .from('kas')
            .select('saldo, nama_kas')
            .eq('id', kasId)
            .single();

          if (kas) {
            const kasSaldo = parseFloat(kas.saldo.toString());
            const newSaldo = kasSaldo + jumlahKembali;

            // Update kas
            await supabase
              .from('kas')
              .update({ saldo: newSaldo })
              .eq('id', kasId);


            // Delete transaksi_kas
            await supabase
              .from('transaksi_kas')
              .delete()
              .eq('kas_id', kasId)
              .ilike('keterangan', `%${pembelian.nota_supplier}%`);

            kasRestorations.push({
              kas: kas.nama_kas,
              amount: jumlahKembali
            });
          }
        }
      }
    }

    // ============================================================
    // STEP 5: Delete Cicilan
    // ============================================================
    await supabase
      .from('cicilan_pembelian')
      .delete()
      .eq('pembelian_id', id);

    // ============================================================
    // STEP 6: Delete Hutang
    // ============================================================
    await supabase
      .from('hutang_pembelian')
      .delete()
      .eq('pembelian_id', id);

    // ============================================================
    // STEP 7: Log Audit Trail
    // ============================================================
    const userId = request.headers.get('x-user-id');
    await logAuditTrail(
      'DELETE',
      'transaksi_pembelian',
      parseInt(id),
      pembelian,
      undefined,
      userId ? parseInt(userId) : undefined,
      request.headers.get('x-forwarded-for') || undefined
    );

    // ============================================================
    // STEP 8: Delete Detail Pembelian
    // ============================================================
    await supabase
      .from('detail_pembelian')
      .delete()
      .eq('pembelian_id', id);

    // ============================================================
    // STEP 9: Delete Transaksi Pembelian
    // ============================================================
    const { error: deleteError } = await supabase
      .from('transaksi_pembelian')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // ============================================================
    // STEP 10: Build Response
    // ============================================================
    const executionTime = Date.now() - startTime;
    const actions: string[] = [];

    if (stockResult.restored) actions.push(`stock dikembalikan (${stockResult.count} items)`);
    if (kasRestorations.length > 0) {
      const totalKas = kasRestorations.reduce((sum, k) => sum + k.amount, 0);
      actions.push(`saldo kas dikembalikan (Rp ${totalKas})`);
    }

    const message = actions.length > 0
      ? `Pembelian berhasil dihapus dan ${actions.join(', ')}`
      : 'Pembelian berhasil dihapus';


    return NextResponse.json({
      success: true,
      message: message,
      deleted: {
        pembelian_id: id,
        nota: pembelian.nota_supplier,
        stock_restored: stockResult.restored,
        stock_items: stockResult.count,
        kas_restorations: kasRestorations.length,
        execution_time_ms: executionTime
      },
      details: {
        stock_products: stockResult.products || [],
        kas_details: kasRestorations,
        validation: stockValidation
      }
    });

  } catch (error: any) {
    console.error('❌ ERROR DELETE PEMBELIAN:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Gagal menghapus pembelian' 
      },
      { status: 500 }
    );
  }
}
