import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

/**
 * GET /api/projects/:projectId/results
 * Fetches all generation results for a project
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 FETCH PROJECT RESULTS');
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

    // Determine project mode by checking pipeline executions
    const { data: executions } = await supabaseAdmin
      .from('pipeline_executions')
      .select('config')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1);

    const config = executions?.[0]?.config as any;
    const rawMode = config?.mode;
    let isStudioMode = rawMode === 'product_shots' || rawMode === 'social_media';

    // Fetch all generation results based on mode
    let results: any[] = [];
    let resultsError = null;

    if (isStudioMode) {
      // Fetch from studio_generations
      const { data: studioData, error: studioError } = await supabaseAdmin
        .from('studio_generations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (studioError) {
        resultsError = studioError;
      } else {
        // Normalize Studio Data to match structure needed for formatting
        results = (studioData || []).map(item => ({
          id: item.id,
          pose_id: 0, // Placeholder
          pose_name: item.pose_identifier,
          result_image_url: item.result_image_url,
          created_at: item.created_at || item.updated_at,
          generation_metadata: item.metadata,
          removed_bg_url: null, // Studio currently doesn't have separate BG removal column
          generation_tier: 'free' // Default or fetch if needed
        }));
      }
    } else {
      // Fetch from generation_results (VTO)
      const { data: vtoData, error: vtoError } = await supabaseAdmin
        .from('generation_results')
        .select(`
        id,
        pose_id,
        pose_name,
        result_image_url,
        supabase_path,
        generation_tier,
        generation_metadata,
        removed_bg_url,
        created_at,
        poses:pose_id (
          id,
          name,
          supabase_path
        )
      `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      results = vtoData || [];
      resultsError = vtoError;
    }

    if (resultsError) {
      console.log('❌ Error fetching results:', resultsError);
      return json({ success: false, error: 'Failed to fetch results' }, { status: 500 });
    }

    console.log(`✅ Found ${results?.length || 0} generation results`);

    // Transform results to match expected format
    const formattedResults = results.map((result: any) => {
      const metadata = result.generation_metadata || {};
      const tier = result.generation_tier || 'free';

      // Define which features are available for each tier
      const tierFeatures = {
        free: { crystalUpscale: false },
        creator: { crystalUpscale: false },
        professional: { crystalUpscale: true },
        enterprise: { crystalUpscale: true },
      };

      const features = tierFeatures[tier as keyof typeof tierFeatures] || tierFeatures.free;

      const formattedImage = {
        id: result.id,
        // Standard Result (Try-On)
        image_url: metadata.tryon_url || result.result_image_url || '',

        // Crystal Upscale (Pro/Enterprise only)
        upscaled_image_url: features.crystalUpscale && metadata.upscaled_image_url ? metadata.upscaled_image_url : undefined,
        upscale_status: features.crystalUpscale ? (metadata.upscale_status || 'pending') : 'not_available',

        // Background removal
        generation_record: {
          removed_bg_url: result.removed_bg_url || ''
        },
        created_at: result.created_at
      };

      return {
        pose_id: result.pose_id,
        pose_name: result.pose_name || result.poses?.name || 'Unknown Pose',
        images: [formattedImage]
      };
    });

    console.log('───────────────────────────────────────────────────────');
    console.log('📸 Results Summary:');
    formattedResults.forEach((result, idx) => {
      console.log(`  Pose ${idx + 1}: ${result.pose_name}`);
      console.log(`    Images: ${result.images.length}`);
    });
    console.log('═══════════════════════════════════════════════════════');

    return json({
      success: true,
      results: formattedResults,
      total: formattedResults.length
    });

  } catch (error: any) {
    console.error('❌ Error in fetch results:', error);
    return json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
