import Replicate from "replicate";
import { consumeUserCredits, addUserCredits } from "../credits/credits.server";

// Configuration
const UPSCALE_MODEL = "philz1337x/crystal-upscaler";
const COST = 1000;
const TIMEOUT_MS = 240000; // 4 minutes
const CHECK_INTERVAL_MS = 2000;

export interface UpscaleResult {
  image_url: string;
}

/**
 * Validates and normalizes the input scale factor.
 * Clamps result between 1 and 4. Defaults to 2.
 */
function validateScaleFactor(scaleFactor?: number | string): number {
  let scale = Number(scaleFactor);
  if (isNaN(scale)) scale = 2;
  return Math.min(Math.max(Math.floor(scale), 1), 4);
}

/**
 * Validates the image URL.
 */
function validateImageUrl(url: string) {
  if (!url || typeof url !== 'string' || (!url.startsWith('http') && !url.startsWith('data:'))) {
    throw new Error("Invalid image URL: Must be a valid HTTP URL or Base64 Data URI");
  }
}

/**
 * Upscale user image using Replicate Crystal Upscaler.
 * Handles credit deduction, timeout polling, and refund on failure.
 */
export async function upscaleImage(
  imageUrl: string, 
  scaleFactor: number = 2, 
  userId: string
): Promise<UpscaleResult> {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }

  // 1. Validate Input
  validateImageUrl(imageUrl);
  const validScale = validateScaleFactor(scaleFactor);
  
  // 2. Check & Deduct Credits
  // We use consumeUserCredits which handles the DB update.
  // We'll throw 402 if it fails due to insufficient funds (handled by caller or here).
  const creditResult = await consumeUserCredits(
    userId, 
    COST, 
    `4K Upscale (x${validScale})`, 
    "upscale"
  );

  if (!creditResult.success) {
    // If error is insufficient credits, we should let the caller handle the 402 response,
    // or throw a specific error. The prompt asks to "Return a 402 Payment Required error".
    // Since this is a service function, we throw an error that the route handler can catch.
    if (creditResult.error === "Insufficient credits") {
       const err = new Error("Insufficient credits");
       // @ts-ignore
       err.status = 402;
       throw err;
    }
    throw new Error(creditResult.error || "Failed to deduct credits");
  }
  
  try {
    const replicate = new Replicate({ auth: replicateToken });

    // 3. Create Prediction
    const prediction = await replicate.predictions.create({
      model: UPSCALE_MODEL,
      input: { image: imageUrl, scale_factor: validScale }
    });

    // 4. Poll for Completion
    let currentPrediction = prediction;
    const startTime = Date.now();

    while (
      currentPrediction.status !== "succeeded" &&
      currentPrediction.status !== "failed" &&
      currentPrediction.status !== "canceled"
    ) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        // Attempt cancellation
        try {
          await replicate.predictions.cancel(prediction.id);
        } catch (cancelErr) {
          console.warn("Failed to cancel timed-out prediction:", cancelErr);
        }
        throw new Error("Upscale timed out");
      }
      
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
      currentPrediction = await replicate.predictions.get(prediction.id);
    }

    if (currentPrediction.status !== "succeeded") {
      throw new Error(`Prediction failed: ${currentPrediction.error}`);
    }

    // Extract output
    let outputUrl = '';
    const output = currentPrediction.output;
    
    if (typeof output === 'string') {
        outputUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
        outputUrl = output[0];
    } else if (output && typeof output === 'object') {
        // Handle potential object/stream response
        outputUrl = (output as any).url || String(output);
    }

    if (!outputUrl) {
        throw new Error("Replicate completed but returned no output URL");
    }

    return { image_url: outputUrl }; 

  } catch (error) {
    console.error("Upscale failed, refunding credits:", error);
    // 5. Refund Credits on Failure
    // We use addUserCredits to refund.
    // Note: addUserCredits (as read from code) uses 'purchase' or 'bonus'.
    // Typical refund usually just adds back. We can mark it as 'adjustment' or similar if supported,
    // but the generic add function works.
    await addUserCredits(
        userId, 
        COST, 
        "Refund: Upscale failed"
    ); 
    throw error;
  }
}
