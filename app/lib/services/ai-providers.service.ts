/**
 * AI Provider Service
 * Handles integration with FAL AI and Replicate for image generation pipeline
 */

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

export interface FaceSwapResult {
  output: string; // Replicate returns single URL
}

export type QualityLevel = 'standard' | 'high' | 'premium';
export type PipelineStep = 'tryon' | 'basic-upscale' | 'enhanced-upscale' | 'replicate-face-swap';

// =============================================
// CONFIGURATION
// =============================================

const FAL_API_KEY = process.env.FAL_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!FAL_API_KEY) {
  console.warn('⚠️  FAL_KEY environment variable is not set');
}

if (!REPLICATE_API_TOKEN) {
  console.warn('⚠️  REPLICATE_API_TOKEN environment variable is not set');
}

// =============================================
// FAL AI CLIENT
// =============================================

/**
 * Execute try-on generation using FAL AI
 * @param modelImageUrl - URL of the model/pose image
 * @param clothingImageUrl - URL of the clothing item
 * @param quality - Quality level for generation
 */
export async function executeTryOn(
  modelImageUrl: string,
  clothingImageUrl: string,
  quality: QualityLevel = 'standard'
): Promise<TryOnResult> {
  if (!FAL_API_KEY) {
    throw new Error('FAL AI API key is not configured');
  }

  const guidanceScale = quality === 'premium' ? 4.0 : quality === 'high' ? 3.5 : 3.0;
  const inferenceSteps = quality === 'premium' ? 35 : quality === 'high' ? 28 : 20;

  try {
    console.log('🎨 Starting try-on generation with FAL AI...', {
      model: modelImageUrl.substring(0, 50),
      clothing: clothingImageUrl.substring(0, 50),
      quality,
    });

    const response = await fetch('https://queue.fal.run/fal-ai/instant-character', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Professional product photography, model wearing clothing item, high quality, detailed, commercial photo shoot',
        image_url: modelImageUrl,
        image_size: 'square_hd',
        guidance_scale: guidanceScale,
        num_inference_steps: inferenceSteps,
        enable_safety_checker: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FAL AI try-on failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Try-on generation completed');

    return {
      image_url: result.images[0]?.url || result.image?.url,
      seed: result.seed,
      has_nsfw_concepts: result.has_nsfw_concepts,
    };
  } catch (error) {
    console.error('❌ FAL AI try-on error:', error);
    throw error;
  }
}

/**
 * Execute basic upscale using FAL AI Clarity Upscaler
 * @param imageUrl - URL of the image to upscale
 */
export async function executeBasicUpscale(imageUrl: string): Promise<UpscaleResult> {
  if (!FAL_API_KEY) {
    throw new Error('FAL AI API key is not configured');
  }

  try {
    console.log('📈 Starting basic upscale (2x) with FAL AI...');

    const response = await fetch('https://queue.fal.run/fal-ai/clarity-upscaler', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        scale: 2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FAL AI basic upscale failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Basic upscale completed');

    return {
      image_url: result.image?.url || result.images[0]?.url,
    };
  } catch (error) {
    console.error('❌ FAL AI basic upscale error:', error);
    throw error;
  }
}

/**
 * Execute enhanced upscale using FAL AI Aura SR (4x)
 * @param imageUrl - URL of the image to upscale
 */
export async function executeEnhancedUpscale(imageUrl: string): Promise<UpscaleResult> {
  if (!FAL_API_KEY) {
    throw new Error('FAL AI API key is not configured');
  }

  try {
    console.log('🚀 Starting enhanced upscale (4x) with FAL AI Aura SR...');

    const response = await fetch('https://queue.fal.run/fal-ai/aura-sr', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        upscale_factor: 4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FAL AI enhanced upscale failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Enhanced upscale completed');

    return {
      image_url: result.image?.url || result.images[0]?.url,
    };
  } catch (error) {
    console.error('❌ FAL AI enhanced upscale error:', error);
    throw error;
  }
}

// =============================================
// REPLICATE CLIENT
// =============================================

/**
 * Execute face swap using Replicate
 * @param modelImageUrl - URL of the original model image
 * @param generatedImageUrl - URL of the generated image
 */
export async function executeFaceSwap(
  modelImageUrl: string,
  generatedImageUrl: string
): Promise<FaceSwapResult> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('Replicate API token is not configured');
  }

  try {
    console.log('👤 Starting face swap with Replicate...');

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'google/nano-banana', // Face swap model
        input: {
          prompt: 'High quality face swap maintaining facial features and expressions',
          image_input: [modelImageUrl, generatedImageUrl],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Replicate face swap failed: ${response.status} - ${errorText}`);
    }

    const prediction = await response.json();
    
    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      });

      result = await statusResponse.json();
      attempts++;
    }

    if (result.status === 'failed') {
      throw new Error(`Face swap failed: ${result.error}`);
    }

    if (attempts >= maxAttempts) {
      throw new Error('Face swap timed out after 5 minutes');
    }

    console.log('✅ Face swap completed');

    return {
      output: result.output,
    };
  } catch (error) {
    console.error('❌ Replicate face swap error:', error);
    throw error;
  }
}

// =============================================
// TIER-BASED STEP CONFIGURATION
// =============================================

/**
 * Get enabled steps for a subscription tier
 */
export function getEnabledSteps(tier: string): PipelineStep[] {
  const tierSteps: Record<string, PipelineStep[]> = {
    free: ['tryon', 'basic-upscale'],
    starter: ['tryon', 'basic-upscale'],
    creator: ['tryon', 'basic-upscale'],
    professional: ['tryon', 'basic-upscale', 'enhanced-upscale', 'replicate-face-swap'],
    enterprise: ['tryon', 'basic-upscale', 'enhanced-upscale', 'replicate-face-swap'],
  };

  return tierSteps[tier] || tierSteps.free;
}

/**
 * Get quality level for a subscription tier
 */
export function getQualityLevel(tier: string): QualityLevel {
  const tierQuality: Record<string, QualityLevel> = {
    free: 'standard',
    starter: 'standard',
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
}

export interface PipelineStepResult {
  stepType: PipelineStep;
  status: 'completed' | 'failed' | 'skipped';
  imageUrl?: string;
  error?: string;
  processingTime?: number;
}

/**
 * Execute full pipeline with tier-based steps
 * @param modelImageUrl - URL of the model/pose image
 * @param clothingImageUrl - URL of the clothing item
 * @param config - Pipeline configuration
 */
export async function executePipeline(
  modelImageUrl: string,
  clothingImageUrl: string,
  config: PipelineConfig
): Promise<PipelineStepResult[]> {
  const enabledSteps = config.enabledSteps || getEnabledSteps(config.tier);
  const quality = config.quality || getQualityLevel(config.tier);
  
  const results: PipelineStepResult[] = [];
  let currentImageUrl = '';

  console.log('🚀 Starting pipeline execution...', {
    tier: config.tier,
    steps: enabledSteps,
    quality,
  });

  // Step 1: Try-On (Required)
  if (enabledSteps.includes('tryon')) {
    const startTime = Date.now();
    try {
      const tryOnResult = await executeTryOn(modelImageUrl, clothingImageUrl, quality);
      currentImageUrl = tryOnResult.image_url;
      
      results.push({
        stepType: 'tryon',
        status: 'completed',
        imageUrl: currentImageUrl,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      results.push({
        stepType: 'tryon',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
      
      // If try-on fails, entire pipeline fails
      throw error;
    }
  }

  // Step 2: Basic Upscale
  if (enabledSteps.includes('basic-upscale') && currentImageUrl) {
    const startTime = Date.now();
    try {
      const upscaleResult = await executeBasicUpscale(currentImageUrl);
      currentImageUrl = upscaleResult.image_url;
      
      results.push({
        stepType: 'basic-upscale',
        status: 'completed',
        imageUrl: currentImageUrl,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      console.warn('⚠️  Basic upscale failed, continuing with original image:', error);
      results.push({
        stepType: 'basic-upscale',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
      // Continue with previous image
    }
  }

  // Step 3: Enhanced Upscale (Professional/Enterprise only)
  if (enabledSteps.includes('enhanced-upscale') && currentImageUrl) {
    const startTime = Date.now();
    try {
      const enhancedResult = await executeEnhancedUpscale(currentImageUrl);
      currentImageUrl = enhancedResult.image_url;
      
      results.push({
        stepType: 'enhanced-upscale',
        status: 'completed',
        imageUrl: currentImageUrl,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      console.warn('⚠️  Enhanced upscale failed, continuing with current image:', error);
      results.push({
        stepType: 'enhanced-upscale',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
      // Continue with previous image
    }
  }

  // Step 4: Face Swap (Professional/Enterprise only)
  if (enabledSteps.includes('replicate-face-swap') && currentImageUrl) {
    const startTime = Date.now();
    try {
      const faceSwapResult = await executeFaceSwap(modelImageUrl, currentImageUrl);
      currentImageUrl = faceSwapResult.output;
      
      results.push({
        stepType: 'replicate-face-swap',
        status: 'completed',
        imageUrl: currentImageUrl,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      console.warn('⚠️  Face swap failed, continuing with current image:', error);
      results.push({
        stepType: 'replicate-face-swap',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
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
