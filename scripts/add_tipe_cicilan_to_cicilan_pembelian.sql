-- Add tipe_cicilan column to cicilan_pembelian table
-- This allows categorizing different types of payments

ALTER TABLE cicilan_pembelian
ADD COLUMN tipe_cicilan VARCHAR(50);

-- Optional: Add comment to document the column
COMMENT ON COLUMN cicilan_pembelian.tipe_cicilan IS 'Type of payment: cicilan, uang_muka, pelunasan, etc.';

-- Optional: Add check constraint to limit valid values
-- ALTER TABLE cicilan_pembelian
-- ADD CONSTRAINT check_tipe_cicilan_valid
-- CHECK (tipe_cicilan IN ('cicilan', 'uang_muka', 'pelunasan', 'cash', 'transfer'));

-- Optional: Create an index for better query performance
CREATE INDEX idx_cicilan_pembelian_tipe_cicilan ON cicilan_pembelian(tipe_cicilan);

-- Optional: Set default value for existing records
UPDATE cicilan_pembelian
SET tipe_cicilan = 'cicilan'
WHERE tipe_cicilan IS NULL;
