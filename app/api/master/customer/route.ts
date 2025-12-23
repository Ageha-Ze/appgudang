import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// Generate kode customer otomatis
async function generateKodeCustomer(): Promise<string> {
  try {
    const supabase = await supabaseAuthenticated();

    const { data, error } = await supabase
      .from('customer')
      .select('kode_customer, id')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error generating kode:', error);
      return `CUST-${Date.now()}`;
    }

    if (!data || data.length === 0) {
      return '1';
    }

    const lastKode = data[0].kode_customer;

    // Handle NaN or invalid kode_customer
    if (!lastKode || lastKode === 'NaN' || isNaN(parseInt(lastKode))) {
      // If code is NaN or non-numeric, use timestamp-based generation
      return `CUST-${Date.now()}`;
    }

    // If code is already a CUST-timestamp format, generate a new timestamp
    if (lastKode.startsWith('CUST-')) {
      return `CUST-${Date.now()}`;
    }

    // For numeric codes, increment
    const lastKodeNum = parseInt(lastKode);
    if (isNaN(lastKodeNum)) {
      // Fallback to timestamp if parsing fails
      return `CUST-${Date.now()}`;
    }

    return (lastKodeNum + 1).toString();
  } catch (error) {
    console.error('Exception in generateKodeCustomer:', error);
    return `CUST-${Date.now()}`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseAuthenticated();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    // ✅ PERBAIKAN: Query dengan JOIN yang benar
    let query = supabase
      .from('customer')
      .select(`
        id,
        kode_customer,
        nama,
        alamat,
        no_hp,
        cabang_id,
        created_at,
        updated_at,
        cabang:cabang_id (
          id,
          nama_cabang
        )
      `)
      .order('id', { ascending: false });

    if (search) {
      query = query.or(`nama.ilike.%${search}%,no_hp.ilike.%${search}%,alamat.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    // ✅ PERBAIKAN: Transform data dengan benar
    const transformedData = (data || []).map(customer => {
      // Handle cabang yang bisa array atau object
      let cabangData = null;
      
      if (customer.cabang) {
        if (Array.isArray(customer.cabang)) {
          cabangData = customer.cabang.length > 0 ? customer.cabang[0] : null;
        } else {
          cabangData = customer.cabang;
        }
      }

      return {
        id: customer.id,
        kode_customer: customer.kode_customer,
        nama: customer.nama,
        alamat: customer.alamat,
        no_hp: customer.no_hp,
        cabang_id: customer.cabang_id,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        cabang: cabangData  // ✅ Ini yang penting
      };
    });

    console.log('✅ Sample transformed data:', transformedData[0]);

    return NextResponse.json({
      success: true,
      data: transformedData
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
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

    // Generate kode customer jika tidak ada
    const kodeCustomer = body.kode_customer || await generateKodeCustomer();

    const { data, error } = await supabase
      .from('customer')
      .insert({
        kode_customer: kodeCustomer,
        nama: body.nama,
        alamat: body.alamat || null,
        no_hp: body.no_hp || null,
        cabang_id: body.cabang_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Customer berhasil ditambahkan'
    });
  } catch (error: any) {
    console.error('Error in customer POST:', error);
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
        { error: 'ID customer diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();
    const body = await request.json();

    const { data, error } = await supabase
      .from('customer')
      .update({
        nama: body.nama,
        alamat: body.alamat || null,
        no_hp: body.no_hp || null,
        cabang_id: body.cabang_id || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Customer berhasil diupdate'
    });
  } catch (error: any) {
    console.error('Error in customer PUT:', error);
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
        { error: 'ID customer diperlukan', success: false },
        { status: 400 }
      );
    }

    const supabase = await supabaseAuthenticated();

    // Check if customer is still referenced in other tables
    const { data: references } = await supabase
      .from('transaksi_penjualan')
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if (references && references.length > 0) {
      return NextResponse.json(
        { error: 'Customer tidak dapat dihapus karena masih memiliki transaksi penjualan', success: false },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('customer')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Customer berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error in customer DELETE:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
