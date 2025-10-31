-- Update subscription tier constraint to use 'creator' instead of 'starter'
-- This migration updates the check constraint on pipeline_executions table

-- Drop the old constraint if it exists
ALTER TABLE pipeline_executions 
DROP CONSTRAINT IF EXISTS pipeline_executions_subscription_tier_check;

-- Add the new constraint with 'creator' instead of 'starter'
ALTER TABLE pipeline_executions
ADD CONSTRAINT pipeline_executions_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'creator', 'professional', 'enterprise'));

-- Update any existing 'starter' records to 'creator' (if any exist)
UPDATE pipeline_executions 
SET subscription_tier = 'creator' 
WHERE subscription_tier = 'starter';

-- Also update the shopify_user_subscriptions table constraint if it exists
ALTER TABLE shopify_user_subscriptions 
DROP CONSTRAINT IF EXISTS shopify_user_subscriptions_plan_tier_check;

ALTER TABLE shopify_user_subscriptions
ADD CONSTRAINT shopify_user_subscriptions_plan_tier_check 
CHECK (plan_tier IN ('free', 'creator', 'professional', 'enterprise'));

-- Update any existing 'starter' records to 'creator' in subscriptions table
UPDATE shopify_user_subscriptions 
SET plan_tier = 'creator' 
WHERE plan_tier = 'starter';
