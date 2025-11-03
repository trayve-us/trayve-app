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

    // Fetch all generation results with images
    const { data: results, error: resultsError } = await supabaseAdmin
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

    if (resultsError) {
      console.log('❌ Error fetching results:', resultsError);
      return json({ success: false, error: 'Failed to fetch results' }, { status: 500 });
    }

    console.log(`✅ Found ${results?.length || 0} generation results`);

    // Transform results to match expected format
    // Each generation_result represents one pose with one image
    // The metadata contains processing status for different enhancement steps
    const formattedResults = results.map((result: any) => {
      const metadata = result.generation_metadata || {};
      const tier = result.generation_tier || 'free';
      
      // Debug: Log ACTUAL database values (full JSON)
      console.log(`🔍 Debug Result ${result.id}:`);
      console.log(`   - RAW generation_metadata:`, JSON.stringify(metadata, null, 2));
      console.log(`   - result_image_url: ${result.result_image_url ? 'EXISTS' : 'NULL'}`);
      console.log(`   - removed_bg_url: ${result.removed_bg_url ? 'EXISTS ✂️' : 'NULL'}`);
      console.log(`   - metadata.basic_upscale_url: ${metadata.basic_upscale_url ? 'EXISTS' : 'NULL'}`);
      console.log(`   - metadata.basic_upscale_status: ${metadata.basic_upscale_status || 'NULL'}`);
      console.log(`   - metadata.upscaled_image_url: ${metadata.upscaled_image_url ? 'EXISTS' : 'NULL'}`);
      console.log(`   - metadata.upscale_status: ${metadata.upscale_status || 'NULL'}`);
      console.log(`   - metadata.face_swap_image_url: ${metadata.face_swap_image_url ? 'EXISTS' : 'NULL'}`);
      console.log(`   - metadata.face_swap_status: ${metadata.face_swap_status || 'NULL'}`);
      console.log(`   - metadata.status: ${metadata.status || 'NULL'}`);
      console.log(`   - generation_tier: ${tier}`);
      
      // Define which features are available for each tier
      // Free/Creator: Try-On → 2K Upscale
      // Professional/Enterprise: Try-On → 2K Upscale → 4K Upscale → Face Swap
      const tierFeatures = {
        free: { basicUpscale: true, enhancedUpscale: false, faceSwap: false },
        creator: { basicUpscale: true, enhancedUpscale: false, faceSwap: false },
        professional: { basicUpscale: true, enhancedUpscale: true, faceSwap: true },
        enterprise: { basicUpscale: true, enhancedUpscale: true, faceSwap: true },
      };
      
      const features = tierFeatures[tier as keyof typeof tierFeatures] || tierFeatures.free;
      
      const formattedImage = {
        id: result.id,
        // For Pro/Enterprise: Try-On URL is the base, for Free/Creator: result_image_url
        image_url: metadata.tryon_url || result.result_image_url || '',
        // Only show basic upscale for tiers that have it enabled
        basic_upscale_url: features.basicUpscale && metadata.basic_upscale_url ? metadata.basic_upscale_url : undefined,
        basic_upscale_status: features.basicUpscale ? (metadata.basic_upscale_status || 'pending') : 'not_available',
        // Only show enhanced upscale for professional/enterprise
        upscaled_image_url: features.enhancedUpscale && metadata.upscaled_image_url ? metadata.upscaled_image_url : undefined,
        upscale_status: features.enhancedUpscale ? (metadata.upscale_status || 'pending') : 'not_available',
        // Only show face swap for professional/enterprise
        face_swap_image_url: features.faceSwap && metadata.face_swap_image_url ? metadata.face_swap_image_url : undefined,
        face_swap_status: features.faceSwap ? (metadata.face_swap_status || 'pending') : 'not_available',
        // Background removal (from dedicated column, not metadata)
        generation_record: {
          removed_bg_url: result.removed_bg_url || ''
        },
        created_at: result.created_at
      };
      
      // Debug: Log what we're sending to frontend
      console.log(`📤 Sending to frontend for result ${result.id}:`);
      console.log(`   - basic_upscale_url: ${formattedImage.basic_upscale_url ? 'SET' : 'EMPTY'}`);
      console.log(`   - basic_upscale_status: ${formattedImage.basic_upscale_status}`);
      console.log(`   - upscaled_image_url: ${formattedImage.upscaled_image_url ? 'SET' : 'EMPTY'}`);
      console.log(`   - upscale_status: ${formattedImage.upscale_status}`);
      console.log(`   - face_swap_image_url: ${formattedImage.face_swap_image_url ? 'SET' : 'EMPTY'}`);
      console.log(`   - face_swap_status: ${formattedImage.face_swap_status}`);
      console.log(`   - removed_bg_url: ${formattedImage.generation_record.removed_bg_url ? 'SET ✂️' : 'EMPTY'}`);
      if (formattedImage.upscaled_image_url) {
        console.log(`   - ACTUAL upscaled_image_url: ${formattedImage.upscaled_image_url.substring(0, 100)}...`);
      }
      if (formattedImage.face_swap_image_url) {
        console.log(`   - ACTUAL face_swap_image_url: ${formattedImage.face_swap_image_url.substring(0, 100)}...`);
      }
      if (formattedImage.generation_record.removed_bg_url) {
        console.log(`   - ACTUAL removed_bg_url: ${formattedImage.generation_record.removed_bg_url.substring(0, 100)}...`);
      }
      
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
      result.images.forEach((img: any, imgIdx: number) => {
        console.log(`    Image ${imgIdx + 1}:`);
        console.log(`      - Base: ${img.image_url ? '✅' : '❌'}`);
        // Only log features that are available for this tier
        if (img.basic_upscale_status !== 'not_available') {
          console.log(`      - 2K Upscale: ${img.basic_upscale_status || 'N/A'}`);
        }
        if (img.upscale_status !== 'not_available') {
          console.log(`      - 4K Upscale: ${img.upscale_status || 'N/A'}`);
        }
        if (img.face_swap_status !== 'not_available') {
          console.log(`      - Face Swap: ${img.face_swap_status || 'N/A'}`);
        }
      });
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
