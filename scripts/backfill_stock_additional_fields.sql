-- Backfill additional fields for existing stock_barang records

-- 1. Backfill persentase and harga_jual from produk table
UPDATE stock_barang
SET
  persentase = CASE
    WHEN p.hpp > 0 THEN ((p.harga - p.hpp) / p.hpp) * 100
    ELSE 0
  END,
  harga_jual = COALESCE(stock_barang.harga_jual, p.harga, 0)
FROM produk p
WHERE stock_barang.produk_id = p.id
AND (
  stock_barang.persentase IS NULL
  OR stock_barang.harga_jual IS NULL
);

-- 2. Backfill transaction IDs from detail_pembelian
UPDATE stock_barang
SET pembelian_id = dp.pembelian_id
FROM detail_pembelian dp
WHERE stock_barang.id = dp.id
AND stock_barang.pembelian_id IS NULL
AND stock_barang.tipe = 'masuk';

-- 3. Backfill transaction IDs from detail_penjualan
UPDATE stock_barang
SET penjualan_id = dp.penjualan_id
FROM detail_penjualan dp
WHERE stock_barang.id = dp.id
AND stock_barang.penjualan_id IS NULL
AND stock_barang.tipe = 'keluar';

-- 4. Backfill konsinyasi_id from detail_konsinyasi (if exists)
-- Note: Adjust table name based on your actual konsinyasi detail table
-- UPDATE stock_barang
-- SET konsinyasi_id = dk.konsinyasi_id
-- FROM detail_konsinyasi dk
-- WHERE stock_barang.id = dk.id
-- AND stock_barang.konsinyasi_id IS NULL;

-- 5. Backfill produksi_id from transaksi_produksi
UPDATE stock_barang
SET produksi_id = tp.id
FROM transaksi_produksi tp
WHERE stock_barang.id = tp.id  -- Adjust join condition based on your schema
AND stock_barang.produksi_id IS NULL;

-- 6. Backfill stock_opname_id from stock_opname
UPDATE stock_barang
SET stock_opname_id = so.id
FROM stock_opname so
WHERE stock_barang.id = so.id  -- Adjust join condition based on your schema
AND stock_barang.stock_opname_id IS NULL;

-- 7. Backfill unloading_id from gudang_unloading
UPDATE stock_barang
SET unloading_id = gu.id
FROM gudang_unloading gu
WHERE stock_barang.id = gu.id  -- Adjust join condition based on your schema
AND stock_barang.unloading_id IS NULL;
