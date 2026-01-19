import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { supabaseAdmin } from "../lib/storage/supabase.server";
import { upscaleImage, type UpscaleResult } from "../lib/services/upscale.service";

/**
 * API Route: POST /api/upscale
 * Performs 4K upscaling using Replicate (Crystal Upscaler).
 * 
 * Headers:
 * - Content-Type: application/json
 * 
 * Body:
 * - image: string (URL or Base64)
 * - scale_factor: number (1-4, default 2)
 * 
 * Responses:
 * - 200: { success: true, image_url: string }
 * - 402: { success: false, error: "Insufficient credits" }
 * - 400/500: { success: false, error: string }
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // 1. Authenticate Shopify User
    const { session } = await authenticate.admin(request);
    
    if (!session || !session.shop) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get Trayve User ID
    const { data: shopifyUser, error: userError } = await supabaseAdmin
      .from("shopify_users")
      .select("trayve_user_id")
      .eq("shop_domain", session.shop)
      .single();

    if (userError || !shopifyUser) {
      console.error("User lookup failed:", userError);
      return json({ success: false, error: "User not found" }, { status: 404 });
    }

    const userId = shopifyUser.trayve_user_id;

    // 3. Parse Body
    const body = await request.json();
    const { image, scale_factor } = body;

    // 4. Check Tier Validity (Strict Enforcement)
    // Upscaling is LOCKED for Free and Creator tiers.
    // We need to fetch the user's subscription tier.
    // Importing `getActiveSubscription` at top of file
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getActiveSubscription } = require("../lib/services/subscription.service");
    const subscription = await getActiveSubscription(userId);
    const tier = subscription?.plan_tier || 'free';

    if (tier === 'free' || tier === 'creator') {
        console.warn(`🛑 Upscale blocked for user ${userId} on tier ${tier}`);
        return json({ success: false, error: "Upscaling is locked for your plan." }, { status: 403 });
    }

    // 5. Call Service
    const result: UpscaleResult = await upscaleImage(image, scale_factor, userId);
    
    return json({ success: true, image_url: result.image_url });

  } catch (error: any) {
    console.error("Upscale API Error:", error);

    // Handle 402 separately
    if (error.status === 402 || error.message === "Insufficient credits") {
       return json({ success: false, error: "Insufficient credits" }, { status: 402 });
    }

    return json({ 
      success: false, 
      error: error.message || "Failed to process upscale request" 
    }, { status: 500 });
  }
}
