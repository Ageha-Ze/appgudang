// app/api/persediaan/stock-barang/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * ✅ FIXED: GET - Fetch stock overview
 * Stock diambil langsung dari produk.stok (single source of truth)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const cabang_id = parseInt(searchParams.get('cabang_id') || '0');

    const offset = (page - 1) * limit;

    console.log('📊 Fetching stock with params:', { page, limit, search, cabang_id });

    // ✅ Query langsung dari produk table
    let query = supabase
      .from('produk')
      .select('id, nama_produk, kode_produk, satuan, stok, hpp, harga', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`nama_produk.ilike.%${search}%,kode_produk.ilike.%${search}%`);
    }

    const { data: products, error, count } = await query
      .order('nama_produk')
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Ambil history summary per produk (untuk info tambahan)
    const produkIds = products?.map(p => p.id) || [];
    
    let historyQuery = supabase
      .from('stock_barang')
      .select('produk_id, jumlah, tipe, cabang_id');

    if (produkIds.length > 0) {
      historyQuery = historyQuery.in('produk_id', produkIds);
    }

    if (cabang_id > 0) {
      historyQuery = historyQuery.eq('cabang_id', cabang_id);
    }

    const { data: histories } = await historyQuery;

    // Group history by produk_id
    const historyMap = new Map<number, { masuk: number; keluar: number }>();
    
    histories?.forEach(h => {
      if (!historyMap.has(h.produk_id)) {
        historyMap.set(h.produk_id, { masuk: 0, keluar: 0 });
      }
      const summary = historyMap.get(h.produk_id)!;
      const jumlah = parseFloat(h.jumlah?.toString() || '0');
      
      if (h.tipe === 'masuk') summary.masuk += jumlah;
      if (h.tipe === 'keluar') summary.keluar += jumlah;
    });

    // Format data dengan stock dari produk.stok
    const formattedData = products?.map(p => {
      const history = historyMap.get(p.id) || { masuk: 0, keluar: 0 };
      const stock = parseFloat(p.stok?.toString() || '0');

      return {
        produk_id: p.id,
        nama_produk: p.nama_produk,
        kode_produk: p.kode_produk,
        satuan: p.satuan || 'Kg',
        stock: stock, // ✅ Langsung dari produk.stok
        stock_masuk: history.masuk,
        stock_keluar: history.keluar,
        hpp: p.hpp || 0,
        harga_jual: p.harga || 0,
        has_negative: stock < 0, // ✅ Flag warning
      };
    }) || [];

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    console.log(`✅ Returned ${formattedData.length} products`);

    return NextResponse.json({
      success: true,
      data: formattedData,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * ✅ FIXED: POST - Add/Remove stock (Manual Entry)
 * Pastikan tidak ada double recording
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const body = await request.json();

    const {
      produk_id,
      cabang_id,
      jumlah,
      tipe, // 'masuk' | 'keluar'
      hpp,
      harga_jual,
      persentase_harga_jual,
      keterangan,
    } = body;

    console.log('📝 Manual stock entry:', { produk_id, cabang_id, jumlah, tipe });

    // Validation
    if (!produk_id || !cabang_id || !jumlah || !tipe) {
      return NextResponse.json(
        { success: false, error: 'produk_id, cabang_id, jumlah, dan tipe wajib diisi' },
        { status: 400 }
      );
    }

    if (!['masuk', 'keluar'].includes(tipe)) {
      return NextResponse.json(
        { success: false, error: 'tipe harus "masuk" atau "keluar"' },
        { status: 400 }
      );
    }

    // Get current stock from produk table
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('stok, nama_produk, satuan, hpp')
      .eq('id', produk_id)
      .single();

    if (produkError) throw produkError;
    if (!produk) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    const currentStock = parseFloat(produk.stok?.toString() || '0');
    const jumlahFloat = parseFloat(jumlah);

    // Calculate new stock
    let newStock = currentStock;
    if (tipe === 'masuk') {
      newStock += jumlahFloat;
      console.log(`  📈 Stock masuk: ${currentStock} + ${jumlahFloat} = ${newStock}`);
    } else {
      newStock -= jumlahFloat;
      console.log(`  📉 Stock keluar: ${currentStock} - ${jumlahFloat} = ${newStock}`);
      
      // Validation: check if stock is sufficient
      if (newStock < 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Stock tidak mencukupi',
            detail: `Stock saat ini: ${currentStock} ${produk.satuan || 'unit'}, permintaan keluar: ${jumlahFloat} ${produk.satuan || 'unit'}`,
          },
          { status: 400 }
        );
      }
    }

    // ✅ Step 1: Update produk.stok DULU
    const updateData: any = { stok: newStock };

    // Update HPP if stock masuk
    if (hpp && tipe === 'masuk') {
      updateData.hpp = hpp;
      updateData.harga = hpp;
    }

    const { error: updateError } = await supabase
      .from('produk')
      .update(updateData)
      .eq('id', produk_id);

    if (updateError) {
      console.error('❌ Failed to update produk.stok:', updateError);
      throw updateError;
    }

    console.log('✅ Stock updated in produk table');

    // ✅ Step 2: Insert history SETELAH update berhasil
    const { data: stockData, error: insertError } = await supabase
      .from('stock_barang')
      .insert({
        produk_id,
        cabang_id,
        jumlah: jumlahFloat,
        tanggal: new Date().toISOString().split('T')[0],
        tipe,
        keterangan: keterangan || `Stock ${tipe} manual`,
        hpp: hpp || produk.hpp || 0,
        harga_jual: harga_jual || 0,
        persentase: persentase_harga_jual || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('⚠️ Warning: Failed to record history, rolling back stock...');
      
      // ✅ Rollback produk.stok jika insert history gagal
      await supabase
        .from('produk')
        .update({ stok: currentStock })
        .eq('id', produk_id);
      
      throw insertError;
    }

    console.log('✅ History recorded successfully');

    return NextResponse.json({
      success: true,
      message: `Stock ${tipe} berhasil ditambahkan`,
      data: stockData,
      detail: {
        produk: produk.nama_produk,
        jumlah: `${jumlahFloat} ${produk.satuan || 'unit'}`,
        stock_sebelum: `${currentStock} ${produk.satuan || 'unit'}`,
        stock_sesudah: `${newStock} ${produk.satuan || 'unit'}`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error managing stock:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
