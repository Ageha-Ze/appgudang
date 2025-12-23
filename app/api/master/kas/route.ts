import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const cabangId = searchParams.get('cabang_id');

    let query = supabase
      .from('kas')
      .select(`
        *,
        cabang (
          id,
          nama_cabang
        )
      `)
      .order('nama_kas', { ascending: true });

    // Filter by cabang jika ada parameter cabang_id
    if (cabangId) {
      query = query.eq('cabang_id', cabangId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching kas:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      data: data || [] 
    });
  } catch (error: any) {
    console.error('Error fetching kas:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const { data, error } = await supabase
      .from('kas')
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error('Error creating kas:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Kas berhasil ditambahkan'
    });
  } catch (error: any) {
    console.error('Error in kas POST:', error);
    return NextResponse.json(
      { error: error.message, success: false },
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
        { error: 'ID kas diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const { data, error } = await supabase
      .from('kas')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating kas:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Kas berhasil diupdate'
    });
  } catch (error: any) {
    console.error('Error in kas PUT:', error);
    return NextResponse.json(
      { error: error.message, success: false },
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
        { error: 'ID kas diperlukan', success: false },
        { status: 400 }
      );
    }

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

    if (fetchError) {
      console.error('Error fetching kas:', fetchError);
      return NextResponse.json(
        { error: fetchError.message, success: false },
        { status: 500 }
      );
    }

    if (!kasData) {
      return NextResponse.json(
        { error: 'Data kas tidak ditemukan', success: false },
        { status: 404 }
      );
    }

    // Handle cabang (could be array or object)
    const cabang = Array.isArray(kasData.cabang) ? kasData.cabang[0] : kasData.cabang;

    // Catat removal ke tabel kas_removal_log
    const removalLog = {
      kas_id: kasData.id,
      nama_kas: kasData.nama_kas,
      no_rekening: kasData.no_rekening || '',
      tipe_kas: kasData.tipe_kas || '',
      cabang_id: kasData.cabang_id,
      nama_cabang: cabang?.nama_cabang || '-',
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

    if (deleteError) {
      console.error('Error deleting kas:', deleteError);
      return NextResponse.json(
        { error: deleteError.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kas berhasil dihapus dan tercatat di log',
      log: removalLog
    });
  } catch (error: any) {
    console.error('Error in kas DELETE:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
