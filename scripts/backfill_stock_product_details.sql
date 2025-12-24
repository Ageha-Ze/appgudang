-- Backfill existing stock_barang records with product details
-- This populates nama_produk, kode_produk, and satuan for existing records

UPDATE stock_barang
SET
  nama_produk = p.nama_produk,
  kode_produk = p.kode_produk,
  satuan = p.satuan
FROM produk p
WHERE stock_barang.produk_id = p.id
AND (
  stock_barang.nama_produk IS NULL
  OR stock_barang.kode_produk IS NULL
  OR stock_barang.satuan IS NULL
);
