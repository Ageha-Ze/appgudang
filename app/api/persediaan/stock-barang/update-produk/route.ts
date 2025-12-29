'use server';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();


    const { produk_id, cabang_id, stock, persentase, harga_jual } = body;

    if (!produk_id || !cabang_id) {
      console.error('❌ Missing required fields:', { produk_id, cabang_id });
      return NextResponse.json({ error: 'produk_id and cabang_id are required' }, { status: 400 });
    }

    // Calculate HPP from harga_jual and persentase
    const calculatedHpp = persentase && harga_jual ? harga_jual / (1 + persentase / 100) : 0;

    // Calculate current stock from all transactions for this product-branch combination
    const { data: stockTransactions, error: stockError } = await supabase
      .from('stock_barang')
      .select('jumlah, tipe')
      .eq('produk_id', produk_id)
      .eq('cabang_id', cabang_id);

    if (stockError) {
      console.error('❌ Error fetching stock transactions:', stockError);
      return NextResponse.json({ error: 'Failed to calculate current stock' }, { status: 500 });
    }

    // Calculate current stock: masuk - keluar
    let currentStock = 0;
    stockTransactions?.forEach((transaction: any) => {
      const amount = parseFloat(transaction.jumlah?.toString() || '0');
      if (transaction.tipe === 'masuk') {
        currentStock += amount;
      } else if (transaction.tipe === 'keluar') {
        currentStock -= amount;
      }
    });


    // Get product details
    const { data: productData, error: productError } = await supabase
      .from('produk')
      .select('nama_produk, hpp, harga, satuan')
      .eq('id', produk_id)
      .single();

    if (productError || !productData) {
      console.error('❌ Failed to get product data:', productError);
      return NextResponse.json({ error: 'Failed to get product data' }, { status: 500 });
    }

    // Calculate the difference needed to reach the desired stock level
    const stockDifference = stock - currentStock;

    // Always update product pricing in the produk table
    const { error: pricingError } = await supabase
      .from('produk')
      .update({
        hpp: calculatedHpp,
        harga: harga_jual
      })
      .eq('id', produk_id);

    if (pricingError) {
      console.error('❌ Error updating product pricing:', pricingError);
      return NextResponse.json({ error: 'Failed to update product pricing' }, { status: 500 });
    }

    // If stock is already at desired level, just return success
    if (stockDifference === 0) {
      return NextResponse.json({
        success: true,
        message: 'Product pricing updated successfully (stock already at desired level)'
      });
    }

    // Create adjustment transaction to reach desired stock level
    const adjustmentData = {
      produk_id: produk_id,
      cabang_id: cabang_id,
      jumlah: Math.abs(stockDifference),
      tanggal: new Date().toISOString().split('T')[0],
      tipe: stockDifference > 0 ? 'masuk' : 'keluar',
      keterangan: `Stock adjustment to ${stock} ${productData.satuan || 'unit'} (Edit Produk)`,
      hpp: calculatedHpp,
      persentase: persentase,
      harga_jual: harga_jual
    };


    const { data: insertData, error: insertError } = await supabase
      .from('stock_barang')
      .insert(adjustmentData)
      .select();

    if (insertError) {
      console.error('❌ Error creating stock adjustment transaction:', insertError);
      return NextResponse.json({
        error: 'Failed to create stock adjustment',
        details: insertError.message,
        code: insertError.code
      }, { status: 500 });
    }


    return NextResponse.json({
      success: true,
      message: `Product updated successfully. Stock adjusted by ${stockDifference > 0 ? '+' : ''}${stockDifference} ${productData.satuan || 'unit'}`,
      data: insertData,
      adjustment: {
        difference: stockDifference,
        transaction: insertData
      }
    });

  } catch (error: any) {
    console.error('💥 Unexpected error updating product:', error);
    return NextResponse.json({
      error: error.message || 'Unexpected error occurred',
      stack: error.stack
    }, { status: 500 });
  }
}
