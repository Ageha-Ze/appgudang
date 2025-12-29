// app/api/gudang/unloading/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    let resolvedParams;
    
    try {
      resolvedParams = await params;
    } catch (paramError) {
      console.error('Error resolving params:', paramError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Parameter tidak valid' 
        },
        { status: 400 }
      );
    }

    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'ID tidak ditemukan' 
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


    // Get detail unloading by ID
    const { data: mainItem, error: mainError } = await supabase
      .from('gudang_unloading')
      .select(`
        tanggal,
        cabang_id,
        keterangan,
        created_at
      `)
      .eq('id', parsedId)
      .single();

    if (mainError) {
      console.error('Error fetching main item:', mainError);
      
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

    if (!mainItem) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Data tidak ditemukan' 
        },
        { status: 404 }
      );
    }

    // Ambil hanya yang created_at sama (1 batch transaksi yang sama)
    const createdAtDate = new Date(mainItem.created_at);
    const startTime = new Date(createdAtDate.getTime() - 1000).toISOString();
    const endTime = new Date(createdAtDate.getTime() + 1000).toISOString();

    // ✅ FIXED: Updated to match modal interface
    // produk_jerigen_id = JERIGEN (source)
    // produk_kiloan_id = KILOAN (destination)
    const { data: items, error } = await supabase
      .from('gudang_unloading')
      .select(`
        id,
        tanggal,
        produk_jerigen_id,
        produk_kiloan_id,
        jumlah,
        satuan_input,
        satuan_output,
        jumlah_output,
        density,
        conversion_type,
        cabang_id,
        keterangan,
        created_at,
        produk_jerigen:produk_jerigen_id (
          id,
          nama_produk,
          kode_produk,
          satuan,
          stok
        ),
        produk_kiloan:produk_kiloan_id (
          id,
          nama_produk,
          kode_produk,
          satuan,
          stok
        ),
        cabang:cabang_id (
          id,
          nama_cabang,
          kode_cabang
        )
      `)
      .eq('tanggal', mainItem.tanggal)
      .eq('cabang_id', mainItem.cabang_id)
      .gte('created_at', startTime)
      .lte('created_at', endTime)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching items:', error);
      throw error;
    }


    if (!items || items.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Detail items tidak ditemukan' 
        },
        { status: 404 }
      );
    }

    // Validasi data relasi
    const invalidItems = items.filter(item => 
      !item.produk_jerigen || !item.produk_kiloan || !item.cabang
    );

    if (invalidItems.length > 0) {
      console.error('Found items with missing relations:', invalidItems);
      return NextResponse.json(
        { 
          success: false,
          error: 'Beberapa data produk atau cabang tidak ditemukan',
          warning: 'Data mungkin telah dihapus atau korup'
        },
        { status: 500 }
      );
    }

    // ✅ FIXED: Updated transformation to match new column names
    // Now using produk_jerigen_id as source (jerigen) and produk_kiloan_id as destination (kiloan)
    const transformedItems = items.map(item => ({
      id: item.id,
      produk_jerigen_id: item.produk_jerigen_id,    // ✅ Source: Jerigen
      produk_kiloan_id: item.produk_kiloan_id,      // ✅ Destination: Kiloan
      jumlah: parseFloat(item.jumlah.toString()),
      satuan_input: item.satuan_input,
      satuan_output: item.satuan_output,
      jumlah_output: item.jumlah_output ? parseFloat(item.jumlah_output.toString()) : null,
      density: item.density,
      conversion_type: item.conversion_type,
      keterangan: item.keterangan || null,
      produk_jerigen: item.produk_jerigen,        // ✅ Source product data
      produk_kiloan: item.produk_kiloan,          // ✅ Destination product data
    }));

    // Calculate total
    let totalQty = 0;
    try {
      totalQty = items.reduce((sum, item) => {
        const jumlah = parseFloat(item.jumlah.toString());
        if (isNaN(jumlah)) {
          console.warn(`Invalid jumlah for item ${item.id}:`, item.jumlah);
          return sum;
        }
        return sum + jumlah;
      }, 0);
    } catch (calcError) {
      console.error('Error calculating total:', calcError);
      totalQty = 0;
    }

    // Validasi cabang data
    if (!items[0]?.cabang) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Data cabang tidak ditemukan' 
        },
        { status: 500 }
      );
    }

    // Group response
    const response = {
      tanggal: mainItem.tanggal,
      cabang_id: mainItem.cabang_id,
      cabang: items[0].cabang,
      keterangan: mainItem.keterangan || null,
      items: transformedItems,
      total_qty: totalQty,
      jumlah_item: items.length
    };


    return NextResponse.json({ 
      success: true,
      data: response 
    });
  } catch (error: any) {
    console.error('Error in GET /api/gudang/unloading/[id]:', error);
    
    if (error.code === 'PGRST301') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Terlalu banyak data yang ditemukan. Hubungi administrator.' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Terjadi kesalahan saat mengambil detail',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
