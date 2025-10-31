/**
 * Authentication Service for Shopify App
 * Maps Shopify shops to Trayve user IDs
 */

import { supabaseAdmin } from "../storage/supabase.server";
import crypto from "crypto";

export interface ShopifyUser {
  id: string;
  shop_domain: string;
  trayve_user_id: string;
  shop_id?: string;
  shop_name?: string;
  shop_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a unique Trayve user ID for Shopify shops
 * Format: shopify_{hash} to distinguish from Clerk user IDs
 */
function generateShopifyUserId(shopDomain: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(shopDomain)
    .digest("hex")
    .substring(0, 16);
  return `shopify_${hash}`;
}

/**
 * Get or create a Trayve user for a Shopify shop
 * This is called after Shopify authentication
 */
export async function getOrCreateShopifyUser(
  shopDomain: string,
  shopData?: {
    shopId?: string;
    shopName?: string;
    shopEmail?: string;
  }
): Promise<{ user: ShopifyUser; isNewUser: boolean }> {
  try {
    // Check if shop already exists in mapping table
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("shopify_users")
      .select("*")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Failed to fetch shopify user: ${fetchError.message}`);
    }

    if (existingUser) {
      // Update last activity
      await supabaseAdmin
        .from("shopify_users")
        .update({ updated_at: new Date().toISOString() })
        .eq("shop_domain", shopDomain);

      return { user: existingUser, isNewUser: false };
    }

    // Create new user
    const trayveUserId = generateShopifyUserId(shopDomain);

    // Insert into shopify_users mapping table
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("shopify_users")
      .insert({
        shop_domain: shopDomain,
        trayve_user_id: trayveUserId,
        shop_id: shopData?.shopId || null,
        shop_name: shopData?.shopName || null,
        shop_email: shopData?.shopEmail || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create shopify user: ${insertError.message}`);
    }

    // Create user_credits record with 2000 initial credits
    await createInitialCredits(trayveUserId);

    console.log(`✅ Created new Shopify user for shop: ${shopDomain}`);
    return { user: newUser, isNewUser: true };
  } catch (error) {
    console.error("Error in getOrCreateShopifyUser:", error);
    throw error;
  }
}

/**
 * Create initial credits for a new Shopify user (2000 credits)
 */
async function createInitialCredits(userId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("user_credits").insert({
      user_id: userId,
      total_credits: 2000,
      used_credits: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // Check if credits already exist (unique constraint violation)
      if (error.code === "23505") {
        console.log(`ℹ️ Credits already exist for user: ${userId}`);
        return;
      }
      throw new Error(`Failed to create initial credits: ${error.message}`);
    }

    // Create transaction log
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      transaction_type: "credit",
      amount: 2000,
      description: "Welcome bonus - Initial credits",
      feature_type: "welcome_bonus",
      created_at: new Date().toISOString(),
    });

    console.log(`✅ Created 2000 initial credits for user: ${userId}`);
  } catch (error) {
    console.error("Error creating initial credits:", error);
    // Don't throw - user can still use app without credits initially
  }
}

/**
 * Get Shopify user by shop domain
 */
export async function getShopifyUserByShop(
  shopDomain: string
): Promise<ShopifyUser | null> {
  const { data, error } = await supabaseAdmin
    .from("shopify_users")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching shopify user:", error);
    return null;
  }

  return data;
}

/**
 * Get Shopify user by Trayve user ID
 */
export async function getShopifyUserById(
  userId: string
): Promise<ShopifyUser | null> {
  const { data, error } = await supabaseAdmin
    .from("shopify_users")
    .select("*")
    .eq("trayve_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching shopify user by ID:", error);
    return null;
  }

  return data;
}

/**
 * Deactivate a Shopify user (on app uninstall)
 */
export async function deactivateShopifyUser(
  shopDomain: string
): Promise<void> {
  await supabaseAdmin
    .from("shopify_users")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("shop_domain", shopDomain);

  console.log(`✅ Deactivated Shopify user: ${shopDomain}`);
}

/**
 * Update Shopify user metadata (for subscription information, etc.)
 */
export async function updateShopifyUserMetadata(
  userId: string,
  metadata: Record<string, any>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("shopify_users")
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update user metadata: ${error.message}`);
  }

  console.log(`✅ Updated metadata for user: ${userId}`);
}
