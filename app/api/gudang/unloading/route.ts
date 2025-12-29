// app/api/gudang/unloading/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { logAuditTrail } from '@/lib/helpers/stockSafety';

// GET - List unloading (unchanged)
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')));
    const cabangId = searchParams.get('cabang_id');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('gudang_unloading')
      .select(`
        id,
        tanggal,
        produk_curah_id,
        produk_jerigen_id,
        jumlah,
        cabang_id,
        keterangan,
        created_at,
        produk_jerigen:produk_curah_id (
          id,
          nama_produk,
          kode_produk,
          satuan
        ),
        produk_kiloan:produk_jerigen_id (
          id,
          nama_produk,
          kode_produk,
          satuan
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (cabangId) {
      const parsedCabangId = parseInt(cabangId);
      if (isNaN(parsedCabangId)) {
        return NextResponse.json(
          { error: 'Cabang ID harus berupa angka' },
          { status: 400 }
        );
      }
      query = query.eq('cabang_id', parsedCabangId);
    }

    const { data: allData, error } = await query;

    if (error) {
      console.error('Error fetching unloading:', error);
      throw error;
    }

    let filteredData = allData || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((item: any) => 
        item.produk_jerigen?.nama_produk?.toLowerCase().includes(searchLower) ||
        item.produk_kiloan?.nama_produk?.toLowerCase().includes(searchLower) ||
        item.produk_jerigen?.kode_produk?.toLowerCase().includes(searchLower) ||
        item.produk_kiloan?.kode_produk?.toLowerCase().includes(searchLower) ||
        item.cabang?.nama_cabang?.toLowerCase().includes(searchLower) ||
        new Date(item.tanggal).toLocaleDateString('id-ID').includes(searchLower)
      );
    }

    const grouped = filteredData.reduce((acc: any, item: any) => {
      const createdAtKey = new Date(item.created_at).toISOString().slice(0, 19);
      const key = `${item.tanggal}-${item.cabang_id}-${createdAtKey}`;
      
      if (!acc[key]) {
        acc[key] = {
          id: item.id,
          tanggal: item.tanggal,
          cabang_id: item.cabang_id,
          cabang: item.cabang,
          items: [],
          total_qty: 0,
          created_at: item.created_at
        };
      }
      
      acc[key].items.push(item);
      acc[key].total_qty += parseFloat(item.jumlah.toString());
      
      return acc;
    }, {});

    const groupedArray = Object.values(grouped);

    const totalRecords = groupedArray.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const paginatedData = groupedArray.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/gudang/unloading:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Terjadi kesalahan saat mengambil data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// ✅✅✅ POST with KG → ML Conversion Support
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    let body;

    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Format data tidak valid. Pastikan request body berupa JSON yang valid.' 
        },
        { status: 400 }
      );
    }

    // Validasi field required
    if (!body.tanggal || !body.cabang_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Tanggal dan Cabang wajib diisi' 
        },
        { status: 400 }
      );
    }

    if (isNaN(Date.parse(body.tanggal))) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Format tanggal tidak valid' 
        },
        { status: 400 }
      );
    }

    const cabangId = parseInt(body.cabang_id);
    if (isNaN(cabangId)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Cabang ID harus berupa angka' 
        },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Minimal 1 item unloading harus ditambahkan' 
        },
        { status: 400 }
      );
    }

    // Validasi setiap item
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      
      if (!item.produk_jerigen_id || !item.produk_kiloan_id) {
        return NextResponse.json(
          { 
            success: false,
            error: `Item ke-${i + 1}: Produk jerigen dan kiloan harus diisi` 
          },
          { status: 400 }
        );
      }

      const jumlah = parseFloat(item.jumlah);
      if (isNaN(jumlah) || jumlah <= 0) {
        return NextResponse.json(
          { 
            success: false,
            error: `Item ke-${i + 1}: Jumlah harus berupa angka positif` 
          },
          { status: 400 }
        );
      }
    }

    // ✅ Fetch products and validate + calculate conversion
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      
      // Fetch produk jerigen dengan density
      const { data: produkJerigen, error: produkError } = await supabase
        .from('produk')
        .select('id, nama_produk, satuan, density_kg_per_liter')
        .eq('id', item.produk_jerigen_id)
        .single();

      if (produkError || !produkJerigen) {
        console.error('Error fetching produk jerigen:', produkError);
        return NextResponse.json(
          { 
            success: false,
            error: `Item ke-${i + 1}: Produk jerigen tidak ditemukan` 
          },
          { status: 404 }
        );
      }

      // Fetch produk kiloan
      const { data: produkKiloan, error: produkKiloanError } = await supabase
        .from('produk')
        .select('id, nama_produk, satuan')
        .eq('id', item.produk_kiloan_id)
        .single();

      if (produkKiloanError || !produkKiloan) {
        return NextResponse.json(
          { 
            success: false,
            error: `Item ke-${i + 1}: Produk kiloan tidak ditemukan` 
          },
          { status: 404 }
        );
      }

      // 🆕 Calculate output based on conversion
      let jumlahOutput = parseFloat(item.jumlah);
      let conversionInfo = null;

      if (produkJerigen.satuan === 'Kg' && produkKiloan.satuan === 'Ml') {
        // KG → ML conversion
        if (!produkJerigen.density_kg_per_liter || produkJerigen.density_kg_per_liter <= 0) {
          return NextResponse.json(
            { 
              success: false,
              error: `❌ Produk "${produkJerigen.nama_produk}" belum memiliki density factor!\n\nSilakan set density di Master Produk terlebih dahulu.` 
            },
            { status: 400 }
          );
        }
        
        jumlahOutput = (parseFloat(item.jumlah) / produkJerigen.density_kg_per_liter) * 1000;
        conversionInfo = {
          type: 'KG_TO_ML',
          input: parseFloat(item.jumlah),
          output: jumlahOutput,
          density: produkJerigen.density_kg_per_liter,
          formula: `${item.jumlah} KG / ${produkJerigen.density_kg_per_liter} * 1000 = ${jumlahOutput.toFixed(2)} ML`
        };
        
      } else if (produkJerigen.satuan === 'Ml' && produkKiloan.satuan === 'Kg') {
        // ML → KG conversion (reverse - rare case)
        if (!produkJerigen.density_kg_per_liter || produkJerigen.density_kg_per_liter <= 0) {
          return NextResponse.json(
            { 
              success: false,
              error: `❌ Produk "${produkJerigen.nama_produk}" belum memiliki density factor untuk konversi ML→KG!` 
            },
            { status: 400 }
          );
        }
        
        jumlahOutput = (parseFloat(item.jumlah) / 1000) * produkJerigen.density_kg_per_liter;
        conversionInfo = {
          type: 'ML_TO_KG',
          input: parseFloat(item.jumlah),
          output: jumlahOutput,
          density: produkJerigen.density_kg_per_liter,
          formula: `${item.jumlah} ML / 1000 * ${produkJerigen.density_kg_per_liter} = ${jumlahOutput.toFixed(2)} KG`
        };
        
      }
      // else: same unit, no conversion needed

      // Store calculated output for later use
      item._calculated_output = jumlahOutput;
      item._conversion_info = conversionInfo;
      item._produk_jerigen = produkJerigen;
      item._produk_kiloan = produkKiloan;
    }

    // ✅ Validate BRANCH-SPECIFIC stock for jerigen
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      const produkJerigen = item._produk_jerigen;
      
      // Get BRANCH-SPECIFIC stock from stock_barang
      const { data: stockMovements, error: stockError } = await supabase
        .from('stock_barang')
        .select('jumlah, tipe')
        .eq('produk_id', item.produk_jerigen_id)
        .eq('cabang_id', cabangId);

      if (stockError) {
        console.error('Error fetching stock movements:', stockError);
        return NextResponse.json(
          { 
            success: false,
            error: `Item ke-${i + 1}: Gagal mengecek stock di cabang` 
          },
          { status: 500 }
        );
      }

      // Calculate branch-specific stock
      let branchStock = 0;
      if (stockMovements && stockMovements.length > 0) {
        branchStock = stockMovements.reduce((total, movement) => {
          const jumlah = parseFloat(movement.jumlah.toString());
          return movement.tipe === 'masuk' 
            ? total + jumlah 
            : total - jumlah;
        }, 0);
      }


      // Validate against BRANCH stock
      const requestedAmount = parseFloat(item.jumlah);
      if (requestedAmount > branchStock) {
        const { data: cabangData } = await supabase
          .from('cabang')
          .select('nama_cabang')
          .eq('id', cabangId)
          .single();

        return NextResponse.json(
          { 
            success: false,
            error: 
              `❌ Stock ${produkJerigen.nama_produk} di ${cabangData?.nama_cabang || 'cabang ini'} tidak mencukupi!\n\n` +
              `Stock tersedia: ${branchStock.toFixed(2)} ${produkJerigen.satuan}\n` +
              `Diminta: ${requestedAmount.toFixed(2)} ${produkJerigen.satuan}\n` +
              `Kekurangan: ${(requestedAmount - branchStock).toFixed(2)} ${produkJerigen.satuan}`
          },
          { status: 400 }
        );
      }
    }

    // ✅ Insert unloading records with calculated output
    const currentTimestamp = new Date().toISOString();
    const unloadingData = body.items.map((item: any) => ({
      tanggal: body.tanggal,
      produk_curah_id: item.produk_jerigen_id,
      produk_jerigen_id: item.produk_kiloan_id,
      jumlah: item._calculated_output || parseFloat(item.jumlah), // Use converted amount
      cabang_id: cabangId,
      keterangan: item.keterangan || body.keterangan || null,
      status: 'selesai',
      created_at: currentTimestamp
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('gudang_unloading')
      .insert(unloadingData)
      .select();

    if (insertError) {
      console.error('Error inserting unloading:', insertError);
      throw insertError;
    }

    // ✅ Update stock: GLOBAL produk.stok + BRANCH-SPECIFIC stock_barang
    try {
      for (const item of body.items) {
        const jumlahInput = parseFloat(item.jumlah); // Original input
        const jumlahOutput = item._calculated_output || jumlahInput; // Converted output
        const conversionInfo = item._conversion_info;

        const unloadingRecord = insertedData.find(ins =>
          ins.produk_curah_id === item.produk_jerigen_id &&
          ins.produk_jerigen_id === item.produk_kiloan_id
        );

        if (!unloadingRecord) {
          throw new Error(`Cannot find unloading record for item: ${item.produk_jerigen_id} -> ${item.produk_kiloan_id}`);
        }

        // 1. KURANGI stock produk jerigen (use INPUT amount)
        const { data: produkJerigen, error: fetchError1 } = await supabase
          .from('produk')
          .select('stok, nama_produk, satuan')
          .eq('id', item.produk_jerigen_id)
          .single();

        if (fetchError1) throw fetchError1;

        if (produkJerigen) {
          const newStokJerigen = parseFloat(produkJerigen.stok) - jumlahInput;

          // Update global stock
          const { error: updateError1 } = await supabase
            .from('produk')
            .update({ stok: newStokJerigen })
            .eq('id', item.produk_jerigen_id);

          if (updateError1) throw updateError1;

          // Insert BRANCH-SPECIFIC stock movement KELUAR (use INPUT amount)
          const keteranganKeluar = conversionInfo 
            ? `Unloading: ${conversionInfo.formula}`
            : `Unloading ke ${jumlahOutput.toFixed(2)} ${item._produk_kiloan.satuan}`;

          const { error: stockError1 } = await supabase
            .from('stock_barang')
            .insert({
              produk_id: item.produk_jerigen_id,
              unloading_id: unloadingRecord.id,
              cabang_id: cabangId,
              jumlah: jumlahInput,
              tanggal: body.tanggal,
              tipe: 'keluar',
              keterangan: keteranganKeluar,
              hpp: 0
            });

          if (stockError1) throw stockError1;

        }

        // 2. TAMBAH stock produk kiloan (use OUTPUT amount - converted)
        const { data: produkKiloan, error: fetchError2 } = await supabase
          .from('produk')
          .select('stok, nama_produk, satuan')
          .eq('id', item.produk_kiloan_id)
          .single();

        if (fetchError2) throw fetchError2;

        if (produkKiloan) {
          const newStokKiloan = parseFloat(produkKiloan.stok) + jumlahOutput;

          // Update global stock
          const { error: updateError2 } = await supabase
            .from('produk')
            .update({ stok: newStokKiloan })
            .eq('id', item.produk_kiloan_id);

          if (updateError2) throw updateError2;

          // Insert BRANCH-SPECIFIC stock movement MASUK (use OUTPUT amount)
          const keteranganMasuk = conversionInfo
            ? `Hasil unloading: ${conversionInfo.formula}`
            : `Hasil unloading dari ${jumlahInput} ${produkJerigen.satuan}`;

          const { error: stockError2 } = await supabase
            .from('stock_barang')
            .insert({
              produk_id: item.produk_kiloan_id,
              unloading_id: unloadingRecord.id,
              cabang_id: cabangId,
              jumlah: jumlahOutput,
              tanggal: body.tanggal,
              tipe: 'masuk',
              keterangan: keteranganMasuk,
              hpp: 0
            });

          if (stockError2) throw stockError2;

        }
      }
    } catch (stockError: any) {
      console.error('❌ Error updating stock:', stockError);
      
      // Rollback: hapus unloading yang baru dibuat
      if (insertedData && insertedData.length > 0) {
        const ids = insertedData.map(item => item.id);
        await supabase
          .from('gudang_unloading')
          .delete()
          .in('id', ids);
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Gagal mengupdate stock. Transaksi dibatalkan.',
          details: stockError.message
        },
        { status: 500 }
      );
    }

    // Build success message with conversion info
    let successMessage = 'Unloading berhasil!';
    const conversions = body.items.filter((i: any) => i._conversion_info);
    if (conversions.length > 0) {
      successMessage += '\n\n🔄 Konversi yang dilakukan:';
      conversions.forEach((item: any) => {
        successMessage += `\n• ${item._conversion_info.formula}`;
      });
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      data: insertedData,
    });
  } catch (error: any) {
    console.error('Error in POST /api/gudang/unloading:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Terjadi kesalahan saat menyimpan data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// ✅✅✅ DELETE - Complete reversal with conversion support
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'ID tidak valid atau tidak ditemukan' 
        },
        { status: 400 }
      );
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'ID harus berupa angka' 
        },
        { status: 400 }
      );
    }

    const { data: mainUnloading, error: mainError } = await supabase
      .from('gudang_unloading')
      .select('tanggal, cabang_id, created_at')
      .eq('id', parsedId)
      .single();

    if (mainError) {
      console.error('Error fetching main unloading:', mainError);
      if (mainError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Data tidak ditemukan' 
          },
          { status: 404 }
        );
      }
      throw mainError;
    }

    if (!mainUnloading) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Data tidak ditemukan' 
        },
        { status: 404 }
      );
    }

    const createdAtDate = new Date(mainUnloading.created_at);
    const startTime = new Date(createdAtDate.getTime() - 1000).toISOString();
    const endTime = new Date(createdAtDate.getTime() + 1000).toISOString();

    // Fetch all items in batch with product info including density
    const { data: batchItems, error: batchError } = await supabase
      .from('gudang_unloading')
      .select(`
        id,
        produk_curah_id,
        produk_jerigen_id,
        jumlah,
        produk_jerigen:produk_curah_id (
          id,
          nama_produk,
          stok,
          satuan,
          density_kg_per_liter
        ),
        produk_kiloan:produk_jerigen_id (
          id,
          nama_produk,
          stok,
          satuan
        )
      `)
      .eq('tanggal', mainUnloading.tanggal)
      .eq('cabang_id', mainUnloading.cabang_id)
      .gte('created_at', startTime)
      .lte('created_at', endTime);

    if (batchError) {
      console.error('Error fetching batch items:', batchError);
      throw batchError;
    }

    if (!batchItems || batchItems.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Data tidak ditemukan' 
        },
        { status: 404 }
      );
    }


    const reversalResults = [];
    
    for (const item of batchItems) {
      try {
        const jumlahStored = parseFloat(item.jumlah.toString()); // This is OUTPUT amount (ML)
        const produkJerigen: any = item.produk_jerigen;
        const produkKiloan: any = item.produk_kiloan;

        if (!produkJerigen || !produkKiloan) {
          console.warn(`⚠️ Missing product data for unloading ${item.id}, skipping...`);
          continue;
        }

        // 🆕 Calculate INPUT amount (might be different due to conversion)
        let jumlahInput = jumlahStored; // Default: same as stored
        let conversionInfo = null;

        if (produkJerigen.satuan === 'Kg' && produkKiloan.satuan === 'Ml') {
          // Reverse KG → ML conversion
          // Stored amount is ML, need to calculate original KG
          if (produkJerigen.density_kg_per_liter && produkJerigen.density_kg_per_liter > 0) {
            jumlahInput = (jumlahStored / 1000) * produkJerigen.density_kg_per_liter;
            conversionInfo = {
              type: 'ML_TO_KG_REVERSE',
              stored_ml: jumlahStored,
              original_kg: jumlahInput,
              density: produkJerigen.density_kg_per_liter
            };
          }
        } else if (produkJerigen.satuan === 'Ml' && produkKiloan.satuan === 'Kg') {
          // Reverse ML → KG conversion
          if (produkJerigen.density_kg_per_liter && produkJerigen.density_kg_per_liter > 0) {
            jumlahInput = (jumlahStored * 1000) / produkJerigen.density_kg_per_liter;
            conversionInfo = {
              type: 'KG_TO_ML_REVERSE',
              stored_kg: jumlahStored,
              original_ml: jumlahInput,
              density: produkJerigen.density_kg_per_liter
            };
          }
        }

        // STEP 1: REVERSE JERIGEN (Add back stock that was removed - use INPUT amount)
        const currentStokJerigen = parseFloat(produkJerigen.stok.toString());
        const newStokJerigen = currentStokJerigen + jumlahInput;

        const { error: updateJerigenError } = await supabase
          .from('produk')
          .update({ stok: newStokJerigen })
          .eq('id', item.produk_curah_id);

        if (updateJerigenError) {
          throw new Error(`Failed to restore jerigen stock: ${updateJerigenError.message}`);
        }


        // STEP 2: REVERSE KILOAN (Remove stock that was added - use STORED amount)
        const currentStokKiloan = parseFloat(produkKiloan.stok.toString());
        const newStokKiloan = currentStokKiloan - jumlahStored;

        if (newStokKiloan < 0) {
          throw new Error(
            `Tidak dapat menghapus unloading ini!\n` +
            `Stock ${produkKiloan.nama_produk} akan negatif (${newStokKiloan.toFixed(2)}).\n` +
            `Kemungkinan produk kiloan sudah digunakan untuk transaksi lain.`
          );
        }

        const { error: updateKiloanError } = await supabase
          .from('produk')
          .update({ stok: newStokKiloan })
          .eq('id', item.produk_jerigen_id);

        if (updateKiloanError) {
          throw new Error(`Failed to reverse kiloan stock: ${updateKiloanError.message}`);
        }


        reversalResults.push({
          unloading_id: item.id,
          conversion_info: conversionInfo,
          jerigen: {
            nama: produkJerigen.nama_produk,
            before: currentStokJerigen,
            after: newStokJerigen,
            change: `+${jumlahInput.toFixed(2)} ${produkJerigen.satuan}`
          },
          kiloan: {
            nama: produkKiloan.nama_produk,
            before: currentStokKiloan,
            after: newStokKiloan,
            change: `-${jumlahStored.toFixed(2)} ${produkKiloan.satuan}`
          }
        });

      } catch (itemError: any) {
        console.error(`❌ Error reversing stock for item ${item.id}:`, itemError);
        
        return NextResponse.json(
          {
            success: false,
            error: `Gagal mengembalikan stock. Operasi dibatalkan.`,
            details: itemError.message,
            hint: 'Pastikan produk kiloan belum digunakan untuk transaksi lain.'
          },
          { status: 400 }
        );
      }
    }

    // Delete stock_barang records (CASCADE via foreign key)
    const { error: deleteStockError } = await supabase
      .from('stock_barang')
      .delete()
      .in('unloading_id', batchItems.map(item => item.id));

    if (deleteStockError) {
      console.warn('⚠️ Warning: Failed to delete stock records:', deleteStockError);
    }

    // Log audit trail
    await logAuditTrail(
      'DELETE',
      'gudang_unloading',
      parsedId,
      batchItems[0],
      undefined,
      undefined,
      undefined
    );

    // Delete all unloading records in batch
    const { error: deleteError } = await supabase
      .from('gudang_unloading')
      .delete()
      .eq('tanggal', mainUnloading.tanggal)
      .eq('cabang_id', mainUnloading.cabang_id)
      .gte('created_at', startTime)
      .lte('created_at', endTime);

    if (deleteError) {
      console.error('Error deleting unloading records:', deleteError);
      throw deleteError;
    }


    return NextResponse.json({
      success: true,
      message: `Unloading berhasil dibatalkan! ${reversalResults.length} items dikembalikan.`,
      details: reversalResults
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/gudang/unloading:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Terjadi kesalahan saat menghapus data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
