import { supabaseServer } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pegawaiId = searchParams.get('pegawai_id');

    if (!pegawaiId) {
      return NextResponse.json(
        { success: false, error: 'pegawai_id parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    // Query direct sales (transaksi_penjualan) by pegawai_id
    const { data: directSales, error: directSalesError } = await supabase
      .from('transaksi_penjualan')
      .select(`
        id,
        tanggal,
        total,
        status,
        status_pembayaran,
        customer:customer_id (nama),
        pegawai:pegawai_id (nama),
        cabang:cabang_id (nama_cabang)
      `)
      .eq('pegawai_id', pegawaiId)
      .order('tanggal', { ascending: false });

    if (directSalesError) {
      console.error('Error fetching direct sales:', directSalesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sales data' },
        { status: 500 }
      );
    }

    // Query consignment transactions by pegawai_id
    const { data: consignmentTransactions, error: consignmentError } = await supabase
      .from('transaksi_konsinyasi')
      .select(`
        id,
        kode_konsinyasi,
        tanggal_titip,
        toko:toko_id (nama_toko),
        total_nilai_titip,
        status
      `)
      .eq('pegawai_id', pegawaiId)
      .order('tanggal_titip', { ascending: false });

    if (consignmentError) {
      console.error('Error fetching consignment transactions:', consignmentError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch consignment data' },
        { status: 500 }
      );
    }

    // Query consignment sales - simplified version to avoid complex relation issues
    // For now, we'll fetch consignment sales separately
    let consignmentSales: any[] = [];
    try {
      // First get konsinyasi IDs that belong to this pegawai
      const { data: konsinyasiIds, error: konsinyasiError } = await supabase
        .from('transaksi_konsinyasi')
        .select('id')
        .eq('pegawai_id', pegawaiId);

      if (konsinyasiIds && konsinyasiIds.length > 0) {
        const ids = konsinyasiIds.map(k => k.id);

        // Then get detail_konsinyasi that belong to these consignments
        const { data: detailIds, error: detailError } = await supabase
          .from('detail_konsinyasi')
          .select('id')
          .in('konsinyasi_id', ids);

        if (detailIds && detailIds.length > 0) {
          const detailIdsList = detailIds.map(d => d.id);
          const { data: sales, error: salesError } = await supabase
            .from('penjualan_konsinyasi')
            .select('id, tanggal_jual, total_penjualan, status_pembayaran')
            .in('detail_konsinyasi_id', detailIdsList)
            .order('tanggal_jual', { ascending: false });

          consignmentSales = sales || [];
          if (salesError) console.error('Error fetching consignment sales:', salesError);
        }
      }
    } catch (error) {
      console.error('Error in consignment sales fetch:', error);
      consignmentSales = [];
    }

    // Process and format the data
    const transactions: Array<{
      id: number;
      type: 'direct_sale' | 'consignment_transaction' | 'consignment_sale';
      type_label: string;
      date: string;
      customer?: string | null;
      store?: string | null;
      total: number;
      status: string;
      transaction_id: string;
    }> = [];

    // Add direct sales
    if (directSales) {
      directSales.forEach((sale: any) => {
        transactions.push({
          id: sale.id,
          type: 'direct_sale',
          type_label: 'Direct Sale',
          date: sale.tanggal,
          customer: sale.customer?.nama || '-',
          store: null,
          total: sale.total,
          status: sale.status_pembayaran || sale.status,
          transaction_id: `DV${sale.id.toString().padStart(4, '0')}`
        });
      });
    }

    // Add consignment transactions
    if (consignmentTransactions) {
      consignmentTransactions.forEach((tx: any) => {
        transactions.push({
          id: tx.id,
          type: 'consignment_transaction',
          type_label: 'Consignment Setup',
          date: tx.tanggal_titip,
          customer: null,
          store: tx.toko?.nama_toko || '-',
          total: tx.total_nilai_titip,
          status: tx.status,
          transaction_id: tx.kode_konsinyasi
        });
      });
    }

    // Add consignment sales - simplified query
    if (consignmentSales) {
      consignmentSales.forEach((sale: any) => {
        transactions.push({
          id: sale.id,
          type: 'consignment_sale',
          type_label: 'Consignment Sale',
          date: sale.tanggal_jual,
          customer: null,
          store: sale.detail_konsinyasi?.konsinyasi?.toko?.nama_toko || '-',
          total: sale.total_penjualan,
          status: sale.status_pembayaran,
          transaction_id: `CS${sale.id.toString().padStart(4, '0')}`
        });
      });
    }

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate summary statistics
    const summary = {
      total_transactions: transactions.length,
      total_sales_direct: transactions
        .filter(t => t.type === 'direct_sale')
        .reduce((sum, t) => sum + t.total, 0),
      total_sales_consignment: transactions
        .filter(t => t.type === 'consignment_sale')
        .reduce((sum, t) => sum + t.total, 0),
      total_revenue: transactions.reduce((sum, t) => sum + t.total, 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        summary
      }
    });

  } catch (error: any) {
    console.error('Error in sales report API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
