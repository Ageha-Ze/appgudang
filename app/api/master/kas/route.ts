import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';
import { databaseOperationWithRetry } from '@/lib/apiRetry';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const cabangId = searchParams.get('cabang_id');

    let query = supabase
      .from('kas')
      .select('*')
      .order('nama_kas', { ascending: true });

    // Filter by cabang jika ada parameter cabang_id
    if (cabangId) {
      query = query.eq('cabang_id', cabangId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching kas:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('kas')
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Create Kas');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Kas berhasil ditambahkan',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menambahkan kas',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in kas POST:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID kas diperlukan' },
        { status: 400 }
      );
    }

    const result = await databaseOperationWithRetry(async () => {
      const supabase = await supabaseAuthenticated();
      const body = await request.json();

      const { data, error } = await supabase
        .from('kas')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'Update Kas');

    if (result.success) {
      return NextResponse.json({
        data: result.data,
        message: 'Kas berhasil diupdate',
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal mengupdate kas',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in kas PUT:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID kas diperlukan' },
        { status: 400 }
      );
    }

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
      const { error: deleteError } = await supabase
        .from('kas')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      return { success: true, log: removalLog };
    }, 'Delete Kas');

    if (result.success) {
      return NextResponse.json({
        message: 'Kas berhasil dihapus dan tercatat di log',
        log: result.data?.log,
        isOffline: result.isRetry,
        queued: result.isRetry
      });
    } else {
      return NextResponse.json({
        error: result.error,
        message: 'Gagal menghapus kas',
        isOffline: true,
        queued: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in kas DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
