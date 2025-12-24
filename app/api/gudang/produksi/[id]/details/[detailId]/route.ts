import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; detailId: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const body = await request.json();
    const { item_id, jumlah, hpp, subtotal } = body;
    const { id, detailId } = await params;

    if (!detailId || !item_id || !jumlah || !hpp || !subtotal) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('detail_produksi')
      .update({
        item_id: parseInt(item_id),
        jumlah: parseFloat(jumlah),
        hpp: parseFloat(hpp),
        subtotal: parseFloat(subtotal),
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(detailId))
      .eq('produksi_id', parseInt(id)) // Ensure it belongs to the correct production
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error updating detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
