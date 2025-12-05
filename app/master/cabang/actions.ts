'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

// Define return types for consistency
type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
  warning?: string;
  data?: any;
};

export async function getCabang(): Promise<ActionResult> {
  try {
    const supabase = supabaseServer();
    
    const { data, error } = await supabase
      .from('cabang')
      .select('*')
      .order('id', { ascending: true });

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
    console.error('Unexpected error in getCabang:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Unknown error'
    };
  }
}

export async function addCabang(formData: any): Promise<ActionResult> {
  try {
    const supabase = supabaseServer();

    // Validasi nama_kas wajib diisi
    if (!formData.nama_kas) {
      return { 
        success: false, 
        error: 'Nama Kas wajib diisi untuk generate kas otomatis' 
      };
    }

    // 1. Insert Cabang
    const { data: cabangData, error: cabangError } = await supabase
      .from('cabang')
      .insert([formData])
      .select()
      .single();

    if (cabangError) {
      console.error('Error inserting cabang:', cabangError);
      return { 
        success: false, 
        error: cabangError.message,
        message: 'Gagal menambahkan cabang'
      };
    }

    // 2. Auto-generate Kas untuk cabang ini
    const { data: kasData, error: kasError } = await supabase
      .from('kas')
      .insert({
        nama_kas: formData.nama_kas,
        tipe_kas: 'bank',
        no_rekening: formData.nomor_rekening || null,
        saldo: 0,
        cabang_id: cabangData.id,
      })
      .select()
      .single();

    if (kasError) {
      console.error('Error creating kas:', kasError);
      
      // Rollback: hapus cabang yang sudah dibuat
      await supabase
        .from('cabang')
        .delete()
        .eq('id', cabangData.id);

      return { 
        success: false, 
        error: `Cabang berhasil dibuat, tapi gagal membuat kas: ${kasError.message}. Data telah di-rollback.` 
      };
    }

    revalidatePath('/master/cabang');
    revalidatePath('/master/kas');

    return { 
      success: true,
      message: `Cabang "${formData.nama_cabang}" dan Kas "${formData.nama_kas}" berhasil dibuat`,
      data: {
        cabang: cabangData,
        kas: kasData
      }
    };
  } catch (error: any) {
    console.error('Unexpected error in addCabang:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: 'Terjadi kesalahan saat menambahkan cabang'
    };
  }
}

export async function updateCabang(id: number, formData: any): Promise<ActionResult> {
  try {
    const supabase = supabaseServer();
    
    // 1. Update Cabang
    const { data: cabangData, error: cabangError } = await supabase
      .from('cabang')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (cabangError) {
      console.error('Error updating cabang:', cabangError);
      return { 
        success: false, 
        error: cabangError.message,
        message: 'Gagal mengupdate cabang'
      };
    }

    // 2. Update atau Create Kas yang terkait
    if (formData.nama_kas) {
      const { data: existingKas } = await supabase
        .from('kas')
        .select('*')
        .eq('cabang_id', id)
        .maybeSingle();

      if (existingKas) {
        const { error: updateKasError } = await supabase
          .from('kas')
          .update({
            nama_kas: formData.nama_kas,
            no_rekening: formData.nomor_rekening || null,
            updated_at: new Date().toISOString(),
          })
          .eq('cabang_id', id);

        if (updateKasError) {
          console.error('Error updating kas:', updateKasError);
          return { 
            success: true, 
            message: 'Cabang berhasil diupdate, tapi gagal update kas',
            error: updateKasError.message
          };
        }
      } else {
        const { error: createKasError } = await supabase
          .from('kas')
          .insert({
            nama_kas: formData.nama_kas,
            tipe_kas: 'bank',
            no_rekening: formData.nomor_rekening || null,
            saldo: 0,
            cabang_id: id,
          });

        if (createKasError) {
          console.error('Error creating kas:', createKasError);
          return { 
            success: true, 
            message: 'Cabang berhasil diupdate, tapi gagal membuat kas baru',
            error: createKasError.message
          };
        }
      }
    }

    revalidatePath('/master/cabang');
    revalidatePath('/master/kas');

    return { 
      success: true,
      message: `Cabang "${formData.nama_cabang}" berhasil diupdate`
    };
  } catch (error: any) {
    console.error('Unexpected error in updateCabang:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: 'Terjadi kesalahan saat mengupdate cabang'
    };
  }
}

export async function deleteCabang(id: number): Promise<ActionResult> {
  try {
    const supabase = supabaseServer();
    
    // Check if there are related kas records
    const { data: relatedKas, error: checkKasError } = await supabase
      .from('kas')
      .select('id, nama_kas, saldo')
      .eq('cabang_id', id);

    if (checkKasError) {
      console.error('Error checking related kas:', checkKasError);
      return { 
        success: false, 
        error: checkKasError.message,
        message: 'Gagal memeriksa kas terkait'
      };
    }

    // Check if any kas has non-zero balance
    const hasBalance = relatedKas?.some(kas => Number(kas.saldo) !== 0);
    if (hasBalance) {
      return { 
        success: false, 
        error: 'Tidak dapat menghapus cabang karena ada kas dengan saldo tidak 0. Kosongkan saldo terlebih dahulu.' 
      };
    }

    // Delete related kas first
    if (relatedKas && relatedKas.length > 0) {
      const { error: deleteKasError } = await supabase
        .from('kas')
        .delete()
        .eq('cabang_id', id);

      if (deleteKasError) {
        console.error('Error deleting related kas:', deleteKasError);
        return { 
          success: false, 
          error: `Tidak dapat menghapus kas terkait: ${deleteKasError.message}` 
        };
      }
    }

    // Delete cabang
    const { error: deleteCabangError } = await supabase
      .from('cabang')
      .delete()
      .eq('id', id);

    if (deleteCabangError) {
      console.error('Error deleting cabang:', deleteCabangError);
      return { 
        success: false, 
        error: deleteCabangError.message,
        message: 'Gagal menghapus cabang'
      };
    }

    revalidatePath('/master/cabang');
    revalidatePath('/master/kas');

    return { 
      success: true,
      message: 'Cabang dan kas terkait berhasil dihapus'
    };
  } catch (error: any) {
    console.error('Unexpected error in deleteCabang:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: 'Terjadi kesalahan saat menghapus cabang'
    };
  }
}
