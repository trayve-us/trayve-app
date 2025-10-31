/**
 * Model Access Control for Shopify App
 * Determines which models are accessible based on user's subscription tier
 * Mirrors logic from main Trayve app
 */

// =============================================
// TYPES
// =============================================

export type SubscriptionTier = "free" | "starter" | "professional" | "enterprise";

export interface ModelAccessInfo {
  isLocked: boolean;
  canAccess: boolean;
  requiredTier: SubscriptionTier;
  upgradePrompt?: string;
}

export type EnrichedModel<T = any> = T & {
  accessInfo: ModelAccessInfo;
};

// =============================================
// CONSTANTS
// =============================================

/**
 * Models accessible to free tier users
 * Must match the main Trayve app configuration
 */
export const FREE_TIER_MODELS = [
  'Chloe',
  'Emma',
  'Amara',
  'Grace'
] as const;

export type FreeTierModel = typeof FREE_TIER_MODELS[number];

/**
 * Check if a model is accessible on free tier
 */
export function isFreeTierModel(modelName: string): boolean {
  return FREE_TIER_MODELS.includes(modelName as FreeTierModel);
}

// =============================================
// ACCESS CONTROL FUNCTIONS
// =============================================

/**
 * Check if a model is locked for a given subscription tier
 * @param modelName - Name of the model
 * @param tier - User's subscription tier
 * @returns true if model is locked, false if accessible
 */
export function isModelLocked(
  modelName: string,
  tier: SubscriptionTier
): boolean {
  // All models are unlocked for users with ANY paid plan
  // Once a user purchases any plan (starter, professional, enterprise),
  // they get access to all models
  if (tier !== "free") {
    return false;
  }

  // For free tier users only, lock premium models
  // Free users can only access specific free-tier models
  return !isFreeTierModel(modelName);
}

/**
 * Check if a user can access a model based on their tier
 * @param modelName - Name of the model
 * @param tier - User's subscription tier
 * @returns true if user can access the model
 */
export function canAccessModel(
  modelName: string,
  tier: SubscriptionTier
): boolean {
  return !isModelLocked(modelName, tier);
}

/**
 * Get access information for a model
 * @param modelName - Name of the model
 * @param tier - User's subscription tier
 * @returns ModelAccessInfo object with lock status and access details
 */
export function getModelAccessInfo(
  modelName: string,
  tier: SubscriptionTier
): ModelAccessInfo {
  const locked = isModelLocked(modelName, tier);
  const canAccess = !locked;
  
  // Free tier models are accessible to everyone
  // Premium models require any paid plan (starter, professional, or enterprise)
  const requiredTier: SubscriptionTier = isFreeTierModel(modelName)
    ? "free"
    : "starter"; // Any paid plan unlocks all models

  const upgradePrompt = locked
    ? "Upgrade to any plan to unlock all models"
    : undefined;

  return {
    isLocked: locked,
    canAccess,
    requiredTier,
    upgradePrompt,
  };
}

/**
 * Enrich a single model with access information
 */
export function enrichModelWithAccess<T extends { name?: string }>(
  model: T,
  tier: SubscriptionTier
): EnrichedModel<T> {
  const modelName = model.name || "";
  const accessInfo = getModelAccessInfo(modelName, tier);

  return {
    ...model,
    accessInfo,
  };
}

/**
 * Enrich multiple models with access information
 */
export function enrichModelsWithAccess<T extends { name?: string }>(
  models: T[],
  tier: SubscriptionTier
): EnrichedModel<T>[] {
  return models.map((model) => enrichModelWithAccess(model, tier));
}

/**
 * Get list of all free tier accessible models
 */
export function getFreeModels(): readonly string[] {
  return FREE_TIER_MODELS;
}

/**
 * Get count of free models
 */
export function getFreeModelsCount(): number {
  return FREE_TIER_MODELS.length;
}

/**
 * Determine subscription tier from Shopify user metadata
 * Maps Shopify plan names to tier types
 */
export function getSubscriptionTier(metadata?: { subscriptionTier?: string }): SubscriptionTier {
  if (!metadata?.subscriptionTier) return "free";
  
  const tier = metadata.subscriptionTier;
  
  // Map plan names to tier types
  if (tier === "professional" || tier === "plan_professional") return "professional";
  if (tier === "enterprise" || tier === "plan_enterprise") return "enterprise";
  if (tier === "creator" || tier === "plan_creator") return "starter"; // Creator plan maps to starter tier
  if (tier === "starter" || tier === "plan_starter") return "starter";
  
  return "free";
}
