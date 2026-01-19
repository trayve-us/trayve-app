import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { supabaseAdmin } from "../lib/storage/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const user = await getShopifyUserByShop(shop);

  if (!user || !user.trayve_user_id) {
    return json({ success: false, stats: {} });
  }

  // Count generated images per base model for this user
  const { data, error } = await supabaseAdmin
    .from('generation_results')
    .select(`
      id,
      generation:generation_id (
        base_model_id
      )
    `)
    .eq('user_id', user.trayve_user_id) // Filter by user_id on generation_results
    // Note: If you have direct base_model_id on generation_results, use that.
    // If not, we have to trust the relationship.
    // However, Supabase select with nested join to group by might be tricky in one go if we want to process in SQL.
    // Standard Supabase pattern: fetch data and process in JS, or use a RPC.
    
    // Let's try to query user_generations first, as it's the parent.
    // But we need the count of Results (images).
    
    // Alternative:
    // .select('generation_id, generation:generation_id(base_model_id)')
    // Then group by base_model_id in code.
    
  if (error) {
    console.error("Error fetching stats:", error);
    return json({ success: false, stats: {} });
  }

  // Since we select nested data, 'data' will be an array of result objects.
  // Each result has generation -> base_model_id.
  
  const stats: Record<string, number> = {};
  
  // Note: user_id is on generation_results.
  // We need to ensure we only count valid results.
  
  if (data) {
     data.forEach((result: any) => {
        const baseModelId = result.generation?.base_model_id;
        if (baseModelId) {
             stats[baseModelId] = (stats[baseModelId] || 0) + 1;
        }
     });
  }

  return json({ success: true, stats });
};
