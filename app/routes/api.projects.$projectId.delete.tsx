import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

/**
 * DELETE /api/projects/:projectId/delete
 * Deletes a project and all associated generation results
 */
export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('🗑️  DELETE PROJECT REQUEST');
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
    const { projectId } = params;

    if (!projectId) {
      console.log('❌ Missing projectId parameter');
      return json({ success: false, error: 'Project ID required' }, { status: 400 });
    }

    console.log(`👤 User ID: ${user_id}`);
    console.log(`📁 Project ID: ${projectId}`);

    // Verify project ownership
    const { data: project, error: projectError } = await supabaseAdmin
      .from('user_generation_projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.log('❌ Project not found:', projectError);
      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== user_id) {
      console.log('❌ Unauthorized access attempt');
      return json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    console.log('✅ Project ownership verified');

    // Delete generation_results first (child records)
    const { error: resultsDeleteError } = await supabaseAdmin
      .from('generation_results')
      .delete()
      .eq('project_id', projectId);

    if (resultsDeleteError) {
      console.log('❌ Error deleting generation results:', resultsDeleteError);
      return json({ success: false, error: 'Failed to delete generation results' }, { status: 500 });
    }

    console.log('✅ Deleted generation results');

    // Delete user_generations records
    const { error: generationsDeleteError } = await supabaseAdmin
      .from('user_generations')
      .delete()
      .eq('project_id', projectId);

    if (generationsDeleteError) {
      console.log('❌ Error deleting user generations:', generationsDeleteError);
      // Continue anyway, may not exist
    }

    // Delete pipeline_executions
    const { error: executionsDeleteError } = await supabaseAdmin
      .from('pipeline_executions')
      .delete()
      .eq('project_id', projectId);

    if (executionsDeleteError) {
      console.log('❌ Error deleting pipeline executions:', executionsDeleteError);
      // Continue anyway, may not exist
    }

    // Finally, delete the project itself
    const { error: projectDeleteError } = await supabaseAdmin
      .from('user_generation_projects')
      .delete()
      .eq('id', projectId);

    if (projectDeleteError) {
      console.log('❌ Error deleting project:', projectDeleteError);
      return json({ success: false, error: 'Failed to delete project' }, { status: 500 });
    }

    console.log('✅ Project deleted successfully');
    console.log('═══════════════════════════════════════════════════════');

    return json({ success: true, message: 'Project deleted successfully' });

  } catch (error: any) {
    console.error('❌ Error in delete project:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
