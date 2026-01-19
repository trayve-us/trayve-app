import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import fs from "fs";
import path from "path";

export interface VertexGenerationInput {
  referenceImageUrls: string[];
  prompt: string;
  aspectRatio?: string;
}

export interface VertexGenerationResult {
  image: string;
  provider: "vertex-ai";
}

// Initialize client with environment variables or key file
const getVertexAIClient = () => {
  let projectId = process.env.GOOGLE_CLOUD_PROJECT;
  // Vertex AI Generative models (Imagen 3) require specific regions, 'global' often fails with 500/404.
  // We force us-central1 here to ensure stability even if .env says global.
  const location = "global"; //process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  // Try to infer projectId from GOOGLE_APPLICATION_CREDENTIALS if set
  if (!projectId && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      let keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      // Ensure path is absolute for the Google Auth library
      if (!path.isAbsolute(keyPath)) {
        keyPath = path.resolve(process.cwd(), keyPath);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
        console.log(`ℹ️ Resolved GOOGLE_APPLICATION_CREDENTIALS to absolute path: ${keyPath}`);
      }

      if (fs.existsSync(keyPath)) {
        const keyFile = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
        if (keyFile.project_id) {
          console.log(`ℹ️ Inferred GOOGLE_CLOUD_PROJECT from key file: ${keyFile.project_id}`);
          projectId = keyFile.project_id;
        }
      }
    } catch (err) {
      console.warn("Failed to parse GOOGLE_APPLICATION_CREDENTIALS file for project_id", err);
    }
  }

  // Also check if trayve-website-service-account.json exists in root and use it if nothing else is set
  // This is a fallback for the specific environment context the user is in.
  if (!projectId) {
    const defaultKeyPath = path.resolve(process.cwd(), "trayve-website-service-account.json");
    if (fs.existsSync(defaultKeyPath)) {
      try {
        const keyFile = JSON.parse(fs.readFileSync(defaultKeyPath, "utf-8"));
        if (keyFile.project_id) {
          console.log(`ℹ️ Auto-detected service account file: ${keyFile.project_id}`);
          projectId = keyFile.project_id;
          // We should also set GOOGLE_APPLICATION_CREDENTIALS for the SDK to pick it up?
          // The SDK might not need it if we pass `projectId` AND `credentials`?
          // @google/genai doesn't seem to take raw credentials in the constructor easily (it takes 'apiKey', 'accessToken' etc or relies on ADC).
          // Standard Google Auth library behavior is to look at GOOGLE_APPLICATION_CREDENTIALS.
          // So we set it for the process if it's not set.
          if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = defaultKeyPath;
            console.log(`ℹ️ Set GOOGLE_APPLICATION_CREDENTIALS to ${defaultKeyPath}`);
          }
        }
      } catch (err) {
        console.warn("Failed to parse default service account file", err);
      }
    }
  }

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not set and could not be inferred from credentials");
  }

  // Handle "Method B" Raw Keys if present... (omitted detailed logic as SDK handles ADC mostly)
  // If we have raw keys in env vars, write them to a temp file and use it for ADC
  if (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const tempKeyPath = path.resolve(process.cwd(), "gcp-temp-credentials.json");

      // Only write if doesn't exist or we want to overwrite. 
      // Since it's temp, overwriting is fine to ensure fresh keys.
      const cleanPrivateKey = process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '');
      // Be careful not to double strip quotes if the user put them in .env, handled basic cleanup

      // Use existing project ID or try to get it? The user usually provides GOOGLE_CLOUD_PROJECT alongside keys.
      // If not, we might be blocked. But let's assume GOOGLE_CLOUD_PROJECT is set or we use the fallback.

      const credentials = {
        type: "service_account",
        project_id: projectId || process.env.GOOGLE_CLOUD_PROJECT, // might be undefined here if we fell through
        private_key_id: process.env.GCP_PRIVATE_KEY_ID || "unknown",
        private_key: cleanPrivateKey,
        client_email: process.env.GCP_CLIENT_EMAIL,
        client_id: process.env.GCP_CLIENT_ID || "unknown",
        // other fields usually not strictly required for auth lib to pick up core identity
      };

      // We need projectId to be valid for the credentials file usually
      if (!credentials.project_id) {
        console.warn("⚠️ Cannot generate temp credential file without project_id");
      } else {
        fs.writeFileSync(tempKeyPath, JSON.stringify(credentials, null, 2));
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
        console.log(`ℹ️ Generated temp credentials file at ${tempKeyPath}`);

        if (!projectId) {
          projectId = credentials.project_id;
          console.log(`ℹ️ Inferred project_id from raw keys: ${projectId}`);
        }
      }
    } catch (err) {
      console.error("❌ Failed to generate temp credentials from raw env vars", err);
    }
  }

  // Final check
  if (!projectId) {
    // Last ditch: check manual keys again for project_id? 
    // We tried everything.
    throw new Error("GOOGLE_CLOUD_PROJECT is not set and could not be inferred from credentials");
  }

  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: location,
  });
};

