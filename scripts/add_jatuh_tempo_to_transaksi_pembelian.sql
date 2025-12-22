-- Add jatuh_tempo column to transaksi_pembelian table
-- This allows storing due dates directly in the purchase transaction table

ALTER TABLE transaksi_pembelian
ADD COLUMN jatuh_tempo DATE;

-- Optional: Add comment to document the column
COMMENT ON COLUMN transaksi_pembelian.jatuh_tempo IS 'Tanggal jatuh tempo pembayaran untuk transaksi transfer';

-- Optional: Create an index for better query performance
CREATE INDEX idx_transaksi_pembelian_jatuh_tempo ON transaksi_pembelian(jatuh_tempo);

-- Optional: Add a check constraint to ensure jatuh_tempo is only set for transfer payments
-- (This is optional and depends on your business logic)
-- ALTER TABLE transaksi_pembelian
-- ADD CONSTRAINT check_jatuh_tempo_transfer_only
-- CHECK (
--   (jenis_pembayaran = 'transfer' AND jatuh_tempo IS NOT NULL) OR
--   (jenis_pembayaran = 'cash' AND jatuh_tempo IS NULL)
-- );
