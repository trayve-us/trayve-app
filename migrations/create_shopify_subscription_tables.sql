-- =============================================
-- Shopify Subscription System Tables
-- =============================================

-- Table: shopify_subscription_plans
-- Stores available subscription plan tiers and their features
CREATE TABLE IF NOT EXISTS shopify_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_tier TEXT UNIQUE NOT NULL CHECK (plan_tier IN ('free', 'creator', 'professional', 'enterprise')),
  plan_name TEXT NOT NULL,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  images_per_month INTEGER NOT NULL DEFAULT 0,
  shopify_plan_id TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: shopify_user_subscriptions
-- Tracks individual user subscriptions and their status
CREATE TABLE IF NOT EXISTS shopify_user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trayve_user_id TEXT NOT NULL,
  shop TEXT NOT NULL,
  plan_tier TEXT NOT NULL REFERENCES shopify_subscription_plans(plan_tier),
  shopify_charge_id TEXT UNIQUE,
  shopify_confirmation_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
  images_allocated INTEGER DEFAULT 0,
  credits_allocated INTEGER DEFAULT 0,
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON shopify_user_subscriptions(trayve_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop ON shopify_user_subscriptions(shop);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON shopify_user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_charge_id ON shopify_user_subscriptions(shopify_charge_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON shopify_user_subscriptions(plan_tier);

-- =============================================
-- Trigger Functions
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shopify_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to allocate credits when subscription becomes active
CREATE OR REPLACE FUNCTION allocate_subscription_credits()
RETURNS TRIGGER AS $$
DECLARE
  plan_images INTEGER;
BEGIN
  -- Only proceed if status changed to 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Get the number of images for this plan
    SELECT images_per_month INTO plan_images
    FROM shopify_subscription_plans
    WHERE plan_tier = NEW.plan_tier;
    
    -- Update the subscription record with allocated images
    NEW.images_allocated = plan_images;
    NEW.credits_allocated = plan_images;
    
    -- Add images to user's credit balance
    -- Note: available_credits is a GENERATED column, so we only set total_credits and used_credits
    INSERT INTO user_credits (
      user_id,
      total_credits,
      used_credits,
      last_refill_at
    ) VALUES (
      NEW.trayve_user_id,
      plan_images,
      0,  -- Start with 0 used credits
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_credits = user_credits.total_credits + plan_images,
      last_refill_at = NOW();
      -- available_credits will be automatically calculated as (total_credits - used_credits)
    
    -- Set subscription timestamps
    NEW.subscribed_at = COALESCE(NEW.subscribed_at, NOW());
    NEW.billing_period_start = COALESCE(NEW.billing_period_start, NOW());
    NEW.billing_period_end = COALESCE(NEW.billing_period_end, NOW() + INTERVAL '30 days');
    NEW.expires_at = COALESCE(NEW.expires_at, NOW() + INTERVAL '30 days');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Triggers
-- =============================================

-- Trigger to update updated_at on subscription plans
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON shopify_subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON shopify_subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_shopify_subscription_updated_at();

-- Trigger to update updated_at on user subscriptions
DROP TRIGGER IF EXISTS update_shopify_user_subscriptions_updated_at ON shopify_user_subscriptions;
CREATE TRIGGER update_shopify_user_subscriptions_updated_at
  BEFORE UPDATE ON shopify_user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_shopify_subscription_updated_at();

-- Trigger to allocate credits when subscription becomes active
DROP TRIGGER IF EXISTS trigger_allocate_subscription_credits ON shopify_user_subscriptions;
CREATE TRIGGER trigger_allocate_subscription_credits
  BEFORE INSERT OR UPDATE ON shopify_user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION allocate_subscription_credits();

-- =============================================
-- Seed Data: Subscription Plans
-- =============================================

-- Insert default subscription plans
INSERT INTO shopify_subscription_plans (plan_tier, plan_name, price_monthly, images_per_month, features, is_active)
VALUES 
  ('free', 'Free Plan', 0.00, 10, 
   '["10 images per month", "Basic support", "Standard quality"]'::jsonb, 
   true),
  ('creator', 'Creator Plan', 19.99, 100, 
   '["100 images per month", "Priority support", "High quality", "Background removal"]'::jsonb, 
   true),
  ('professional', 'Professional Plan', 49.99, 500, 
   '["500 images per month", "Premium support", "Ultra quality", "Background removal", "Bulk processing"]'::jsonb, 
   true),
  ('enterprise', 'Enterprise Plan', 199.99, 5000, 
   '["5000 images per month", "Dedicated support", "Ultra quality", "Background removal", "Bulk processing", "API access", "Custom models"]'::jsonb, 
   true)
ON CONFLICT (plan_tier) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_monthly = EXCLUDED.price_monthly,
  images_per_month = EXCLUDED.images_per_month,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE shopify_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active subscription plans
DROP POLICY IF EXISTS "Anyone can view active plans" ON shopify_subscription_plans;
CREATE POLICY "Anyone can view active plans"
  ON shopify_subscription_plans FOR SELECT
  USING (is_active = true);

-- Policy: Service role can manage all plans
DROP POLICY IF EXISTS "Service role can manage plans" ON shopify_subscription_plans;
CREATE POLICY "Service role can manage plans"
  ON shopify_subscription_plans FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Users can view their own subscriptions
DROP POLICY IF EXISTS "Users can view their subscriptions" ON shopify_user_subscriptions;
CREATE POLICY "Users can view their subscriptions"
  ON shopify_user_subscriptions FOR SELECT
  USING (trayve_user_id = auth.uid()::text);

-- Policy: Service role can manage all subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON shopify_user_subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON shopify_user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE shopify_subscription_plans IS 'Available subscription plan tiers with pricing and features';
COMMENT ON TABLE shopify_user_subscriptions IS 'User subscription records tracking status and credits';
COMMENT ON COLUMN shopify_user_subscriptions.status IS 'pending: awaiting payment | active: currently active | cancelled: user cancelled | expired: subscription ended';
COMMENT ON COLUMN shopify_user_subscriptions.images_allocated IS 'Number of images allocated for this subscription period';
COMMENT ON COLUMN shopify_user_subscriptions.shopify_charge_id IS 'Shopify charge/subscription ID (e.g., gid://shopify/AppSubscription/123)';
