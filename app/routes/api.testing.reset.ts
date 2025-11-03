import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { getActiveSubscription, cancelSubscription } from "../lib/services/subscription.service";

/**
 * TESTING ONLY: Reset user data to fresh state
 * This endpoint resets:
 * - Credits to 0 (true free tier - no credits from paid plans)
 * - Deletes all subscription history
 * - Creates fresh free tier subscription
 * - Preserves user account and projects
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

    console.log("🔄 TESTING: Resetting user data for:", userId);

    // 1. Reset credits to 0 (true free tier user)
    // Note: available_credits is a generated column (total_credits - used_credits)
    // So we only need to update total_credits and used_credits
    const { error: creditsError } = await supabaseAdmin
      .from("user_credits")
      .upsert({
        user_id: userId,
        total_credits: 0,
        used_credits: 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (creditsError) {
      console.error("❌ Error resetting credits:", creditsError);
      return json({ error: "Failed to reset credits" }, { status: 500 });
    }

    console.log("✅ Credits reset to 0 (free tier)");

    // 2. Cancel any active subscription before creating new one
    const activeSubscription = await getActiveSubscription(userId);
    if (activeSubscription) {
      console.log(`🔄 Cancelling existing ${activeSubscription.plan_tier} subscription`);
      await cancelSubscription(activeSubscription.id);
      console.log("✅ Existing subscription cancelled");
    }

    // 3. Delete ALL subscription history (not just cancel)
    // This ensures "Previous Plan" doesn't show up and prevents duplicate errors
    const { error: deleteSubError } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .delete()
      .eq("trayve_user_id", userId);

    if (deleteSubError) {
      console.error("❌ Error deleting subscriptions:", deleteSubError);
      // Don't return error, continue with reset
    } else {
      console.log("✅ Subscription history cleared");
    }

    // 4. Create a fresh free tier subscription
    const { error: createSubError } = await supabaseAdmin
      .from("shopify_user_subscriptions")
      .insert({
        trayve_user_id: userId,
        shop: session.shop,
        plan_tier: "free",
        status: "active",
        images_allocated: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (createSubError) {
      console.error("❌ Error creating free subscription:", createSubError);
      return json({ error: "Failed to create free subscription", details: createSubError }, { status: 500 });
    } else {
      console.log("✅ Free tier subscription created");
    }

    // 5. Reset shopify_users metadata to free tier
    const { error: metadataError } = await supabaseAdmin
      .from("shopify_users")
      .update({
        metadata: {
          subscriptionTier: "free",
          subscriptionStatus: "active",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("trayve_user_id", userId);

    if (metadataError) {
      console.error("❌ Error updating metadata:", metadataError);
    } else {
      console.log("✅ Shopify user metadata reset to free tier");
    }

    // 6. Optionally: Delete all user generations (commented out by default)
    // Uncomment if you want to also clear project history
    /*
    const { error: generationsError } = await supabaseAdmin
      .from("user_generations")
      .delete()
      .eq("user_id", userId);

    if (generationsError) {
      console.error("❌ Error deleting generations:", generationsError);
    }
    */

    console.log("🎉 User data reset complete!");

    return json({
      success: true,
      message: "User data reset successfully",
      credits: {
        total: 0,
        available: 0,
        used: 0,
      },
    });
  } catch (error) {
    console.error("❌ Error in testing reset:", error);
    return json(
      { error: "Failed to reset user data" },
      { status: 500 }
    );
  }
};
