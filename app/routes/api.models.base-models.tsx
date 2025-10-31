/**
 * Base Models API
 * Fetches base models with filtering (mirrors main Trayve app)
 * GET /api/models/base-models?gender=female&body_type=slim
 * POST /api/models/base-models (with JSON body filters)
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/config/shopify.server";
import { getBaseModels, type ModelFilters } from "~/lib/services/models.service";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.admin(request);

    const url = new URL(request.url);
    
    // Parse query parameters for filters
    const filters: ModelFilters = {};
    
    const gender = url.searchParams.get("gender");
    if (gender) filters.gender = gender as any;

    const bodyType = url.searchParams.get("body_type");
    if (bodyType) filters.body_type = bodyType as any;

    const isActive = url.searchParams.get("is_active");
    if (isActive !== null) filters.is_active = isActive === "true";

    const promotedOnly = url.searchParams.get("promoted_only");
    if (promotedOnly !== null) filters.promoted_only = promotedOnly === "true";

    // Fetch models
    const models = await getBaseModels(filters);

    return json({
      models,
      total: models.length,
      filters,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching base models:", error);
    return json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await authenticate.admin(request);

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Parse JSON body for filters
    const body = await request.json();
    const filters: ModelFilters = {
      gender: body.gender,
      body_type: body.body_type,
      is_active: body.is_active,
      promoted_only: body.promoted_only,
    };

    // Fetch models
    const models = await getBaseModels(filters);

    return json({
      models,
      total: models.length,
      filters,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching base models:", error);
    return json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}
