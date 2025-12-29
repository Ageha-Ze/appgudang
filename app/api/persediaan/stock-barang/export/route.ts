// app/api/persediaan/stock-barang/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';

/**
 * GET - Export stock data to Excel
 * Types: 'overview' or 'movements'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') || 'overview';
    const cabang_id = parseInt(searchParams.get('cabang_id') || '0');
    const produk_id = searchParams.get('produk_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');


    let workbook: XLSX.WorkBook;
    let filename: string;
    const timestamp = new Date().toISOString().split('T')[0];

    if (type === 'overview') {
      // Export stock overview
      workbook = await exportOverview(supabase, cabang_id);
      filename = `Stock_Overview_${timestamp}.xlsx`;
    } else if (type === 'movements') {
      // Export stock movements
      workbook = await exportMovements(supabase, produk_id, start_date, end_date);
      filename = `Stock_Movements_${timestamp}.xlsx`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid export type' },
        { status: 400 }
      );
    }

    // Generate Excel buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error exporting:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function exportOverview(supabase: any, cabang_id: number): Promise<XLSX.WorkBook> {
  // Fetch data
  let query = supabase
    .from('produk')
    .select('id, nama_produk, kode_produk, satuan, stok, hpp, harga')
    .order('nama_produk');

  const { data: products, error } = await query;

  if (error) throw error;

  // Prepare data rows
  const rows = products?.map((p: any) => {
    const stock = parseFloat(p.stok?.toString() || '0');
    const hpp = parseFloat(p.hpp?.toString() || '0');
    const harga_jual = parseFloat(p.harga?.toString() || '0');
    const margin = hpp > 0 ? ((harga_jual - hpp) / hpp) * 100 : 0;
    const nilai_stock = stock * hpp;

    return {
      'Kode Produk': p.kode_produk,
      'Nama Produk': p.nama_produk,
      'Satuan': p.satuan || 'Kg',
      'Stock': stock.toFixed(2),
      'HPP': hpp.toFixed(2),
      'Harga Jual': harga_jual.toFixed(2),
      'Margin %': margin.toFixed(2),
      'Nilai Stock': nilai_stock.toFixed(2),
    };
  }) || [];

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Kode Produk
    { wch: 30 }, // Nama Produk
    { wch: 10 }, // Satuan
    { wch: 15 }, // Stock
    { wch: 15 }, // HPP
    { wch: 15 }, // Harga Jual
    { wch: 12 }, // Margin %
    { wch: 18 }, // Nilai Stock
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Overview');

  return workbook;
}

async function exportMovements(
  supabase: any,
  produk_id: string | null,
  start_date: string | null,
  end_date: string | null
): Promise<XLSX.WorkBook> {
  // Build query
  let query = supabase
    .from('stock_barang')
    .select(`
      id,
      tanggal,
      jumlah,
      tipe,
      keterangan,
      hpp,
      harga_jual,
      produk:produk_id (
        nama_produk,
        kode_produk
      ),
      cabang:cabang_id (
        nama_cabang
      )
    `)
    .order('tanggal', { ascending: true })
    .order('id', { ascending: true });

  if (produk_id) {
    query = query.eq('produk_id', produk_id);
  }

  if (start_date) {
    query = query.gte('tanggal', start_date);
  }

  if (end_date) {
    query = query.lte('tanggal', end_date);
  }

  const { data: movements, error } = await query;

  if (error) throw error;

  // Calculate running balance and prepare rows
  let balance = 0;
  const rows = movements?.map((item: any) => {
    const jumlah = parseFloat(item.jumlah.toString());
    
    if (item.tipe === 'masuk') {
      balance += jumlah;
    } else if (item.tipe === 'keluar') {
      balance -= jumlah;
    }

    return {
      'Tanggal': new Date(item.tanggal).toLocaleDateString('id-ID'),
      'Kode Produk': item.produk?.kode_produk || '-',
      'Nama Produk': item.produk?.nama_produk || '-',
      'Cabang': item.cabang?.nama_cabang || '-',
      'Tipe': item.tipe.toUpperCase(),
      'Jumlah': (item.tipe === 'masuk' ? jumlah : -jumlah).toFixed(2),
      'Saldo': balance.toFixed(2),
      'HPP': parseFloat(item.hpp?.toString() || '0').toFixed(2),
      'Harga Jual': parseFloat(item.harga_jual?.toString() || '0').toFixed(2),
      'Keterangan': item.keterangan || '-',
    };
  }) || [];

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Tanggal
    { wch: 15 }, // Kode Produk
    { wch: 30 }, // Nama Produk
    { wch: 20 }, // Cabang
    { wch: 10 }, // Tipe
    { wch: 15 }, // Jumlah
    { wch: 15 }, // Saldo
    { wch: 15 }, // HPP
    { wch: 15 }, // Harga Jual
    { wch: 40 }, // Keterangan
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Movements');

  return workbook;
}
