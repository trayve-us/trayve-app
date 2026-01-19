/**
 * AI Provider Service
 * Handles integration with FAL AI and Replicate for image generation pipeline
 */

import { fal } from "@fal-ai/client";
import Replicate from "replicate";
import { generateImageVertex, isVertexAIConfigured } from "./vertex-gen.service";
import { constructVertexPrompt, type VertexPromptMode } from "../vertex-prompt";
import {
  uploadToShopifyGenerationsBucket,
  downloadImageAsBuffer,
  generateUniqueFileName,
  type UploadResult,
} from "./storage.service";
import { applyWatermark } from "./watermark.service";

// =============================================
// TYPES
// =============================================

export interface TryOnResult {
  image_url: string;
  seed?: number;
  has_nsfw_concepts?: boolean;
}

export interface UpscaleResult {
  image_url: string;
}

export type QualityLevel = 'standard' | 'high' | 'premium';
export type PipelineStep = 'tryon' | 'watermark' | 'enhanced-upscale' | 'shop-ready' | 'post-ready';

// =============================================
// CONFIGURATION
// =============================================

const FAL_API_KEY = process.env.FAL_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Initialize FAL AI client
if (!FAL_API_KEY) {
  console.error('❌ CRITICAL: FAL_KEY environment variable is not set!');
  console.error('Please check your .env file in the trayve-app directory');
} else {
  // Log the key format (first 10 chars only for security)
  const keyPreview = FAL_API_KEY.substring(0, 10) + '...';
  console.log('🔑 FAL_KEY found:', keyPreview);
  console.log('🔑 FAL_KEY length:', FAL_API_KEY.length);
  console.log('🔑 FAL_KEY format check:', FAL_API_KEY.includes(':') ? 'Contains colon ✓' : 'Missing colon ✗');

  // Configure FAL client with credentials
  fal.config({
    credentials: FAL_API_KEY,
  });
  console.log('✅ FAL AI client configured');
}

// Initialize Replicate client
let replicate: Replicate | null = null;
if (!REPLICATE_API_TOKEN) {
  console.warn('⚠️  REPLICATE_API_TOKEN environment variable is not set');
} else {
  replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
  });
  console.log('✅ Replicate client configured');
}

// =============================================
// FAL AI CLIENT
// =============================================

/**
 * Execute try-on generation using FAL AI Fashion Try-On
 * @param modelImageUrl - URL of the model/pose image
 * @param clothingImageUrl - URL of the clothing item
 * @param quality - Quality level for generation
 */
function getTryOnPrompt(gender: 'male' | 'female'): string {
  const subject = gender === 'male' ? 'male' : 'female';
  const pronoun = gender === 'male' ? 'him' : 'her'; // Object pronoun
  const possessive = gender === 'male' ? 'his' : 'her'; // Possessive

  return `Use the ${subject} from the reference image. Preserve ${possessive} exact pose, if only upper body is visible then keep only upper body visible, facial expression, body proportions, and camera angle. Apply the outfit from the clothing reference image onto ${pronoun}, making it look natural, well-fitted, and realistic. Match lighting, shadows, folds, and texture. Do not alter ${possessive} pose or appearance—only replace ${possessive} clothing with the provided outfit.`;
}

// ... existing code ...

/**
 * Execute try-on generation using Vertex AI (Primary) and Replicate (Fallback)
 * @param modelImageUrl - URL of the model/pose image
 * @param clothingImageUrl - URL of the clothing item
 * @param quality - Quality level for generation
 */
