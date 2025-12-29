// app/api/persediaan/stock-barang/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * ✅ FIXED: GET - Fetch stock overview
 * Stock diambil langsung dari produk.stok (single source of truth)
 * 
 * MODES:
 * - overview: For stock management page (paginated, with history)
 * - aggregated: For dropdown/selection (all products with stock > 0, no pagination)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const cabang_id = parseInt(searchParams.get('cabang_id') || '0');
    const mode = searchParams.get('mode') || 'overview';

    const offset = (page - 1) * limit;


    // ========================================
    // ✅ MODE: AGGREGATED (For Dropdown/Selection - BRANCH SPECIFIC)
    // ========================================
    if (mode === 'aggregated') {

      // Step 1: Only get products that exist in this branch
      const { data: stockData, error: stockError } = await supabase
        .from('stock_barang')
        .select('produk_id')
        .eq('cabang_id', cabang_id)
        .gt('jumlah', 0);

      if (stockError) {
        console.error('Error fetching stock data for cabang:', stockError);
        throw stockError;
      }

      // If no products in this branch
      if (!stockData || stockData.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
        });
      }

      // Extract unique produk IDs for this branch
      const produkIds = [...new Set(stockData.map(item => item.produk_id))];

      // Step 2: Calculate actual available stock for each product in this branch
      const bahan = [];
      for (const produkId of produkIds) {
        // Calculate current stock by summing all stock_barang transactions for this product in this cabang
        const { data: stockTransactions, error: stockError } = await supabase
          .from('stock_barang')
          .select('jumlah, tipe')
          .eq('produk_id', produkId)
          .eq('cabang_id', cabang_id);

        if (stockError) {
          console.error('Error getting stock transactions for produk:', produkId, stockError);
          continue;
        }

        // Calculate current stock: masuk + , keluar -
        let currentStock = 0;
        stockTransactions?.forEach((transaction: any) => {
          const amount = parseFloat(transaction.jumlah?.toString() || '0');
          if (transaction.tipe === 'masuk') {
            currentStock += amount;
          } else if (transaction.tipe === 'keluar') {
            currentStock -= amount;
          }
        });

        // Only include products with positive stock in this branch
        if (currentStock > 0) {
          // Get product details from master produk table
          const { data: produkData, error: produkError } = await supabase
            .from('produk')
            .select('id, nama_produk, kode_produk, satuan, hpp, harga')
            .eq('id', produkId)
            .single();

          if (produkError || !produkData) {
            console.warn('Produk not found in master table:', produkId);
            continue;
          }

          const harga_jual = parseFloat(produkData.harga?.toString() || '0');
          const hpp_val = parseFloat(produkData.hpp?.toString() || '0');

          bahan.push({
            produk_id: produkData.id,
            nama_produk: produkData.nama_produk,
            kode_produk: produkData.kode_produk,
            satuan: produkData.satuan || 'Kg',
            gudang: 'Cabang',
            total_stock: Math.max(0, currentStock), // ✅ REAL CABANG STOCK, not master stock
            hpp: hpp_val,
            harga_jual: harga_jual,
            persentase: hpp_val > 0 ? ((harga_jual - hpp_val) / hpp_val) * 100 : 0,
            stock_masuk: 0,
            stock_keluar: 0,
          });
        }
      }

      // Apply search filter if provided
      let filteredData = bahan;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = bahan.filter(item =>
          item.nama_produk.toLowerCase().includes(searchLower) ||
          (item.kode_produk && item.kode_produk.toLowerCase().includes(searchLower))
        );
      }

      // Apply limit
      const limitedData = filteredData.slice(0, limit);


      return NextResponse.json({
        success: true,
        data: limitedData,
        count: limitedData.length,
      });
    }

    // ========================================
    // ✅ MODE: OVERVIEW (For Stock Management Page)
    // ========================================

    // 🎯 BRANCH FILTERING: When specific branch selected, only show products with activity in that branch
    let query;

    if (cabang_id > 0) {
      // For branch-specific view: First count total products in this branch for pagination
      let countQuery = supabase
        .from('stock_barang')
        .select('produk_id', { count: 'exact' })
        .eq('cabang_id', cabang_id);

      if (search) {
        // When searching, we need to join with produk table to filter by name/code
        const { data: searchedProducts, error: searchError } = await supabase
          .from('produk')
          .select('id')
          .or(`nama_produk.ilike.%${search}%,kode_produk.ilike.%${search}%`);

        if (searchError) throw searchError;

        const searchProductIds = searchedProducts?.map(p => p.id) || [];
        if (searchProductIds.length > 0) {
          countQuery = countQuery.in('produk_id', searchProductIds);
        } else {
          // No products match search, return empty
          return NextResponse.json({
            success: true,
            data: [],
            pagination: {
              page,
              limit,
              totalRecords: 0,
              totalPages: 0,
            },
          });
        }
      }

      const { count: branchCount } = await countQuery;

      if (branchCount === 0) {
        // No products in this branch, return empty result
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            totalRecords: 0,
            totalPages: 0,
          },
        });
      }

      // Get all product IDs with transactions in this branch
      let allBranchQuery = supabase
        .from('stock_barang')
        .select('produk_id')
        .eq('cabang_id', cabang_id);

      if (search) {
        const { data: searchedProducts } = await supabase
          .from('produk')
          .select('id')
          .or(`nama_produk.ilike.%${search}%,kode_produk.ilike.%${search}%`);

        const searchProductIds = searchedProducts?.map(p => p.id) || [];
        allBranchQuery = allBranchQuery.in('produk_id', searchProductIds);
      }

      const { data: allBranchProducts, error: allBranchError } = await allBranchQuery
        .order('produk_id');

      if (allBranchError) throw allBranchError;

      const allProductIds = [...new Set(allBranchProducts?.map(bp => bp.produk_id) || [])];
      const uniqueProductIds = allProductIds.slice(offset, offset + limit);
      const totalRecords = allProductIds.length;
      const totalPages = Math.ceil(totalRecords / limit);

      if (uniqueProductIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            totalRecords,
            totalPages,
          },
        });
      }

      // Query products that are active in this branch (current page)
      query = supabase
        .from('produk')
        .select('id, nama_produk, kode_produk, satuan, stok, hpp, harga')
        .in('id', uniqueProductIds);

      // Branch-specific pagination (use calculated count of unique products)
    } else {
      // Global view: Show all products
      query = supabase
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

      // For global view, return the data directly from this query
      const formattedGlobalData = products?.map(p => {
        const stock = parseFloat(p.stok?.toString() || '0');
        const hpp = parseFloat(p.hpp?.toString() || '0');
        const harga_jual = parseFloat(p.harga?.toString() || '0');
        const margin = hpp > 0 ? ((harga_jual - hpp) / hpp) * 100 : 0;

        return {
          produk_id: p.id,
          nama_produk: p.nama_produk,
          kode_produk: p.kode_produk,
          satuan: p.satuan || 'Kg',
          stock: stock,
          stock_masuk: 0,
          stock_keluar: 0,
          hpp: hpp,
          harga_jual: harga_jual,
          margin: margin,
          cabang: 'Semua Cabang',
          cabang_id: 0,
          has_negative: stock < 0,
        };
      }) || [];

      return NextResponse.json({
        success: true,
        data: formattedGlobalData,
        pagination: {
          page,
          limit,
          totalRecords: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
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

    // Get cabang info if filtered
    let cabangName = 'Semua Cabang';
    if (cabang_id > 0) {
      const { data: cabangData } = await supabase
        .from('cabang')
        .select('nama_cabang')
        .eq('id', cabang_id)
        .single();
      
      if (cabangData) {
        cabangName = cabangData.nama_cabang;
      }
    }

    // ✅ CRITICAL FIX: Format data dengan stock PER BRANCH (ALL MODES)
    const formattedData = products?.map(p => {
      const history = historyMap.get(p.id) || { masuk: 0, keluar: 0 };
      // Stock calculation: ALWAYS use masuk - keluar (accurate transactional stock)
      const stock = history.masuk - history.keluar;

      const hpp = parseFloat(p.hpp?.toString() || '0');
      const harga_jual = parseFloat(p.harga?.toString() || '0');

      // Calculate margin
      const margin = hpp > 0 ? ((harga_jual - hpp) / hpp) * 100 : 0;

      // 🔄 SPECIAL HANDLING FOR Kg PRODUCTS: Ensure proper decimal handling
      // Calculate stock display with proper precision for Kg products
      const isKgProduct = (p.satuan || '').toLowerCase() === 'kg';
      const displayStock = isKgProduct ? parseFloat(stock.toFixed(3)) : parseFloat(stock.toFixed(2));

      return {
        produk_id: p.id,
        nama_produk: p.nama_produk,
        kode_produk: p.kode_produk,
        satuan: p.satuan || 'Kg',
        stock: displayStock, // ✅ REAL STOCK: masuk - keluar from transactions
        stock_masuk: history.masuk,
        stock_keluar: history.keluar,
        hpp: hpp,
        harga_jual: harga_jual,
        margin: margin,
        cabang: cabangName,
        cabang_id: cabang_id || 0,
        has_negative: displayStock < 0,
      };
    }) || [];

    // 🔍 DEBUG: Log first 3 items for decode calculation
    if (formattedData.length > 0) {
      formattedData.slice(0, 3).forEach((item, idx) => {
      });
    }

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);


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
    const supabase = await supabaseAuthenticated();
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
      .select('stok, nama_produk, kode_produk, satuan, hpp')
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
    } else {
      newStock -= jumlahFloat;
      
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
        // Include product details to avoid fetching from produk table later
        nama_produk: produk.nama_produk,
        kode_produk: produk.kode_produk || '',
        satuan: produk.satuan || 'unit',
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
