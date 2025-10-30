-- Add last_refill_at column to user_credits table
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS last_refill_at TIMESTAMP WITH TIME ZONE;

-- Update existing rows to set last_refill_at to created_at if NULL
UPDATE user_credits
SET last_refill_at = created_at
WHERE last_refill_at IS NULL;
