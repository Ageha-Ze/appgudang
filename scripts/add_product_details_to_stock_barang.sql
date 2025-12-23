-- Add product details columns to stock_barang table
-- This allows us to display stock data without querying master/produk table

ALTER TABLE stock_barang
ADD COLUMN IF NOT EXISTS nama_produk VARCHAR(255),
ADD COLUMN IF NOT EXISTS kode_produk VARCHAR(100),
ADD COLUMN IF NOT EXISTS satuan VARCHAR(50);

-- Add comment to table
COMMENT ON TABLE stock_barang IS 'Stock movement history with denormalized product details for faster queries';

-- Add comments to new columns
COMMENT ON COLUMN stock_barang.nama_produk IS 'Product name (denormalized from produk table)';
COMMENT ON COLUMN stock_barang.kode_produk IS 'Product code (denormalized from produk table)';
COMMENT ON COLUMN stock_barang.satuan IS 'Product unit (denormalized from produk table)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_barang_produk_id ON stock_barang(produk_id);
CREATE INDEX IF NOT EXISTS idx_stock_barang_cabang_id ON stock_barang(cabang_id);
CREATE INDEX IF NOT EXISTS idx_stock_barang_tanggal ON stock_barang(tanggal);

-- Optional: Populate existing records with product data (run this after adding columns)
-- UPDATE stock_barang
-- SET
--   nama_produk = p.nama_produk,
--   kode_produk = p.kode_produk,
--   satuan = p.satuan
-- FROM produk p
-- WHERE stock_barang.produk_id = p.id
-- AND (stock_barang.nama_produk IS NULL OR stock_barang.kode_produk IS NULL);
