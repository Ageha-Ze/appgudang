// types/hutang.ts

export interface HutangUmum {
  id: number;
  jenis_hutang: string;
  tanggal_transaksi: string;
  pihak: string;
  keterangan?: string;
  nominal_total: number;
  dibayar: number;
  sisa: number;
  status: 'Belum Lunas' | 'Cicil' | 'Lunas' | 'Jatuh Tempo';
  kas_id: number;
  kas?: {
    id: number;
    nama_kas: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CicilanHutangUmum {
  id: number;
  hutang_id: number;
  tanggal_cicilan: string;
  jumlah_cicilan: number;
  kas_id: number;
  keterangan?: string;
  kas?: {
    id: number;
    nama_kas: string;
  };
  created_at: string;
}
