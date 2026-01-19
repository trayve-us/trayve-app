import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    if (!session) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const user = await getShopifyUserByShop(session.shop);
    if (!user) return json({ success: false, error: "User not found" }, { status: 404 });

    const { modelId } = params;
    if (!modelId) return json({ success: false, error: "Model ID required" }, { status: 400 });

    // 1. Get all projects usage for this user
    const { data: projects, error: projectError } = await supabaseAdmin
      .from('user_generation_projects')
      .select('id')
      .eq('user_id', user.trayve_user_id);

    if (projectError || !projects) {
      return json({ success: false, error: "Failed to fetch projects" }, { status: 500 });
    }

    const projectIds = projects.map(p => p.id);

    if (projectIds.length === 0) {
      return json({ success: true, results: [] });
    }

    // 2. Fetch results filtered by base_model_id via model_poses relation
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('generation_results')
      .select(`
        id,
        project_id,
        pose_id,
        result_image_url,
        created_at,
        model_poses!inner (
          base_model_id,
          name
        )
      `)
      .in('project_id', projectIds)
      .eq('model_poses.base_model_id', modelId)
      .order('created_at', { ascending: false });

    if (resultsError) {
      console.error("Error fetching model results:", resultsError);
      return json({ success: false, error: resultsError.message }, { status: 500 });
    }

    return json({ success: true, results });
  } catch (error) {
    console.error("Server error:", error);
    return json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

