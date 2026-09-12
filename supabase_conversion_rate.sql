-- Migration: Add conversion_rate column to items table for BDT asset calculation of USD items
ALTER TABLE items ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC DEFAULT NULL;
COMMENT ON COLUMN items.conversion_rate IS 'Exchange/conversion rate in BDT for items priced in USD';
