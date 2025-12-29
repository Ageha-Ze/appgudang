// app/api/persediaan/stock-barang/update-harga/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

/**
 * POST - Update HPP & Harga Jual
 * cabang_id = 0 means apply to ALL cabang (update produk table directly)
 * cabang_id > 0 means apply to specific cabang (future: cabang_harga table)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const {
      produk_id,
      cabang_id,
      hpp,
      harga_jual,
      persentase,
    } = body;


    // Validation
    if (!produk_id || hpp === undefined || harga_jual === undefined) {
      return NextResponse.json(
        { success: false, error: 'produk_id, hpp, dan harga_jual wajib diisi' },
        { status: 400 }
      );
    }

    // Get produk info
    const { data: produk, error: produkError } = await supabase
      .from('produk')
      .select('nama_produk, kode_produk, hpp, harga')
      .eq('id', produk_id)
      .single();

    if (produkError) throw produkError;
    if (!produk) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    // Store old values
    const old_hpp = parseFloat(produk.hpp?.toString() || '0');
    const old_harga = parseFloat(produk.harga?.toString() || '0');

    // ✅ APPLY TO ALL CABANG (cabang_id = 0)
    if (cabang_id === 0) {
      const { error: updateError } = await supabase
        .from('produk')
        .update({
          hpp: parseFloat(hpp),
          harga: parseFloat(harga_jual),
        })
        .eq('id', produk_id);

      if (updateError) throw updateError;


      return NextResponse.json({
        success: true,
        message: `Harga berhasil diupdate untuk semua cabang!\n\nProduk: ${produk.nama_produk}\nHPP: Rp ${old_hpp.toLocaleString('id-ID')} → Rp ${parseFloat(hpp).toLocaleString('id-ID')}\nHarga Jual: Rp ${old_harga.toLocaleString('id-ID')} → Rp ${parseFloat(harga_jual).toLocaleString('id-ID')}\nMargin: ${persentase.toFixed(2)}%`,
        data: {
          produk_id,
          cabang: 'Semua Cabang',
          old_hpp: old_hpp,
          new_hpp: parseFloat(hpp),
          old_harga: old_harga,
          new_harga: parseFloat(harga_jual),
          margin: persentase,
        },
      });
    }

    // ✅ APPLY TO SPECIFIC CABANG
    // For now, also update produk table
    // In future, you can create cabang_harga table for per-cabang pricing
    const { error: updateError } = await supabase
      .from('produk')
      .update({
        hpp: parseFloat(hpp),
        harga: parseFloat(harga_jual),
      })
      .eq('id', produk_id);

    if (updateError) throw updateError;

    // Get cabang name
    const { data: cabangData } = await supabase
      .from('cabang')
      .select('nama_cabang')
      .eq('id', cabang_id)
      .single();


    return NextResponse.json({
      success: true,
      message: `Harga berhasil diupdate!\n\nProduk: ${produk.nama_produk}\nCabang: ${cabangData?.nama_cabang || 'Unknown'}\nHPP: Rp ${old_hpp.toLocaleString('id-ID')} → Rp ${parseFloat(hpp).toLocaleString('id-ID')}\nHarga Jual: Rp ${old_harga.toLocaleString('id-ID')} → Rp ${parseFloat(harga_jual).toLocaleString('id-ID')}\nMargin: ${persentase.toFixed(2)}%`,
      data: {
        produk_id,
        cabang_id,
        cabang: cabangData?.nama_cabang || 'Unknown',
        old_hpp: old_hpp,
        new_hpp: parseFloat(hpp),
        old_harga: old_harga,
        new_harga: parseFloat(harga_jual),
        margin: persentase,
      },
    });
  } catch (error: any) {
    console.error('❌ Error updating price:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
