-- Shopify App Integration Tables
-- Add these tables to your existing Supabase database

-- Table to store Shopify store sessions
CREATE TABLE IF NOT EXISTS shopify_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scope TEXT,
    user_id UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to map Shopify products to Trayve projects
CREATE TABLE IF NOT EXISTS shopify_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    shopify_product_id BIGINT NOT NULL,
    shopify_variant_id BIGINT,
    project_id UUID REFERENCES user_generation_projects(id) ON DELETE SET NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_domain, shopify_product_id, project_id)
);

-- Table to track app usage/billing
CREATE TABLE IF NOT EXISTS shopify_app_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'generate', 'remove_bg', etc.
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shopify_stores_shop ON shopify_stores(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_user ON shopify_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_mappings_shop ON shopify_product_mappings(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_mappings_product ON shopify_product_mappings(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_shopify_mappings_project ON shopify_product_mappings(project_id);
CREATE INDEX IF NOT EXISTS idx_shopify_usage_shop ON shopify_app_usage(shop_domain);

-- Row Level Security (RLS)
ALTER TABLE shopify_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_app_usage ENABLE ROW LEVEL SECURITY;

-- Policies for shopify_stores
CREATE POLICY "Users can view their own store"
    ON shopify_stores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all stores"
    ON shopify_stores FOR ALL
    USING (auth.role() = 'service_role');

-- Policies for shopify_product_mappings
CREATE POLICY "Users can view their own mappings"
    ON shopify_product_mappings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM shopify_stores
            WHERE shopify_stores.shop_domain = shopify_product_mappings.shop_domain
            AND shopify_stores.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all mappings"
    ON shopify_product_mappings FOR ALL
    USING (auth.role() = 'service_role');

-- Policies for shopify_app_usage
CREATE POLICY "Users can view their own usage"
    ON shopify_app_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage"
    ON shopify_app_usage FOR ALL
    USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_shopify_stores_updated_at
    BEFORE UPDATE ON shopify_stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE shopify_stores IS 'Stores Shopify merchant shop data and access tokens';
COMMENT ON TABLE shopify_product_mappings IS 'Maps Shopify products to Trayve projects for tracking';
COMMENT ON TABLE shopify_app_usage IS 'Tracks app usage for billing and analytics';
