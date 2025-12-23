import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('cabang')
      .select('*')
      .order('nama_cabang', { ascending: true });

    // Filter by search if provided
    if (search) {
      query = query.or(`nama_cabang.ilike.%${search}%,kode_cabang.ilike.%${search}%,alamat.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching cabang:', error);
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
    console.error('Error fetching cabang:', error);
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

    // Validasi nama_kas wajib diisi
    if (!body.nama_kas) {
      return NextResponse.json(
        { error: 'Nama Kas wajib diisi untuk generate kas otomatis', success: false },
        { status: 400 }
      );
    }

    // 1. Insert Cabang
    const { data: cabangData, error: cabangError } = await supabase
      .from('cabang')
      .insert([body])
      .select()
      .single();

    if (cabangError) {
      console.error('Error inserting cabang:', cabangError);
      return NextResponse.json(
        { error: cabangError.message, message: 'Gagal menambahkan cabang', success: false },
        { status: 500 }
      );
    }

    // 2. Auto-generate Kas untuk cabang ini
    const { data: kasData, error: kasError } = await supabase
      .from('kas')
      .insert({
        nama_kas: body.nama_kas,
        tipe_kas: 'bank',
        no_rekening: body.nomor_rekening || null,
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

      return NextResponse.json(
        { error: `Cabang berhasil dibuat, tapi gagal membuat kas: ${kasError.message}. Data telah di-rollback.`, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cabang "${body.nama_cabang}" dan Kas "${body.nama_kas}" berhasil dibuat`,
      data: {
        cabang: cabangData,
        kas: kasData
      }
    });
  } catch (error: any) {
    console.error('Error in cabang POST:', error);
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
        { error: 'ID cabang diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    // 1. Update Cabang
    const { data: cabangData, error: cabangError } = await supabase
      .from('cabang')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (cabangError) {
      console.error('Error updating cabang:', cabangError);
      return NextResponse.json(
        { error: cabangError.message, message: 'Gagal mengupdate cabang', success: false },
        { status: 500 }
      );
    }

    // 2. Update atau Create Kas yang terkait
    if (body.nama_kas) {
      const { data: existingKas } = await supabase
        .from('kas')
        .select('*')
        .eq('cabang_id', id)
        .maybeSingle();

      if (existingKas) {
        const { error: updateKasError } = await supabase
          .from('kas')
          .update({
            nama_kas: body.nama_kas,
            no_rekening: body.nomor_rekening || null,
            updated_at: new Date().toISOString(),
          })
          .eq('cabang_id', id);

        if (updateKasError) {
          console.error('Error updating kas:', updateKasError);
          return NextResponse.json(
            { success: true, message: 'Cabang berhasil diupdate, tapi gagal update kas', error: updateKasError.message },
            { status: 200 }
          );
        }
      } else {
        const { error: createKasError } = await supabase
          .from('kas')
          .insert({
            nama_kas: body.nama_kas,
            tipe_kas: 'bank',
            no_rekening: body.nomor_rekening || null,
            saldo: 0,
            cabang_id: parseInt(id),
          });

        if (createKasError) {
          console.error('Error creating kas:', createKasError);
          return NextResponse.json(
            { success: true, message: 'Cabang berhasil diupdate, tapi gagal membuat kas baru', error: createKasError.message },
            { status: 200 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cabang "${body.nama_cabang}" berhasil diupdate`
    });
  } catch (error: any) {
    console.error('Error in cabang PUT:', error);
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
        { error: 'ID cabang diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    // Check if there are related kas records
    const { data: relatedKas, error: checkKasError } = await supabase
      .from('kas')
      .select('id, nama_kas, saldo')
      .eq('cabang_id', id);

    if (checkKasError) {
      console.error('Error checking related kas:', checkKasError);
      return NextResponse.json(
        { error: checkKasError.message, message: 'Gagal memeriksa kas terkait', success: false },
        { status: 500 }
      );
    }

    // Check if any kas has non-zero balance
    const hasBalance = relatedKas?.some(kas => Number(kas.saldo) !== 0);
    if (hasBalance) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus cabang karena ada kas dengan saldo tidak 0. Kosongkan saldo terlebih dahulu.', success: false },
        { status: 400 }
      );
    }

    // Delete related kas first
    if (relatedKas && relatedKas.length > 0) {
      const { error: deleteKasError } = await supabase
        .from('kas')
        .delete()
        .eq('cabang_id', id);

      if (deleteKasError) {
        console.error('Error deleting related kas:', deleteKasError);
        return NextResponse.json(
          { error: `Tidak dapat menghapus kas terkait: ${deleteKasError.message}`, success: false },
          { status: 500 }
        );
      }
    }

    // Delete cabang
    const { error: deleteCabangError } = await supabase
      .from('cabang')
      .delete()
      .eq('id', id);

    if (deleteCabangError) {
      console.error('Error deleting cabang:', deleteCabangError);
      return NextResponse.json(
        { error: deleteCabangError.message, message: 'Gagal menghapus cabang', success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cabang dan kas terkait berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error in cabang DELETE:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
