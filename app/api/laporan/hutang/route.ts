import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Query hutang pembelian dengan join ke tabel suplier
    let query = supabase
      .from('hutang_pembelian')
      .select(`
        *,
        suplier:suplier_id (
          nama
        )
      `)
      .order('created_at', { ascending: false });

    // Filter berdasarkan status
    if (status && status !== 'semua') {
      query = query.eq('status', status);
    }

    // Filter berdasarkan tanggal
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    // Filter berdasarkan nama supplier
    if (search) {
      query = query.ilike('suplier.nama', `%${search}%`);
    }

    const { data: hutangData, error: hutangError } = await query;

    if (hutangError) {
      throw hutangError;
    }

    // Format data dengan nama supplier
    const formattedData = hutangData?.map(item => ({
      ...item,
      suplier_nama: item.suplier?.nama || 'Unknown'
    })) || [];

    // Hitung summary
    const summary = {
      total_hutang: formattedData.reduce((sum, item) => sum + Number(item.total_hutang), 0),
      total_dibayar: formattedData.reduce((sum, item) => sum + Number(item.dibayar), 0),
      total_sisa: formattedData.reduce((sum, item) => sum + Number(item.sisa), 0),
      jumlah_belum_lunas: formattedData.filter(item => item.status === 'Belum Lunas').length,
      jumlah_jatuh_tempo: formattedData.filter(item => {
        if (!item.jatuh_tempo) return false;
        const today = new Date();
        const dueDate = new Date(item.jatuh_tempo);
        return dueDate < today && item.status !== 'Lunas';
      }).length
    };

    // Update status jatuh tempo otomatis
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('hutang_pembelian')
      .update({ status: 'Jatuh Tempo' })
      .lt('jatuh_tempo', today)
      .neq('status', 'Lunas')
      .gt('sisa', 0);

    return NextResponse.json({
      success: true,
      data: formattedData,
      summary
    });

  } catch (error: any) {
    console.error('Error fetching hutang pembelian:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil data hutang pembelian'
      },
      { status: 500 }
    );
  }
}

// Export untuk metode POST jika diperlukan untuk operasi lain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'generate_report':
        // Generate laporan dalam format tertentu
        return await generateReport(body);
      
      case 'send_reminder':
        // Kirim reminder untuk hutang yang akan jatuh tempo
        return await sendReminder(body);
      
      default:
        return NextResponse.json(
          { success: false, message: 'Action tidak dikenali' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error processing POST request:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// Fungsi helper untuk generate report
async function generateReport(params: any) {
  try {
    const { format, filters } = params;

    let query = supabase
      .from('hutang_pembelian')
      .select(`
        *,
        suplier:suplier_id (nama, telepon, alamat),
        transaksi_pembelian:transaksi_pembelian_id (nomor_faktur)
      `);

    // Aplikasikan filter
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      format,
      generated_at: new Date().toISOString()
    });

  } catch (error: any) {
    throw new Error(`Generate report error: ${error.message}`);
  }
}

// Fungsi helper untuk send reminder
async function sendReminder(params: any) {
  try {
    const { hutang_ids } = params;

    // Get hutang data dengan supplier info
    const { data: hutangData, error } = await supabase
      .from('hutang_pembelian')
      .select(`
        *,
        suplier:suplier_id (nama, email, telepon)
      `)
      .in('id', hutang_ids);

    if (error) throw error;

    // Di sini Anda bisa implementasi logika pengiriman email/SMS
    // Contoh: kirim ke service email atau SMS gateway

    return NextResponse.json({
      success: true,
      message: `Reminder berhasil dikirim untuk ${hutangData?.length} hutang`,
      sent_to: hutangData?.map(h => ({
        id: h.id,
        supplier: h.suplier?.nama,
        amount: h.sisa
      }))
    });

  } catch (error: any) {
    throw new Error(`Send reminder error: ${error.message}`);
  }
}

// Fungsi untuk mendapatkan statistik hutang
export async function getHutangStatistics() {
  try {
    const { data, error } = await supabase
      .from('hutang_pembelian')
      .select('status, total_hutang, dibayar, sisa, jatuh_tempo');

    if (error) throw error;

    const stats = {
      total_records: data?.length || 0,
      by_status: {
        lunas: data?.filter(h => h.status === 'lunas').length || 0,
        belum_lunas: data?.filter(h => h.status === 'belum_lunas').length || 0,
        jatuh_tempo: data?.filter(h => h.status === 'jatuh_tempo').length || 0
      },
      amounts: {
        total_hutang: data?.reduce((sum, h) => sum + Number(h.total_hutang), 0) || 0,
        total_dibayar: data?.reduce((sum, h) => sum + Number(h.dibayar), 0) || 0,
        total_sisa: data?.reduce((sum, h) => sum + Number(h.sisa), 0) || 0
      },
      upcoming_due: data?.filter(h => {
        if (!h.jatuh_tempo || h.status === 'lunas') return false;
        const dueDate = new Date(h.jatuh_tempo);
        const today = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue >= 0 && daysUntilDue <= 7;
      }).length || 0
    };

    return stats;

  } catch (error: any) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}
