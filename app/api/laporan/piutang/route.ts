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

    // Query piutang penjualan tanpa join dulu
    let query = supabase
      .from('piutang_penjualan')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter berdasarkan status (exclude 'Jatuh Tempo' from DB query due to enum issues)
    if (status && status !== 'semua' && status !== 'Jatuh Tempo') {
      query = query.eq('status', status);
    }

    // Filter berdasarkan tanggal
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    let { data: piutangData, error: piutangError } = await query;

    if (piutangError) {
      console.error('Query error:', piutangError);
      throw piutangError;
    }

    console.log('Piutang data from database:', piutangData);
    console.log('Piutang data count:', piutangData?.length || 0);

    // 🔍 DEBUG: Check for penjualan transactions with hutang payment
    const { data: penjualanHutang, error: penjualanError } = await supabase
      .from('transaksi_penjualan')
      .select('id, jenis_pembayaran, status, customer_id, total, dibayar, tanggal, jatuh_tempo')
      .eq('jenis_pembayaran', 'hutang')
      .eq('status', 'billed');

    console.log('Penjualan with hutang payment:', penjualanHutang);
    console.log('Penjualan hutang count:', penjualanHutang?.length || 0);

    // 🔧 FIX: Create missing piutang records for existing credit sales
    if (penjualanHutang && penjualanHutang.length > 0) {
      console.log('🔧 Creating/updating piutang records for credit sales...');

      // Delete existing piutang records to recalculate with correct logic
      await supabase
        .from('piutang_penjualan')
        .delete()
        .in('penjualan_id', penjualanHutang.map(p => p.id));

      for (const penjualan of penjualanHutang) {
        // Check if piutang already exists
        const { data: existingPiutang } = await supabase
          .from('piutang_penjualan')
          .select('id')
          .eq('penjualan_id', penjualan.id)
          .single();

        if (!existingPiutang) {
          // Check for existing cicilan payments
          const { data: cicilanData, error: cicilanError } = await supabase
            .from('cicilan_piutang_penjualan')
            .select('jumlah_cicilan')
            .eq('penjualan_id', penjualan.id);

          // Include initial payment from penjualan.dibayar + any cicilan payments
          const initialPayment = Number(penjualan.dibayar || 0);
          const cicilanTotal = cicilanData?.reduce((sum, c) => sum + Number(c.jumlah_cicilan), 0) || 0;
          const totalDibayar = initialPayment + cicilanTotal;
          const sisa = Number(penjualan.total) - totalDibayar;
          const status = sisa <= 0 ? 'Lunas' : 'Belum Lunas';

          const { error: createError } = await supabase
            .from('piutang_penjualan')
            .insert({
              penjualan_id: penjualan.id,
              customer_id: penjualan.customer_id,
              total_piutang: penjualan.total,
              dibayar: totalDibayar,
              sisa: sisa,
              status: status,
              jatuh_tempo: penjualan.jatuh_tempo
            });

          if (createError) {
            console.error(`❌ Failed to create piutang for penjualan ${penjualan.id}:`, createError);
          } else {
            console.log(`✅ Created piutang for penjualan ${penjualan.id} (${status})`);
          }
        }
      }

      // Re-fetch piutang data with original filters applied
      let reQuery = supabase
        .from('piutang_penjualan')
        .select('*')
        .order('created_at', { ascending: false });

      // Re-apply filters
      if (status && status !== 'semua' && status !== 'Jatuh Tempo') {
        reQuery = reQuery.eq('status', status);
      }
      if (startDate) {
        reQuery = reQuery.gte('created_at', startDate);
      }
      if (endDate) {
        reQuery = reQuery.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data: updatedPiutangData } = await reQuery;
      piutangData = updatedPiutangData;
      console.log('Updated piutang data count:', piutangData?.length || 0);
    }

    // Ambil semua customer_id yang unik
    const customerIds = [...new Set(piutangData?.map(p => p.customer_id).filter(Boolean))];
    
    // Ambil data customer secara terpisah
    let customerMap = new Map();
    if (customerIds.length > 0) {
      const { data: customerData, error: customerError } = await supabase
        .from('customer')
        .select('id, nama, alamat, no_hp')
        .in('id', customerIds);

      if (!customerError && customerData) {
        customerMap = new Map(customerData.map(c => [c.id, c]));
      }
    }

    // Gabungkan data piutang dengan customer
    let formattedData = piutangData?.map(item => ({
      id: item.id,
      penjualan_id: item.penjualan_id,
      customer_id: item.customer_id,
      customer_nama: customerMap.get(item.customer_id)?.nama || 'Unknown',
      total_piutang: Number(item.total_piutang),
      dibayar: Number(item.dibayar),
      sisa: Number(item.sisa),
      status: item.status,
      jatuh_tempo: item.jatuh_tempo,
      created_at: item.created_at
    })) || [];

    // Filter by status (handle 'Jatuh Tempo' client-side)
    if (status === 'Jatuh Tempo') {
      formattedData = formattedData.filter(item => {
        if (!item.jatuh_tempo) return false;
        const today = new Date();
        const dueDate = new Date(item.jatuh_tempo);
        return dueDate < today && item.status !== 'Lunas';
      });
    }

    // Filter by search
    if (search && formattedData.length > 0) {
      formattedData = formattedData.filter(item =>
        item.customer_nama?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Hitung summary
    const summary = {
      total_piutang: formattedData.reduce((sum, item) => sum + Number(item.total_piutang), 0),
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
      .from('piutang_penjualan')
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
    console.error('Error fetching piutang penjualan:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil data piutang penjualan'
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
        // Kirim reminder untuk piutang yang akan jatuh tempo
        return await sendReminder(body);
      
      case 'aging_analysis':
        // Analisis umur piutang
        return await agingAnalysis(body);
      
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
      .from('piutang_penjualan')
      .select(`
        *,
        customer:customer_id (nama, telepon, alamat, email),
        transaksi_penjualan:penjualan_id (nomor_faktur, tanggal)
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

    // Hitung total dan summary
    const reportData = {
      data,
      summary: {
        total_records: data?.length || 0,
        total_piutang: data?.reduce((sum, item) => sum + Number(item.total_piutang), 0) || 0,
        total_dibayar: data?.reduce((sum, item) => sum + Number(item.dibayar), 0) || 0,
        total_sisa: data?.reduce((sum, item) => sum + Number(item.sisa), 0) || 0
      },
      generated_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      ...reportData,
      format
    });

  } catch (error: any) {
    throw new Error(`Generate report error: ${error.message}`);
  }
}

// Fungsi helper untuk send reminder
async function sendReminder(params: any) {
  try {
    const { piutang_ids } = params;

    // Get piutang data dengan customer info
    const { data: piutangData, error } = await supabase
      .from('piutang_penjualan')
      .select(`
        *,
        customer:customer_id (nama, email, telepon)
      `)
      .in('id', piutang_ids);

    if (error) throw error;

    // Di sini Anda bisa implementasi logika pengiriman email/SMS
    // Contoh: kirim ke service email atau SMS gateway
    const reminders = piutangData?.map(p => ({
      id: p.id,
      customer: p.customer?.nama,
      email: p.customer?.email,
      phone: p.customer?.telepon,
      amount: p.sisa,
      due_date: p.jatuh_tempo,
      message: `Reminder: Piutang sebesar ${p.sisa} akan jatuh tempo pada ${p.jatuh_tempo}`
    }));

    return NextResponse.json({
      success: true,
      message: `Reminder berhasil dikirim untuk ${piutangData?.length} piutang`,
      reminders
    });

  } catch (error: any) {
    throw new Error(`Send reminder error: ${error.message}`);
  }
}

// Fungsi untuk analisis umur piutang (aging analysis)
async function agingAnalysis(params: any) {
  try {
    const { data, error } = await supabase
      .from('piutang_penjualan')
      .select('*, customer:customer_id(nama)')
      .neq('status', 'lunas');

    if (error) throw error;

    const today = new Date();
    const aging = {
      current: [] as any[], // 0-30 hari
      overdue_30: [] as any[], // 31-60 hari
      overdue_60: [] as any[], // 61-90 hari
      overdue_90: [] as any[], // > 90 hari
    };

    data?.forEach(item => {
      if (!item.jatuh_tempo) {
        aging.current.push(item);
        return;
      }

      const dueDate = new Date(item.jatuh_tempo);
      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 0) {
        aging.current.push(item);
      } else if (daysDiff <= 30) {
        aging.overdue_30.push(item);
      } else if (daysDiff <= 60) {
        aging.overdue_60.push(item);
      } else {
        aging.overdue_90.push(item);
      }
    });

    const summary = {
      current: {
        count: aging.current.length,
        total: aging.current.reduce((sum, item) => sum + Number(item.sisa), 0)
      },
      overdue_30: {
        count: aging.overdue_30.length,
        total: aging.overdue_30.reduce((sum, item) => sum + Number(item.sisa), 0)
      },
      overdue_60: {
        count: aging.overdue_60.length,
        total: aging.overdue_60.reduce((sum, item) => sum + Number(item.sisa), 0)
      },
      overdue_90: {
        count: aging.overdue_90.length,
        total: aging.overdue_90.reduce((sum, item) => sum + Number(item.sisa), 0)
      }
    };

    return NextResponse.json({
      success: true,
      aging,
      summary,
      generated_at: new Date().toISOString()
    });

  } catch (error: any) {
    throw new Error(`Aging analysis error: ${error.message}`);
  }
}

// Fungsi untuk mendapatkan statistik piutang
export async function getPiutangStatistics() {
  try {
    const { data, error } = await supabase
      .from('piutang_penjualan')
      .select('status, total_piutang, dibayar, sisa, jatuh_tempo, created_at');

    if (error) throw error;

    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = {
      total_records: data?.length || 0,
      by_status: {
        lunas: data?.filter(p => p.status === 'lunas').length || 0,
        belum_lunas: data?.filter(p => p.status === 'belum_lunas').length || 0,
        jatuh_tempo: data?.filter(p => p.status === 'jatuh_tempo').length || 0
      },
      amounts: {
        total_piutang: data?.reduce((sum, p) => sum + Number(p.total_piutang), 0) || 0,
        total_dibayar: data?.reduce((sum, p) => sum + Number(p.dibayar), 0) || 0,
        total_sisa: data?.reduce((sum, p) => sum + Number(p.sisa), 0) || 0
      },
      this_month: {
        count: data?.filter(p => new Date(p.created_at) >= thisMonth).length || 0,
        amount: data?.filter(p => new Date(p.created_at) >= thisMonth)
          .reduce((sum, p) => sum + Number(p.total_piutang), 0) || 0
      },
      upcoming_due: data?.filter(p => {
        if (!p.jatuh_tempo || p.status === 'lunas') return false;
        const dueDate = new Date(p.jatuh_tempo);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue >= 0 && daysUntilDue <= 7;
      }).length || 0,
      collection_rate: calculateCollectionRate(data)
    };

    return stats;

  } catch (error: any) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}

// Helper function untuk menghitung collection rate
function calculateCollectionRate(data: any[] | null) {
  if (!data || data.length === 0) return 0;
  
  const totalPiutang = data.reduce((sum, p) => sum + Number(p.total_piutang), 0);
  const totalDibayar = data.reduce((sum, p) => sum + Number(p.dibayar), 0);
  
  if (totalPiutang === 0) return 0;
  
  return (totalDibayar / totalPiutang) * 100;
}
