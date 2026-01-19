import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    if (!session) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const user = await getShopifyUserByShop(session.shop);
    if (!user) return json({ success: false, error: "User not found" }, { status: 404 });

    // Fetch all results for this user with their model ID
    // We query by user_id directly to capture all generations (Studio, Shop Ready, Post Ready)
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('generation_results')
      .select(`
        id,
        model_poses!inner (
          base_model_id
        )
      `)
      .eq('user_id', user.trayve_user_id);

    if (resultsError) {
      console.error("Error fetching result counts:", resultsError);
      return json({ success: false, error: resultsError.message }, { status: 500 });
    }

    // Aggregate counts
    const counts: Record<string, number> = {};
    results.forEach((r: any) => {
      const modelId = r.model_poses?.base_model_id;
      if (modelId) {
        counts[modelId] = (counts[modelId] || 0) + 1;
      }
    });

    return json({ success: true, counts });
  } catch (error) {
    console.error("Server error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
