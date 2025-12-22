'use server';

import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';
import { databaseOperationWithRetry } from '@/lib/apiRetry';

// Define return types for consistency
type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
  warning?: string;
  data?: any;
  isOffline?: boolean;
  queued?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};


export async function getKas(): Promise<ActionResult> {
  try {
    const supabase = await supabaseAuthenticated();
    
    const { data, error } = await supabase
      .from('kas')
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang
        )
      `)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching kas:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }

    return {
      success: true,
      data: data || []
    };
  } catch (error: any) {
    console.error('Unexpected error in getKas:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Unknown error'
    };
  }
}

export async function getCabangList(): Promise<ActionResult> {
  try {
    const supabase = await supabaseAuthenticated();
    
    const { data, error } = await supabase
      .from('cabang')
      .select('id, nama_cabang')
      .order('nama_cabang', { ascending: true });

    if (error) {
      console.error('Error fetching cabang:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }

    return {
      success: true,
      data: data || []
    };
  } catch (error: any) {
    console.error('Unexpected error in getCabangList:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Unknown error'
    };
  }
}

export async function getTransaksiKas(kasId: number): Promise<ActionResult> {
  try {
    const supabase = await supabaseAuthenticated();
    
    const { data, error } = await supabase
      .from('transaksi_kas')
      .select('*')
      .eq('kas_id', kasId)
      .order('tanggal_transaksi', { ascending: false });

    if (error) {
      console.error('Error fetching transaksi kas:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }

    return {
      success: true,
      data: data || []
    };
  } catch (error: any) {
    console.error('Unexpected error in getTransaksiKas:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Unknown error'
    };
  }
}

export async function addKas(formData: any): Promise<ActionResult> {
  const result = await databaseOperationWithRetry(async () => {
    const supabase = await supabaseAuthenticated();

    const { data, error } = await supabase
      .from('kas')
      .insert([formData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }, 'Create Kas');

  if (result.success) {
    revalidatePath('/master/kas');
    return {
      success: true,
      data: result.data,
      message: 'Kas berhasil ditambahkan',
      isOffline: result.isRetry,
      queued: result.isRetry
    };
  } else {
    console.error('Error adding kas:', result.error);
    return {
      success: false,
      error: result.error,
      message: 'Gagal menambahkan kas',
      isOffline: true,
      queued: true
    };
  }
}

export async function updateKas(id: number, formData: any): Promise<ActionResult> {
  try {
    const supabase = await supabaseAuthenticated();

    const { data, error } = await supabase
      .from('kas')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating kas:', error);
      return {
        success: false,
        error: error.message,
        message: 'Gagal mengupdate kas'
      };
    }

    revalidatePath('/master/kas');
    return {
      success: true,
      data: data,
      message: 'Kas berhasil diupdate'
    };
  } catch (error: any) {
    console.error('Unexpected error in updateKas:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: 'Gagal mengupdate kas'
    };
  }
}

export async function deleteKas(id: number): Promise<ActionResult> {
  const result = await databaseOperationWithRetry(async () => {
    const supabase = await supabaseAuthenticated();

    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();

    // Ambil data kas sebelum dihapus untuk dicatat
    const { data: kasData, error: fetchError } = await supabase
      .from('kas')
      .select(`
        *,
        cabang:cabang_id (
          id,
          nama_cabang
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!kasData) throw new Error('Data kas tidak ditemukan');

    // Catat removal ke tabel kas_removal_log
    const removalLog = {
      kas_id: kasData.id,
      nama_kas: kasData.nama_kas,
      no_rekening: kasData.no_rekening || '',
      tipe_kas: kasData.tipe_kas || '',
      cabang_id: kasData.cabang_id,
      nama_cabang: kasData.cabang?.nama_cabang || '-',
      saldo_terakhir: kasData.saldo || 0,
      keterangan: kasData.keterangan || '',
      deleted_by: user?.email || 'unknown',
      deleted_at: new Date().toISOString(),
      kas_data: kasData // Simpan seluruh data kas sebagai JSON
    };

    const { error: logError } = await supabase
      .from('kas_removal_log')
      .insert(removalLog);

    if (logError) {
      console.error('Error logging kas removal:', logError);
      // Lanjutkan proses delete meskipun log gagal
    }

    // Hapus kas
    const { error } = await supabase
      .from('kas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }, 'Delete Kas');

  if (result.success) {
    revalidatePath('/master/kas');
    return {
      success: true,
      message: 'Kas berhasil dihapus dan tercatat di log',
      isOffline: result.isRetry,
      queued: result.isRetry
    };
  } else {
    console.error('Error deleting kas:', result.error);
    return {
      success: false,
      error: result.error,
      message: 'Gagal menghapus kas',
      isOffline: true,
      queued: true
    };
  }
}

// New function to get removal logs
export async function getKasRemovalLogs(filters?: {
  page?: number;
  limit?: number;
  search?: string;
  cabang_id?: number;
}): Promise<ActionResult> {
  try {
    const supabase = await supabaseAuthenticated();
    
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const search = filters?.search || '';
    const cabangId = filters?.cabang_id;
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('kas_removal_log')
      .select('*', { count: 'exact' })
      .order('deleted_at', { ascending: false });

    // Filter by search
    if (search) {
      query = query.or(`nama_kas.ilike.%${search}%,deleted_by.ilike.%${search}%,nama_cabang.ilike.%${search}%,no_rekening.ilike.%${search}%`);
    }

    // Filter by cabang
    if (cabangId) {
      query = query.eq('cabang_id', cabangId);
    }

    // Pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching kas removal log:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }

    return {
      success: true,
      data: data || [],
      message: 'Data berhasil dimuat',
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error: any) {
    console.error('Unexpected error in getKasRemovalLogs:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Unknown error'
    };
  }
}
