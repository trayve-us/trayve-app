import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

/**
 * POST /api/projects/:projectId/update-name
 * Updates a project's name
 */
export async function action({ request, params }: ActionFunctionArgs) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📝 UPDATE PROJECT NAME');
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

    // Parse request body
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.log('❌ Invalid project name');
      return json({ success: false, error: 'Valid project name required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    console.log(`📁 Project ID: ${projectId}`);
    console.log(`📝 New Name: ${trimmedName}`);

    // Verify project ownership and update
    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('user_generation_projects')
      .update({ name: trimmedName })
      .eq('id', projectId)
      .eq('user_id', user_id)
      .select('id, name, created_at')
      .single();

    if (updateError || !updatedProject) {
      console.log('❌ Failed to update project:', updateError);
      
      // Check if project exists but belongs to different user
      const { data: existingProject } = await supabaseAdmin
        .from('user_generation_projects')
        .select('user_id')
        .eq('id', projectId)
        .single();

      if (existingProject && existingProject.user_id !== user_id) {
        return json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    console.log('✅ Project name updated successfully');
    console.log('═══════════════════════════════════════════════════════');

    return json({ 
      success: true, 
      project: updatedProject
    });

  } catch (error: any) {
    console.error('❌ Error updating project name:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
