'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
};

export async function getUsers(): Promise<any[]> {
  try {
    const supabase = await supabaseServer();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return data || [];
  } catch (error: any) {
    console.error('Unexpected error in getUsers:', error);
    return [];
  }
}

export async function addUser(formData: {
  username: string;
  password: string;
  level: string;
}): Promise<ActionResult> {
  try {
    const supabase = await supabaseServer();
    
    // Validasi input
    if (!formData.username || !formData.password) {
      return {
        success: false,
        error: 'Username dan password harus diisi',
        message: 'Data tidak lengkap'
      };
    }

    const { data, error } = await supabase
      .from('users')
      .insert([formData])
      .select()
      .single();

    if (error) {
      console.error('Error adding user:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Gagal menambahkan user'
      };
    }

    revalidatePath('/master/user');
    return { 
      success: true,
      data,
      message: 'User berhasil ditambahkan'
    };
  } catch (error: any) {
    console.error('Exception in addUser:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      message: 'Terjadi kesalahan saat menambahkan user'
    };
  }
}

export async function updateUser(
  id: number,
  formData: {
    username: string;
    password?: string;
    level: string;
  }
): Promise<ActionResult> {
  try {
    const supabase = await supabaseServer();
    
    // Validasi input
    if (!formData.username) {
      return {
        success: false,
        error: 'Username harus diisi',
        message: 'Data tidak lengkap'
      };
    }

    const updateData: any = {
      username: formData.username,
      level: formData.level,
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Gagal mengupdate user'
      };
    }

    revalidatePath('/master/user');
    return { 
      success: true,
      data,
      message: 'User berhasil diupdate'
    };
  } catch (error: any) {
    console.error('Exception in updateUser:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      message: 'Terjadi kesalahan saat mengupdate user'
    };
  }
}

export async function deleteUser(id: number): Promise<ActionResult> {
  try {
    const supabase = await supabaseServer();
    
    // Optional: Check if user is being used in other tables
    // Add your business logic here if needed
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting user:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Gagal menghapus user'
      };
    }

    revalidatePath('/master/user');
    return { 
      success: true,
      message: 'User berhasil dihapus'
    };
  } catch (error: any) {
    console.error('Exception in deleteUser:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      message: 'Terjadi kesalahan saat menghapus user'
    };
  }
}