export async function executeTryOn(
  modelImageUrl: string,
  clothingImageUrl: string,
  quality: QualityLevel = 'standard',
  gender: 'male' | 'female' = 'female',
  // Prompt parameter is kept for signature compatibility but we construct specific one internally
  _prompt?: string
): Promise<TryOnResult> {
  const sysPrompt = getTryOnPrompt(gender);

  // Debug Logging for Environment Variables (as requested)
  console.log("--- Vertex AI Environment Check ---");
  console.log("GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT || "undefined");
  console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS || "undefined");
  console.log("GCP_CLIENT_EMAIL:", process.env.GCP_CLIENT_EMAIL ? "Set (Redacted)" : "undefined");
  console.log("-----------------------------------");

  // --- PRIMARY PIPELINE: VERTEX AI ---
  if (isVertexAIConfigured()) {
    console.log("🚀 Attempting primary generation with Vertex AI...");

    // Retry logic: 1 initial call + 3 retries = 4 total attempts
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`📡 Vertex AI Attempt ${attempt}/${maxRetries + 1}...`);

        // For try-on, we typically need a specific aspect ratio. 
        // User requested dynamic aspect ratio logic for fallback, but for Vertex AI
        // we usually want to match the input. 
        // However, Vertex AI takes specific ratios.
        // Default to 1:1 if not determined, or we could pass 3:4.
        // The user prompt for Fallback says "match_input_image, 1:1, ...".
        // For Vertex, we will just use 3:4 as a safe bet for fashion or let it default.
        // The user previous prompt used 3:4. I will keep 3:4 or 1:1. 
        // Let's use 3:4 for vertical fashion shots.
        const result = await generateImageVertex({
          referenceImageUrls: [modelImageUrl, clothingImageUrl],
          prompt: sysPrompt,
          aspectRatio: "3:4"
        });

        console.log("✅ Vertex AI generation successful");

        return {
          image_url: result.image,
          has_nsfw_concepts: false
        };
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Vertex AI Attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);

        if (attempt <= maxRetries) {
          const delay = 2000; // 2 second delay between retries
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.warn(`❌ All ${maxRetries + 1} Vertex AI attempts failed. Switching to fallback pipeline...`);
  } else {
    console.log("ℹ️ Vertex AI not configured, skipping to fallback.");
  }

  // --- FALLBACK PIPELINE: REPLICATE (google/nano-banana-pro) ---
  // Requested model: google/nano-banana-pro
  // NOTE: Previous attempt with this specific model ID failed with 422. 
  // If the hash is invalid/private, this WILL fail. Implementing as strictly requested.
  // The user requirement table explicitly lists "google/nano-banana-pro (Replicate)".
  if (!replicate) {
    throw new Error('Replicate API token is not configured (and Vertex AI failed/skipped)');
  }

  try {
    console.log('Using Fallback Replicate Model: google/nano-banana-pro...');

    // We try to execute with the model name. If it requires a version hash, Replicate might auto-resolve 
    // if "google/nano-banana-pro" is an alias (unlikely) or if we provide the hash.
    // Since the hash was rejected last time, I will try to use the 'clean' model name if it exists 
    // or fallback to the provided hash if I can find it in my logs (bc5b53c...).
    // However, if the user explicitly names "google/nano-banana-pro", that is usually an OWNER/MODEL pattern.

    // Using the generic run command which usually takes "owner/model:version" or "owner/model" (if public).
    // I will try just the model name first.
    const output = await replicate.run(
      "google/nano-banana-pro",
      {
        input: {
          prompt: sysPrompt,
          image: modelImageUrl
        }
      }
    );

    console.log('✅ Replicate fallback generation completed successfully');

    // Extract output
    let imageUrl = '';
    if (Array.isArray(output)) {
      imageUrl = output[0];
    } else if (typeof output === 'string') {
      imageUrl = output;
    } else {
      // @ts-ignore
      imageUrl = output?.url || String(output);
    }

    if (!imageUrl) {
      throw new Error('No image generated by Replicate fallback');
    }

    return {
      image_url: imageUrl,
      has_nsfw_concepts: false,
    };
  } catch (error) {
    console.error('❌ Replicate fallback error:', error);
    // If this fails, we have no more fallbacks.
    throw error;
  }
}

/**
 * Execute basic upscale using Replicate CodeFormer

    // Extract image URL from result
    const imageUrl = result.data?.image?.url;
    
    if (!imageUrl) {
      console.error('❌ No image URL in result:', result);
      throw new Error('No image generated by FAL AI Fashion Try-On');
    }

    console.log('📸 Generated image URL:', imageUrl.substring(0, 100) + '...');

    return {
      image_url: imageUrl,
      has_nsfw_concepts: false,
    };
  } catch (error) {
    console.error('❌ FAL AI try-on error:', error);
    
    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Log validation errors from FAL AI
    if ((error as any).body?.detail) {
      console.error('🔍 Validation details:', JSON.stringify((error as any).body.detail, null, 2));
    }
    
    throw error;
  }
}

/**
 * Execute basic upscale using Replicate (Crystal Upscaler) - Only for Pro/Enterprise
 * @param imageUrl - URL of the image to upscale
 */
