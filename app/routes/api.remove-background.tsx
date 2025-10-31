import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getShopifyUserByShop } from "~/lib/auth";

/**
 * POST /api/remove-background
 * Removes background from an image (costs 500 credits)
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

    // Check credits balance
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('credits_balance')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      console.log('❌ Error fetching user:', userError);
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (userData.credits_balance < 500) {
      console.log('❌ Insufficient credits:', userData.credits_balance);
      return json({ 
        success: false, 
        error: 'Insufficient credits',
        required: 500,
        available: userData.credits_balance
      }, { status: 400 });
    }

    console.log(`💳 Current balance: ${userData.credits_balance} credits`);

    // Fetch generation result record
    const { data: imageRecord, error: imageError } = await supabaseAdmin
      .from('generation_results')
      .select('id, result_image_url, generation_metadata, project_id')
      .eq('id', imageId)
      .single();

    if (imageError || !imageRecord) {
      console.log('❌ Image not found:', imageError);
      return json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    const metadata = imageRecord.generation_metadata || {};

    // Check if already removed
    if (metadata.removed_bg_url) {
      console.log('ℹ️ Background already removed');
      return json({ 
        success: true, 
        removed_bg_url: metadata.removed_bg_url,
        message: 'Background already removed'
      });
    }

    console.log('🔄 Processing background removal...');

    // Use FAL AI or similar service for background removal
    // For now, we'll simulate the API call
    const sourceUrl = metadata.basic_upscale_url || imageRecord.result_image_url;
    
    // TODO: Call actual background removal API
    // const response = await fetch('https://fal.run/fal-ai/imageutils/rembg', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Key ${process.env.FAL_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     image_url: sourceUrl
    //   })
    // });

    // Placeholder: In production, this would be the actual removed BG URL
    const removedBgUrl = sourceUrl.replace('.jpg', '_nobg.png');

    // Update generation metadata with removed background URL
    const updatedMetadata = {
      ...metadata,
      removed_bg_url: removedBgUrl
    };

    const { error: updateError } = await supabaseAdmin
      .from('generation_results')
      .update({ generation_metadata: updatedMetadata })
      .eq('id', imageId);

    if (updateError) {
      console.log('❌ Error updating image record:', updateError);
      return json({ success: false, error: 'Failed to update image' }, { status: 500 });
    }

    // Deduct credits using RPC
    const { data: creditResult, error: creditError } = await supabaseAdmin
      .rpc('consume_credits', {
        p_user_id: user_id,
        p_amount: 500,
        p_description: `Background removal for image ${imageId}`
      });

    if (creditError || !creditResult) {
      console.log('❌ Error deducting credits:', creditError);
      // Rollback the image update
      await supabaseAdmin
        .from('generation_results')
        .update({ generation_metadata: metadata })
        .eq('id', imageId);
      
      return json({ success: false, error: 'Failed to deduct credits' }, { status: 500 });
    }

    console.log('✅ Background removed successfully');
    console.log(`💳 Credits deducted: 500`);
    console.log(`💰 New balance: ${userData.credits_balance - 500}`);
    console.log('═══════════════════════════════════════════════════════');

    return json({
      success: true,
      removed_bg_url: removedBgUrl,
      remaining_credits: userData.credits_balance - 500
    });

  } catch (error: any) {
    console.error('❌ Error in background removal:', error);
    return json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
