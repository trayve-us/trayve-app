/**
 * Storage Upload API
 * POST /api/storage/upload
 * 
 * Uploads a file to Supabase Storage and returns the public URL
 * 
 * Request Body (FormData):
 * {
 *   file: File;
 *   bucket: string;
 *   path: string;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   url?: string;
 *   path?: string;
 *   error?: string;
 * }
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { uploadToStorage } from "../lib/storage/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate Shopify request
    const { session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      return json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = formData.get("bucket") as string;
    const path = formData.get("path") as string;

    if (!file) {
      return json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!bucket) {
      return json(
        { success: false, error: "Bucket name is required" },
        { status: 400 }
      );
    }

    if (!path) {
      return json(
        { success: false, error: "File path is required" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const result = await uploadToStorage(bucket, path, buffer, file.type);

    if (!result.success) {
      console.error("❌ Upload failed:", result.error);
      return json(
        { success: false, error: result.error || "Upload failed" },
        { status: 500 }
      );
    }

    console.log("✅ File uploaded successfully:", result.url);

    return json({
      success: true,
      url: result.url,
      path: result.path,
    });
  } catch (error: any) {
    console.error("❌ Error in storage upload:", error);

    return json(
      {
        success: false,
        error: error.message || "Failed to upload file",
      },
      { status: 500 }
    );
  }
};
