import { supabaseAdmin } from "./supabase.server";

/**
 * Store charge_id to shop mapping in Supabase
 * This is needed because Shopify doesn't include shop parameter in billing callback
 */
export async function storePendingCharge(chargeId: string, shop: string) {
  const supabase = supabaseAdmin;
  
  const { error } = await supabase
    .from('pending_charges')
    .insert({
      charge_id: chargeId,
      shop: shop,
    });

  if (error) {
    console.error('Error storing pending charge:', error);
    throw error;
  }

  console.log(`💾 Stored pending charge: ${chargeId} -> ${shop}`);
}

/**
 * Retrieve shop from charge_id
 */
export async function getPendingChargeShop(chargeId: string): Promise<string | null> {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('pending_charges')
    .select('shop')
    .eq('charge_id', chargeId)
    .single();

  if (error) {
    console.error('Error retrieving pending charge:', error);
    return null;
  }

  return data?.shop || null;
}

/**
 * Delete pending charge after successful processing
 */
export async function deletePendingCharge(chargeId: string) {
  const supabase = supabaseAdmin;
  
  const { error } = await supabase
    .from('pending_charges')
    .delete()
    .eq('charge_id', chargeId);

  if (error) {
    console.error('Error deleting pending charge:', error);
  }
}

/**
 * Clean up expired pending charges (older than 1 hour)
 */
export async function cleanupExpiredCharges() {
  const supabase = supabaseAdmin;
  
  const { error } = await supabase
    .from('pending_charges')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error cleaning up expired charges:', error);
  }
}