/**
 * Check if Vertex AI is adequately configured to attempt generation.
 * This helper avoids duplicating the detection logic in the main service.
 */
export function isVertexAIConfigured(): boolean {
  if (process.env.GOOGLE_CLOUD_PROJECT) return true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) return true;
  if (fs.existsSync(path.resolve(process.cwd(), "trayve-website-service-account.json"))) return true;
  // Check for raw keys
  if (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY) return true;
  return false;
}

export async function generateImageVertex(input: VertexGenerationInput): Promise<VertexGenerationResult> {
  const { referenceImageUrls, prompt, aspectRatio = "1:1" } = input;
  const vertexAI = getVertexAIClient();

  // 1. Prepare Reference Images (Fetch & Convert to Base64)
  const parts: any[] = [];
  if (referenceImageUrls && referenceImageUrls.length > 0) {
    // Limit to 14 images
    const limit = Math.min(referenceImageUrls.length, 14);
    for (const url of referenceImageUrls.slice(0, limit)) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = response.headers.get("content-type") || "image/png";

        parts.push({
          inlineData: { mimeType, data: base64 },
        });
      } catch (err) {
        console.warn("Failed to process reference image", url, err);
      }
    }
  }

  // 2. Add Prompt
  parts.push({ text: prompt });

  // 3. Normalize Aspect Ratio (e.g., 9x16 -> 9:16)
  const normalizedRatio = aspectRatio.replace(/[×xX]/g, ':');

  console.log("🚀 Calling Vertex AI (Gemini 3 Pro Image Preview)...");

  // 4. Call Model
  // User explicitly confirmed: 'gemini-3-pro-image-preview' is the correct model name (despite 404 earlier).
  // We must trust the user's intent over the error message.
  const response = await vertexAI.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE as any],
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ],
      imageConfig: {
        // @ts-ignore
        aspectRatio: normalizedRatio,
        imageSize: "2K",
      },
    },
  });

  // 5. Extract Image
  let imageBase64;
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        imageBase64 = part.inlineData.data;
        break;
      }
    }
  }

  if (!imageBase64) {
    console.error("❌ Vertex AI Response Missing Image Data.");
    console.error("--- DEBUG: VERTEX RESPONSE METADATA ---");
    // Only log essential metadata, avoiding full response which might contain large base64 echoes
    console.error(JSON.stringify({
      finishReason: candidate?.finishReason,
      safetyRatings: candidate?.safetyRatings,
      citationMetadata: candidate?.citationMetadata,
    }, null, 2));

    // Check for safety finish reason
    if (candidate?.finishReason) {
      console.error(`⚠️ Finish Reason: ${candidate.finishReason}`);
    }
    if (candidate?.safetyRatings) {
      console.error("🛡️ Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
    }
    console.error("-----------------------------------");

    throw new Error(`No image data found in Vertex AI response (Finish Reason: ${candidate?.finishReason || 'Unknown'})`);
  }

  return {
    image: `data:image/png;base64,${imageBase64}`,
    provider: "vertex-ai"
  };
}
