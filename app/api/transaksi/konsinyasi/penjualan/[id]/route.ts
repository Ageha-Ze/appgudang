// app/api/transaksi/konsinyasi/penjualan/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuthenticated } from '@/lib/supabaseServer';

// GET - Detail penjualan by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;

    const { data, error } = await supabase
      .from('penjualan_konsinyasi')
      .select(`
        *,
        detail_konsinyasi:detail_konsinyasi_id (
          *,
          konsinyasi:konsinyasi_id (
            id,
            kode_konsinyasi,
            cabang_id
          ),
          produk:produk_id (
            id,
            nama_produk,
            kode_produk,
            satuan
          )
        ),
        kas:kas_id (
          id,
          nama_kas
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching penjualan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update penjualan konsinyasi
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;
    const body = await request.json();

    // 1. Get data penjualan lama
    const { data: penjualanLama, error: errorLama } = await supabase
      .from('penjualan_konsinyasi')
      .select(`
        *,
        detail_konsinyasi:detail_konsinyasi_id (
          *,
          konsinyasi:konsinyasi_id (
            kode_konsinyasi,
            cabang_id
          ),
          produk:produk_id (
            nama_produk,
            satuan
          )
        )
      `)
      .eq('id', id)
      .single();

    if (errorLama || !penjualanLama) {
      return NextResponse.json({ error: 'Data penjualan tidak ditemukan' }, { status: 404 });
    }

    const jumlahBaru = parseFloat(body.jumlah_terjual);
    const jumlahLama = parseFloat(penjualanLama.jumlah_terjual);
    const selisih = jumlahBaru - jumlahLama;

    // 2. Get detail konsinyasi untuk validasi
    const { data: detail, error: detailError } = await supabase
      .from('detail_konsinyasi')
      .select('*')
      .eq('id', penjualanLama.detail_konsinyasi_id)
      .single();

    if (detailError || !detail) {
      return NextResponse.json({ error: 'Detail konsinyasi tidak ditemukan' }, { status: 404 });
    }

    // 3. Validasi jumlah baru tidak melebihi sisa + jumlah lama
    const sisaTersedia = detail.jumlah_sisa + jumlahLama;
    if (jumlahBaru > sisaTersedia) {
      return NextResponse.json({
        error: `Jumlah terjual melebihi sisa yang tersedia (${sisaTersedia})`
      }, { status: 400 });
    }

    // 4. Calculate ulang
    const total_penjualan = jumlahBaru * body.harga_jual_toko;
    const total_nilai_kita = jumlahBaru * detail.harga_konsinyasi;
    const keuntungan_toko = total_penjualan - total_nilai_kita;

    const total_nilai_kita_lama = jumlahLama * detail.harga_konsinyasi;
    const selisih_nilai = total_nilai_kita - total_nilai_kita_lama;

    // 5. Update penjualan konsinyasi
    const { error: updatePenjualanError } = await supabase
      .from('penjualan_konsinyasi')
      .update({
        tanggal_jual: body.tanggal_jual,
        jumlah_terjual: jumlahBaru,
        harga_jual_toko: body.harga_jual_toko,
        total_penjualan,
        total_nilai_kita,
        keuntungan_toko,
        kas_id: body.kas_id,
        tanggal_pembayaran: body.tanggal_pembayaran,
        keterangan: body.keterangan || null,
      })
      .eq('id', id);

    if (updatePenjualanError) throw updatePenjualanError;

    // 6. Update detail konsinyasi
    const newJumlahTerjual = parseFloat(detail.jumlah_terjual) + selisih;
    const newJumlahSisa = parseFloat(detail.jumlah_sisa) - selisih;
    const keuntungan_toko_lama = parseFloat(penjualanLama.keuntungan_toko);
    const newKeuntunganToko = parseFloat(detail.keuntungan_toko) - keuntungan_toko_lama + keuntungan_toko;

    const { error: updateDetailError } = await supabase
      .from('detail_konsinyasi')
      .update({
        jumlah_terjual: newJumlahTerjual,
        jumlah_sisa: newJumlahSisa,
        keuntungan_toko: newKeuntunganToko,
      })
      .eq('id', penjualanLama.detail_konsinyasi_id);

    if (updateDetailError) throw updateDetailError;

    // 7. Hapus transaksi kas lama
    await supabase
      .from('transaksi_kas')
      .delete()
      .eq('kas_id', penjualanLama.kas_id)
      .eq('kredit', total_nilai_kita_lama)
      .ilike('keterangan', `%${penjualanLama.detail_konsinyasi.konsinyasi.kode_konsinyasi}%`);

    // 8. Update saldo kas lama (kembalikan)
    if (penjualanLama.kas_id) {
      const { data: kasLama } = await supabase
        .from('kas')
        .select('saldo')
        .eq('id', penjualanLama.kas_id)
        .single();

      if (kasLama) {
        await supabase
          .from('kas')
          .update({
            saldo: parseFloat(kasLama.saldo) - total_nilai_kita_lama,
            updated_at: new Date().toISOString()
          })
          .eq('id', penjualanLama.kas_id);
      }
    }

    // 9. Update saldo kas baru (tambahkan)
    const { data: kasBaru, error: kasError } = await supabase
      .from('kas')
      .select('saldo')
      .eq('id', body.kas_id)
      .single();

    if (kasError || !kasBaru) {
      return NextResponse.json({ error: 'Kas tujuan tidak ditemukan' }, { status: 404 });
    }

    const saldoBaru = parseFloat(kasBaru.saldo) + total_nilai_kita;

    await supabase
      .from('kas')
      .update({
        saldo: saldoBaru,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.kas_id);

    // 10. Catat transaksi kas baru
    const keterangan = `Penjualan konsinyasi ${penjualanLama.detail_konsinyasi.konsinyasi.kode_konsinyasi} - ${penjualanLama.detail_konsinyasi.produk.nama_produk} (${jumlahBaru} ${penjualanLama.detail_konsinyasi.produk.satuan})`;

    await supabase
      .from('transaksi_kas')
      .insert({
        kas_id: body.kas_id,
        tanggal_transaksi: body.tanggal_pembayaran || body.tanggal_jual,
        kredit: total_nilai_kita,
        debit: 0,
        keterangan,
      });

    return NextResponse.json({
      success: true,
      message: 'Penjualan berhasil diupdate',
    });

  } catch (error: any) {
    console.error('Error updating penjualan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Hapus penjualan konsinyasi
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseAuthenticated();
    const { id } = await params;

    // 1. Get data penjualan
    const { data: penjualan, error: penjualanError } = await supabase
      .from('penjualan_konsinyasi')
      .select(`
        *,
        detail_konsinyasi:detail_konsinyasi_id (
          *,
          konsinyasi:konsinyasi_id (
            kode_konsinyasi,
            cabang_id
          ),
          produk:produk_id (
            nama_produk,
            satuan
          )
        )
      `)
      .eq('id', id)
      .single();

    if (penjualanError || !penjualan) {
      return NextResponse.json({ error: 'Data penjualan tidak ditemukan' }, { status: 404 });
    }

    const jumlah = parseFloat(penjualan.jumlah_terjual);
    const total_nilai = parseFloat(penjualan.total_nilai_kita);

    // 2. Kembalikan jumlah ke detail konsinyasi
    const { data: detail } = await supabase
      .from('detail_konsinyasi')
      .select('*')
      .eq('id', penjualan.detail_konsinyasi_id)
      .single();

    if (detail) {
      const newJumlahTerjual = parseFloat(detail.jumlah_terjual) - jumlah;
      const newJumlahSisa = parseFloat(detail.jumlah_sisa) + jumlah;
      const newKeuntunganToko = parseFloat(detail.keuntungan_toko) - parseFloat(penjualan.keuntungan_toko);

      await supabase
        .from('detail_konsinyasi')
        .update({
          jumlah_terjual: newJumlahTerjual,
          jumlah_sisa: newJumlahSisa,
          keuntungan_toko: newKeuntunganToko,
        })
        .eq('id', penjualan.detail_konsinyasi_id);
    }

    // 3. Kurangi saldo kas
    if (penjualan.kas_id) {
      const { data: kas } = await supabase
        .from('kas')
        .select('saldo')
        .eq('id', penjualan.kas_id)
        .single();

      if (kas) {
        const saldoBaru = parseFloat(kas.saldo) - total_nilai;
        
        await supabase
          .from('kas')
          .update({
            saldo: saldoBaru,
            updated_at: new Date().toISOString()
          })
          .eq('id', penjualan.kas_id);
      }
    }

    // 4. Hapus transaksi kas terkait
    await supabase
      .from('transaksi_kas')
      .delete()
      .eq('kas_id', penjualan.kas_id)
      .eq('kredit', total_nilai)
      .ilike('keterangan', `%${penjualan.detail_konsinyasi.konsinyasi.kode_konsinyasi}%`);

    // 5. Hapus penjualan
    const { error: deleteError } = await supabase
      .from('penjualan_konsinyasi')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Penjualan berhasil dihapus, stock dan kas telah dikembalikan',
    });

  } catch (error: any) {
    console.error('Error deleting penjualan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
