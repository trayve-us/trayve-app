-- Add is_promoted column to base_models table
-- This column indicates if a model is available on the free tier

-- Add the column (defaults to false)
ALTER TABLE base_models 
ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT false;

-- Update existing free tier models to be promoted
-- Free tier models: Chloe, Emma, Amara, Grace
UPDATE base_models 
SET is_promoted = true 
WHERE name IN ('Chloe', 'Emma', 'Amara', 'Grace');

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_base_models_is_promoted 
ON base_models(is_promoted);

-- Add comment to column for documentation
COMMENT ON COLUMN base_models.is_promoted IS 'Indicates if model is available on free tier (promoted models)';
