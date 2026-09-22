-- Add barcode and brand fields to pantry_items table
ALTER TABLE pantry_items 
ADD COLUMN IF NOT EXISTS barcode text,
ADD COLUMN IF NOT EXISTS brand text;

-- Create index on barcode for faster lookups
CREATE INDEX IF NOT EXISTS idx_pantry_items_barcode ON pantry_items(barcode);