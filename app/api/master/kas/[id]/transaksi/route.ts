import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const kasId = parseInt(id);

    if (isNaN(kasId)) {
      return NextResponse.json(
        { error: 'Invalid kas ID', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    const { data, error } = await supabase
      .from('transaksi_kas')
      .select('*')
      .eq('kas_id', kasId)
      .order('tanggal_transaksi', { ascending: false });

    if (error) {
      console.error('Error fetching transaksi kas:', error);
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
    console.error('Error in transaksi kas GET:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