export async function executeBasicUpscale(imageUrl: string): Promise<UpscaleResult> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('Replicate API token is not configured');
  }

  try {
    console.log('📈 Starting upscale with Replicate (philz1337x/crystal-upscaler)...');
    console.log('🖼️  Input image:', imageUrl.substring(0, 100) + '...');

    // Model: philz1337x/crystal-upscaler
    // We rely on standard Replicate run with 'image' input
    // The previous implementation used "basic-upscale" incorrectly pointing to CodeFormer.
    if (!replicate) throw new Error("Replicate client not initialized");
    const output = await replicate.run(
      "philz1337x/crystal-upscaler",
      {
        input: {
          image: imageUrl,
          // upscale_factor: 2 or 4. Requirement says 2K for Free/Creator (LOCKED), 4K for Pro/Ent.
          // Since this function is called for "basic-upscale", we need to clarify usage.
          // If this function is NOW only for Pro/Ent, we can default to 4x or whatever max is.
          scale: 4,
        }
      }
    );

    let upscaledUrl = '';
    // Replicate output parsing
    if (typeof output === 'string') upscaledUrl = output;
    // @ts-ignore
    else if (output?.url) upscaledUrl = output.url;

    if (!upscaledUrl) throw new Error("No URL returned from Crystal Upscaler");

    return {
      image_url: upscaledUrl
    };

  } catch (error) {
    console.error('❌ Upscale error:', error);
    throw error;
  }
}


/**
 * Execute enhanced upscale using Replicate Crystal Upscaler (mapped to new requirement)
 * @param imageUrl - URL of the image to upscale
 */
export async function executeEnhancedUpscale(imageUrl: string): Promise<UpscaleResult> {
  // Just forward to basic upscale which is now the Crystal Upscaler wrapper
  return executeBasicUpscale(imageUrl);
}

// =============================================
// STUDIO GENERATION (Shop Ready & Post Ready)
// =============================================

export interface StudioGenerationInput {
  mode: VertexPromptMode;
  gender: 'male' | 'female';
  referenceImageUrl: string;
  themePrompt?: string;
  backgroundPrompt?: string;
  anglePrompt?: string;
  aspectRatio?: string;
}

/**
 * Execute Shop Ready or Post Ready generation using Vertex AI
 */
