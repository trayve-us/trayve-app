/**
 * Shopify Session Storage using Supabase
 * Stores Shopify merchant sessions in the same database as main Trayve app
 */

import { supabaseAdmin } from '../storage/supabase.server';

export interface ShopifyStore {
  id: string;
  shop_domain: string;
  access_token: string;
  scope?: string;
  user_id?: string;
  is_active: boolean;
  installed_at: string;
  updated_at: string;
}

/**
 * Save or update Shopify store session
 */
export async function saveShopifyStore(data: {
  shop: string;
  accessToken: string;
  scope?: string;
  userId?: string;
}): Promise<ShopifyStore> {
  const { data: store, error } = await supabaseAdmin
    .from('shopify_stores')
    .upsert(
      {
        shop_domain: data.shop,
        access_token: data.accessToken,
        scope: data.scope,
        user_id: data.userId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'shop_domain',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving Shopify store:', error);
    throw error;
  }

  return store;
}

/**
 * Get Shopify store by domain
 */
export async function getShopifyStore(shop: string): Promise<ShopifyStore | null> {
  const { data: store, error } = await supabaseAdmin
    .from('shopify_stores')
    .select('*')
    .eq('shop_domain', shop)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error getting Shopify store:', error);
    throw error;
  }

  return store;
}

/**
 * Delete Shopify store (on app uninstall)
 */
export async function deleteShopifyStore(shop: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('shopify_stores')
    .update({ is_active: false })
    .eq('shop_domain', shop);

  if (error) {
    console.error('Error deleting Shopify store:', error);
    throw error;
  }
}

/**
 * Map Shopify product to Trayve project
 */
export async function mapProductToProject(data: {
  shop: string;
  productId: string;
  variantId?: string;
  projectId: string;
}) {
  const { error } = await supabaseAdmin
    .from('shopify_product_mappings')
    .insert({
      shop_domain: data.shop,
      shopify_product_id: parseInt(data.productId),
      shopify_variant_id: data.variantId ? parseInt(data.variantId) : null,
      project_id: data.projectId,
    });

  if (error) {
    console.error('Error mapping product to project:', error);
    throw error;
  }
}

/**
 * Get project ID for a Shopify product
 */
export async function getProjectForProduct(
  shop: string,
  productId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('shopify_product_mappings')
    .select('project_id')
    .eq('shop_domain', shop)
    .eq('shopify_product_id', parseInt(productId))
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting project for product:', error);
    throw error;
  }

  return data?.project_id || null;
}

/**
 * Track app usage for billing
 */
export async function trackUsage(data: {
  shop: string;
  userId?: string;
  actionType: string;
  creditsUsed?: number;
}) {
  const { error } = await supabaseAdmin
    .from('shopify_app_usage')
    .insert({
      shop_domain: data.shop,
      user_id: data.userId,
      action_type: data.actionType,
      credits_used: data.creditsUsed || 0,
    });

  if (error) {
    console.error('Error tracking usage:', error);
    // Don't throw - usage tracking shouldn't break the app
  }
}
