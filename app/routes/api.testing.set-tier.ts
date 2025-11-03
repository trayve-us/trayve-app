import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { supabaseAdmin } from "~/lib/storage/supabase.server";

/**
 * TESTING ONLY: Set user tier for testing
 * This endpoint allows setting tier to professional/enterprise for testing 4K features
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Only allow in development/testing mode
  if (process.env.TESTING_MODE !== "true") {
    return json({ error: "Testing mode not enabled" }, { status: 403 });
  }

  try {
    const { session } = await authenticate.admin(request);
    const user = await getShopifyUserByShop(session.shop);

    if (!user) {
      return json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.trayve_user_id;
    const formData = await request.formData();
    const tier = formData.get("tier") as string;

    if (!tier || !["free", "creator", "professional", "enterprise"].includes(tier)) {
      return json({ error: "Invalid tier. Must be: free, creator, professional, or enterprise" }, { status: 400 });
    }

    console.log(`🔄 TESTING: Setting tier to ${tier} for:`, userId);

    // 1. Update shopify_users metadata
    const { error: metadataError } = await supabaseAdmin
      .from("shopify_users")
      .update({
        metadata: {
          subscriptionTier: tier,
          subscriptionStatus: "active",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("trayve_user_id", userId);

    if (metadataError) {
      console.error("❌ Error updating metadata:", metadataError);
      return json({ error: "Failed to update metadata" }, { status: 500 });
    }

    console.log("✅ Metadata updated to tier:", tier);

    // 2. Update/create subscription record
    const { error: subscriptionError } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .upsert({
        trayve_user_id: userId,
        shop: session.shop,
        plan_tier: tier,
        status: "active",
        images_allocated: tier === "free" ? 0 : 1000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'trayve_user_id'
      });

    if (subscriptionError) {
      console.error("❌ Error updating subscription:", subscriptionError);
      return json({ error: "Failed to update subscription" }, { status: 500 });
    }

    console.log("✅ Subscription updated to tier:", tier);

    // 3. Optionally give some credits for testing
    if (tier !== "free") {
      const { error: creditsError } = await supabaseAdmin
        .from("user_credits")
        .upsert({
          user_id: userId,
          total_credits: 1000,
          used_credits: 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (creditsError) {
        console.error("❌ Error updating credits:", creditsError);
      } else {
        console.log("✅ Credits set to 1000 for testing");
      }
    }

    console.log(`🎉 Tier set to ${tier} successfully!`);

    return json({
      success: true,
      message: `Tier set to ${tier} successfully`,
      tier,
    });
  } catch (error) {
    console.error("❌ Error setting tier:", error);
    return json(
      { error: "Failed to set tier" },
      { status: 500 }
    );
  }
};