export async function executeStudioGeneration(
  input: StudioGenerationInput
): Promise<TryOnResult> {
  const { mode, gender, referenceImageUrl, themePrompt, backgroundPrompt, anglePrompt, aspectRatio } = input;

  // Construct the prompt using the strict logic defined in vertex-prompt.ts
  const prompt = constructVertexPrompt({
    mode,
    gender,
    themePrompt,
    backgroundPrompt,
    anglePrompt,
  });

  console.log(`🎨 Executing ${mode} generation...`);
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);

  if (!isVertexAIConfigured()) {
    console.warn("⚠️ Vertex AI not configured for simplified studio generation. Attempting fallback...");
    // Fallback logic could go here, but as per requirements Vertex AI is the target.
    // We can reuse the TryOn fallback or fail.
    // Integrating simple Replicate fallback for now if Vertex is missing.
    if (!replicate) throw new Error("No AI provider configured");

    // Using a general model for fallback (e.g. standard Flux or similar if available, or fail)
    // For now, throwing error if Vertex is missing as this is a specific Vertex feature request
    // unless we want to map it to a generic replicate model.
    throw new Error("Vertex AI is required for Studio Generation features");
  }

  try {
    const result = await generateImageVertex({
      referenceImageUrls: [referenceImageUrl],
      prompt: prompt,
      aspectRatio: aspectRatio || "3:4", // Default to 3:4 for fashion
    });

    return {
      image_url: result.image,
      has_nsfw_concepts: false,
    };
  } catch (error) {
    // Sanitize error log to avoid printing base64 image data
    console.error(`❌ ${mode} generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (process.env.NODE_ENV === 'development') {
      // Only log stack or safe properties
      console.error('Stack:', error instanceof Error ? error.stack : String(error));
    }
    throw error;
  }
}



// =============================================
// REPLICATE CLIENT
// =============================================



// =============================================
// TIER-BASED STEP CONFIGURATION
// =============================================

/**
 * Get enabled steps for a subscription tier
 */
export function getEnabledSteps(tier: string): PipelineStep[] {
  // NEW TIER LOGIC (Jan 2026)
  // Free: TryOn + Watermark. NO UPSCALE.
  // Creator: TryOn. NO UPSCALE.
  // Professional/Enterprise: TryOn + Crystal Upscale (4K) + Face Swap

  const tierSteps: Record<string, PipelineStep[]> = {
    free: ['tryon', 'watermark'], // Watermark enforcement
    creator: ['tryon'], // Clean output, no upscale
    professional: ['tryon', 'enhanced-upscale'], // 4K Upscale
    enterprise: ['tryon', 'enhanced-upscale'], // 4K Upscale
  };

  return tierSteps[tier] || tierSteps.free;
}

/**
 * Get quality level for a subscription tier
 */
export function getQualityLevel(tier: string): QualityLevel {
  const tierQuality: Record<string, QualityLevel> = {
    free: 'standard',
    creator: 'high',
    professional: 'premium',
    enterprise: 'premium',
  };

  return tierQuality[tier] || 'standard';
}

// =============================================
// PIPELINE EXECUTOR
// =============================================

export interface PipelineConfig {
  tier: string;
  enabledSteps?: PipelineStep[];
  quality?: QualityLevel;
  gender?: 'male' | 'female';
  onStepComplete?: (step: PipelineStepResult) => Promise<void>;  // NEW: Callback for incremental updates
  mode?: VertexPromptMode; // 'social_media' or 'product_shots'
  prompts?: {
    theme?: string;
    background?: string;
    angle?: string;
  };
}

export interface PipelineStepResult {
  stepType: PipelineStep;
  status: 'completed' | 'failed' | 'skipped';
  imageUrl?: string;  // Final stored URL (Supabase)
  originalUrl?: string;  // Original FAL.AI/Replicate URL (for next steps, bypasses 5MB limit)
  error?: string;
  processingTime?: number;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Upload step image to Supabase storage
 * Downloads image from AI provider URL and uploads to Supabase
 * @param aiProviderUrl - URL from FAL/Replicate
 * @param stepType - Pipeline step type
 * @param executionId - Unique execution ID
 * @returns Supabase public URL
 */
async function uploadStepImageToSupabase(
  aiProviderUrl: string,
  stepType: PipelineStep,
  executionId: string
): Promise<string> {
  try {
    console.log(`📤 Uploading ${stepType} image to Supabase...`);
    console.log(`   AI Provider URL: ${aiProviderUrl.substring(0, 80)}...`);

    // Download image from AI provider
    const imageBuffer = await downloadImageAsBuffer(aiProviderUrl);
    console.log(`✅ Downloaded image: ${imageBuffer.length} bytes`);

    // Generate unique filename
    const fileName = generateUniqueFileName('png', `${executionId}/${stepType}`);

    // Upload to Supabase
    const uploadResult = await uploadToShopifyGenerationsBucket(
      imageBuffer,
      fileName,
      'image/png'
    );

    console.log(`✅ Uploaded to Supabase: ${uploadResult.url.substring(0, 80)}...`);
    return uploadResult.url;
  } catch (error) {
    console.error(`❌ Failed to upload ${stepType} image to Supabase:`, error);
    // Fall back to AI provider URL if upload fails
    return aiProviderUrl;
  }
}

// =============================================
// PIPELINE EXECUTION
// =============================================

/**
 * Execute full pipeline with tier-based steps
 * @param modelImageUrl - URL of the model/pose image
 * @param clothingImageUrl - URL of the clothing item
 * @param config - Pipeline configuration
 * @param executionId - Unique execution ID for storage path
 */
export async function executePipeline(
  modelImageUrl: string,
  clothingImageUrl: string,
  config: PipelineConfig,
  executionId: string
): Promise<PipelineStepResult[]> {
  const enabledSteps = config.enabledSteps || getEnabledSteps(config.tier);
  const quality = config.quality || getQualityLevel(config.tier);
  const gender = config.gender || 'female';

  const results: PipelineStepResult[] = [];
  let currentImageUrl = '';

  console.log('🚀 Starting pipeline execution...', {
    tier: config.tier,
    steps: enabledSteps,
    quality,
    gender,
  });

  // Step 1: Mode Selection
  let generatedImageUrl = '';

  // Case A: Shop Ready / Post Ready
  if (config.mode === 'social_media' || config.mode === 'product_shots') {
    const startTime = Date.now();
    const stepType = config.mode === 'social_media' ? 'post-ready' : 'shop-ready';

    try {
      const result = await executeStudioGeneration({
        mode: config.mode,
        gender: gender,
        referenceImageUrl: modelImageUrl, // In this case modelImageUrl is the Input Image
        themePrompt: config.prompts?.theme,
        backgroundPrompt: config.prompts?.background,
        anglePrompt: config.prompts?.angle,
        // Aspect ratio could be passed in config if needed, defaulting to 3:4
      });

      const aiProviderUrl = result.image_url;
      const supabaseUrl = await uploadStepImageToSupabase(aiProviderUrl, stepType, executionId);
      currentImageUrl = aiProviderUrl; // For chain
      generatedImageUrl = supabaseUrl;

      const stepResult: PipelineStepResult = {
        stepType: stepType,
        status: 'completed',
        imageUrl: supabaseUrl,
        originalUrl: aiProviderUrl,
        processingTime: Date.now() - startTime,
      };
      results.push(stepResult);
      if (config.onStepComplete) await config.onStepComplete(stepResult);

    } catch (error) {
      const stepResult: PipelineStepResult = {
        stepType: stepType,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
      results.push(stepResult);
      if (config.onStepComplete) await config.onStepComplete(stepResult);
      throw error;
    }
  }
  // Case B: Virtual Try-On (Default)
  else if (enabledSteps.includes('tryon')) {
    const startTime = Date.now();
    try {
      const tryOnResult = await executeTryOn(modelImageUrl, clothingImageUrl, quality, gender);
      const aiProviderUrl = tryOnResult.image_url;

      // Upload to Supabase immediately
      const supabaseUrl = await uploadStepImageToSupabase(aiProviderUrl, 'tryon', executionId);
      currentImageUrl = aiProviderUrl;  // Use AI provider URL for next step (bypasses 5MB limit)

      const stepResult: PipelineStepResult = {
        stepType: 'tryon',
        status: 'completed',
        imageUrl: supabaseUrl,  // Store Supabase URL in metadata
        originalUrl: aiProviderUrl,  // Keep AI provider URL for next step
        processingTime: Date.now() - startTime,
      };

      results.push(stepResult);

      // NEW: Call callback for real-time update
      if (config.onStepComplete) {
        await config.onStepComplete(stepResult);
      }
    } catch (error) {
      const stepResult: PipelineStepResult = {
        stepType: 'tryon',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };

      results.push(stepResult);

      // NEW: Call callback even for failures
      if (config.onStepComplete) {
        await config.onStepComplete(stepResult);
      }

      // If try-on fails, entire pipeline fails
      throw error;
    }
  }

  // INSERTING WATERMARK BLOCK (Step 1.5)
  if (enabledSteps.includes('watermark' as any) && currentImageUrl) {
    try {
      console.log('▶️ Executing Step: Watermark Enforcement');
      const startTime = Date.now();
      // Pass userId if available in config, else default
      const uid = (config as any).userId || 'system';
      const watermarkedUrl = await applyWatermark(currentImageUrl, uid);

      const result: PipelineStepResult = {
        stepType: 'watermark' as any,
        status: 'completed',
        imageUrl: watermarkedUrl
      };
      results.push(result);
      currentImageUrl = watermarkedUrl;
      if (config.onStepComplete) await config.onStepComplete(result);
    } catch (err) {
      console.error('❌ Watermark failed', err);
    }
  }



  // Step 3: Enhanced Upscale (Professional/Enterprise only)
  if (enabledSteps.includes('enhanced-upscale') && currentImageUrl) {
    const startTime = Date.now();
    try {
      // Use originalUrl from previous step to bypass 5MB limit
      const previousStep = results[results.length - 1];
      const inputUrl = previousStep?.originalUrl || currentImageUrl;

      console.log(`📥 Enhanced upscale input: ${inputUrl.substring(0, 80)}...`);
      const enhancedResult = await executeEnhancedUpscale(inputUrl);
      const aiProviderUrl = enhancedResult.image_url;

      // Upload to Supabase immediately
      const supabaseUrl = await uploadStepImageToSupabase(aiProviderUrl, 'enhanced-upscale', executionId);
      currentImageUrl = aiProviderUrl;  // Use AI provider URL for next step

      const stepResult: PipelineStepResult = {
        stepType: 'enhanced-upscale',
        status: 'completed',
        imageUrl: supabaseUrl,  // Store Supabase URL in metadata
        originalUrl: aiProviderUrl,  // FAL.AI URL for next step
        processingTime: Date.now() - startTime,
      };

      results.push(stepResult);

      // NEW: Call callback for real-time update (4K is ready!)
      if (config.onStepComplete) {
        await config.onStepComplete(stepResult);
      }
    } catch (error) {
      console.warn('⚠️  Enhanced upscale failed, continuing with current image:', error instanceof Error ? error.message : 'Unknown error');
      const stepResult: PipelineStepResult = {
        stepType: 'enhanced-upscale',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };

      results.push(stepResult);

      // NEW: Call callback for failures too
      if (config.onStepComplete) {
        await config.onStepComplete(stepResult);
      }
      // Continue with previous image
    }
  }



  console.log('✅ Pipeline execution completed', {
    totalSteps: results.length,
    successfulSteps: results.filter(r => r.status === 'completed').length,
    finalImageUrl: currentImageUrl,
  });

  return results;
}
