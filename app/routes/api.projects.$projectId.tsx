import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

/**
 * GET /api/projects/:projectId
 * Fetches project details
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📁 FETCH PROJECT DETAILS');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Authenticate Shopify request
    const { session } = await authenticate.admin(request);
    if (!session) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get Trayve user ID from Shopify shop
    const user = await getShopifyUserByShop(session.shop);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user_id = user.trayve_user_id;
    console.log(`👤 User ID: ${user_id}`);

    const { projectId } = params;
    if (!projectId) {
      console.log('❌ Missing projectId parameter');
      return json({ success: false, error: 'Project ID required' }, { status: 400 });
    }

    console.log(`📁 Project ID: ${projectId}`);

    // Fetch project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('user_generation_projects')
      .select('id, name, created_at, user_id, clothing_image_url')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.log('❌ Project not found:', projectError);
      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Verify ownership
    if (project.user_id !== user_id) {
      console.log('❌ Unauthorized access attempt');
      return json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    console.log('✅ Project found:', project.name);
    console.log('═══════════════════════════════════════════════════════');

    return json({ 
      success: true, 
      project: {
        id: project.id,
        name: project.name,
        created_at: project.created_at,
        clothing_image_url: project.clothing_image_url
      }
    });

  } catch (error: any) {
    console.error('❌ Error fetching project:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
