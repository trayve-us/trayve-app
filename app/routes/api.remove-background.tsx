import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";
import { uploadToShopifyGenerationsBucket, downloadImageAsBuffer } from "~/lib/services/storage.service";
import Replicate from "replicate";

/**
 * POST /api/remove-background
 * Removes background from an image
 * 
 * Cost: 500 credits
 * 
 * Image Selection by Tier:
 * - Free/Creator: Uses 2K image (basic_upscale_url or result_image_url)
 * - Professional/Enterprise: Uses 4K image (face_swap_image_url > upscaled_image_url > basic_upscale_url > result_image_url)
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('✂️ BACKGROUND REMOVAL REQUEST');
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
    const body = await request.json();
    const { imageId } = body;

    if (!imageId) {
      return json({ success: false, error: 'Image ID required' }, { status: 400 });
    }

    console.log(`👤 User ID: ${user_id}`);
    console.log(`🖼️ Image ID: ${imageId}`);

    // Get user's subscription tier from metadata
    const { data: shopifyUser, error: shopifyUserError } = await supabaseAdmin
      .from('shopify_users')
      .select('metadata')
      .eq('trayve_user_id', user_id)
      .single();

    if (shopifyUserError || !shopifyUser) {
      console.log('❌ Error fetching user tier:', shopifyUserError);
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const metadata_user = shopifyUser.metadata as any;
    const userTier = metadata_user?.subscriptionTier || 'free';
    const isProfessionalOrEnterprise = userTier === 'professional' || userTier === 'enterprise';

    console.log(`🎯 User Tier: ${userTier}`);

    // Tier restriction: Only Creator, Professional, and Enterprise can remove background
    if (!['creator', 'professional', 'enterprise'].includes(userTier)) {
      console.log('❌ Free tier users cannot remove background');
      return json({ 
        success: false, 
        error: 'Background removal is only available for Creator, Professional, and Enterprise plans' 
      }, { status: 403 });
    }

    // Check credits balance (total_credits - used_credits)
    const { data: creditsData, error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .select('total_credits, used_credits, total_consumed')
      .eq('user_id', user_id)
      .single();

    if (creditsError || !creditsData) {
      console.log('❌ Error fetching credits:', creditsError);
      return json({ success: false, error: 'Credits not found' }, { status: 404 });
    }

    const currentBalance = (creditsData.total_credits || 0) - (creditsData.used_credits || 0);

    if (currentBalance < 500) {
      console.log('❌ Insufficient credits:', currentBalance);
      return json({ 
        success: false, 
        error: 'Insufficient credits',
        required: 500,
        available: currentBalance
      }, { status: 400 });
    }

    console.log(`💳 Current balance: ${currentBalance} credits`);

    console.log('🔄 Processing background removal...');

    // Fetch generation result record with all image URLs
    const { data: imageRecord, error: imageError } = await supabaseAdmin
      .from('generation_results')
      .select('id, result_image_url, basic_upscale_url, upscaled_image_url, face_swap_image_url, generation_metadata, removed_bg_url, project_id')
      .eq('id', imageId)
      .single();

    if (imageError || !imageRecord) {
      console.log('❌ Image not found:', imageError);
      return json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    // Check if already removed
    if (imageRecord.removed_bg_url) {
      console.log('ℹ️ Background already removed');
      return json({ 
        success: true, 
        removed_bg_url: imageRecord.removed_bg_url,
        message: 'Background already removed'
      });
    }

    // Pipeline completion check for Professional/Enterprise
    const metadata = imageRecord.generation_metadata || {};
    if (isProfessionalOrEnterprise && metadata.face_swap_status !== 'completed') {
      console.log('❌ Face swap not completed for Professional/Enterprise tier');
      console.log(`📊 Current face_swap_status: ${metadata.face_swap_status || 'undefined'}`);
      return json({ 
        success: false, 
        error: 'Please wait for face swap processing to complete before removing background' 
      }, { status: 400 });
    }
    let sourceUrl: string;
    
    if (isProfessionalOrEnterprise) {
      // Professional/Enterprise: Use 4K image (face_swap > upscaled_image > basic_upscale > original)
      sourceUrl = imageRecord.face_swap_image_url || 
                  imageRecord.upscaled_image_url || 
                  imageRecord.basic_upscale_url || 
                  imageRecord.result_image_url;
      console.log('📸 Using 4K image for Professional/Enterprise tier');
    } else {
      // Free/Creator: Use 2K image (basic_upscale > original)
      sourceUrl = imageRecord.basic_upscale_url || 
                  imageRecord.result_image_url;
      console.log('📸 Using 2K image for Free/Creator tier');
    }

    console.log(`📍 Source URL: ${sourceUrl}`);
    
    // Call Replicate Background Removal API (BiRefNet)
    console.log('🔄 Calling BiRefNet background removal API...');
    
    let removedBgUrl: string;
    
    try {
      const startTime = Date.now();
      
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });

      const output = await replicate.run(
        "men1scus/birefnet:f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7",
        {
          input: {
            image: sourceUrl
          }
        }
      );

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Background removal completed in ${totalTime}s`);
      
      // Extract image URL from result - Replicate returns output as string
      removedBgUrl = typeof output === 'string' ? output : String(output);
      
      if (!removedBgUrl) {
        console.error('❌ No image URL in Replicate response');
        throw new Error('No background-removed image generated by Replicate BiRefNet');
      }

      console.log('✅ Background removal complete:', removedBgUrl);
      
    } catch (error: any) {
      console.error('❌ Background removal API failed:', error);
      return json({ 
        success: false, 
        error: 'Background removal failed: ' + error.message 
      }, { status: 500 });
    }

    // Upload the background-removed image to Supabase Storage
    console.log('📤 Uploading BG-removed image to Supabase...');
    
    let permanentBgRemovedUrl: string;
    
    try {
      // Download the image from Replicate
      const imageBuffer = await downloadImageAsBuffer(removedBgUrl);
      
      // Generate filename with proper path
      const timestamp = Date.now();
      const filename = `${user_id}/removed-backgrounds/removed-bg-${imageId}-${timestamp}.png`;
      
      // Upload to Supabase
      const uploadResult = await uploadToShopifyGenerationsBucket(
        imageBuffer,
        filename,
        'image/png'
      );
      
      if (!uploadResult.url) {
        throw new Error('Failed to upload to Supabase');
      }
      
      permanentBgRemovedUrl = uploadResult.url;
      console.log('✅ Uploaded to Supabase:', permanentBgRemovedUrl);
      
    } catch (error: any) {
      console.error('❌ Supabase upload failed:', error);
      return json({ 
        success: false, 
        error: 'Failed to upload image: ' + error.message 
      }, { status: 500 });
    }

    // Update generation_results with removed background URL and timestamp
    const { error: updateError } = await supabaseAdmin
      .from('generation_results')
      .update({ 
        removed_bg_url: permanentBgRemovedUrl,
        removed_bg_at: new Date().toISOString()
      })
      .eq('id', imageId);

    if (updateError) {
      console.log('❌ Error updating image record:', updateError);
      return json({ success: false, error: 'Failed to update image' }, { status: 500 });
    }

    // Deduct credits using direct UPDATE (non-fatal if fails)
    const { error: creditError } = await supabaseAdmin
      .from('user_credits')
      .update({
        used_credits: creditsData.used_credits + 500,
        total_consumed: (creditsData.total_consumed || 0) + 500
      })
      .eq('user_id', user_id);

    if (creditError) {
      // Log error but don't rollback - image already processed
      console.log('⚠️ Error deducting credits (non-fatal):', creditError);
    } else {
      console.log('💳 Credits deducted: 500');
    }
    console.log(`💰 New balance: ${currentBalance - 500}`);
    console.log('═══════════════════════════════════════════════════════');

    return json({
      success: true,
      removed_bg_url: permanentBgRemovedUrl,
      remaining_credits: currentBalance - 500
    });

  } catch (error: any) {
    console.error('❌ Error in background removal:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
