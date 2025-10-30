-- Create table to temporarily store charge_id to shop mapping
-- This is needed because Shopify doesn't include shop parameter in the callback
CREATE TABLE IF NOT EXISTS pending_charges (
  charge_id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Auto-delete old records after 1 hour
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_charges_shop ON pending_charges(shop);
CREATE INDEX IF NOT EXISTS idx_pending_charges_expires ON pending_charges(expires_at);

-- Add comment
COMMENT ON TABLE pending_charges IS 'Temporary storage for charge_id to shop mapping during subscription creation flow';
