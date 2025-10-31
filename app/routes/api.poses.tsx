/**
 * API Route: Get Model Poses
 * Fetches poses for a specific base model with proper filtering
 * 
 * GET /api/poses?base_model_id=uuid
 * POST /api/poses { "base_model_id": "uuid" }
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../config/shopify.server";
import { supabaseAdmin } from "../lib/storage/supabase.server";

// =============================================
// GET METHOD (Query Parameters)
// =============================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate the request
    await authenticate.admin(request);

    // Get query parameters
    const url = new URL(request.url);
    const baseModelId = url.searchParams.get('base_model_id');

    if (!baseModelId) {
      return json({
        success: false,
        error: 'base_model_id parameter is required',
      }, { status: 400 });
    }

    console.log('🔍 GET /api/poses with base_model_id:', baseModelId);

    // Fetch poses from database
    const { data: poses, error } = await supabaseAdmin
      .from('model_poses')
      .select('*')
      .eq('base_model_id', baseModelId)
      .eq('is_active', true)
      .like('supabase_path', 'poses/%') // CRITICAL: Only fetch pose images, not base model images
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database error fetching poses:', error);
      return json({
        success: false,
        error: 'Failed to fetch poses',
        details: error.message,
      }, { status: 500 });
    }

    console.log(`✅ GET fetched ${poses?.length || 0} poses for model ${baseModelId}`);

    return json({
      success: true,
      poses: poses || [],
      count: poses?.length || 0,
    });
  } catch (error) {
    console.error('❌ Error in poses API loader:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
};

// =============================================
// POST METHOD (Request Body)
// =============================================

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate the request
    await authenticate.admin(request);

    // Parse request body
    const body = await request.json();
    const { base_model_id: baseModelId, filters = {} } = body;

    if (!baseModelId) {
      return json({
        success: false,
        error: 'base_model_id is required in request body',
      }, { status: 400 });
    }

    console.log('🔍 POST /api/poses with filters:', { baseModelId, filters });

    // Build query
    let query = supabaseAdmin
      .from('model_poses')
      .select('*')
      .eq('base_model_id', baseModelId)
      .eq('is_active', true)
      .like('supabase_path', 'poses/%'); // CRITICAL: Only fetch pose images

    // Apply optional filters
    if (filters.pose_type) {
      query = query.eq('pose_type', filters.pose_type);
    }

    if (filters.name) {
      query = query.ilike('name', `%${filters.name}%`);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: poses, error } = await query;

    if (error) {
      console.error('❌ Database error fetching poses:', error);
      return json({
        success: false,
        error: 'Failed to fetch poses',
        details: error.message,
      }, { status: 500 });
    }

    console.log(`✅ POST fetched ${poses?.length || 0} poses for model ${baseModelId}`);

    return json({
      success: true,
      poses: poses || [],
      count: poses?.length || 0,
      filters: {
        base_model_id: baseModelId,
        ...filters,
      },
    });
  } catch (error) {
    console.error('❌ Error in poses API action:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
};
