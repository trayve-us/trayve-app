/**
 * Server-side proxy for Trayve backend API calls
 * Bypasses CORS restrictions by making requests server-side
 * Includes secure authentication via API key
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";

const TRAYVE_BACKEND_URL = process.env.BACKEND_API_URL || "https://trayve.app";
const API_KEY = process.env.TRAYVE_INTERNAL_API_KEY;

if (!API_KEY) {
  console.warn("⚠️  TRAYVE_INTERNAL_API_KEY not set - API requests may fail");
}

/**
 * GET /api/proxy/models - Proxy GET requests to Trayve backend
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") || "/api/models/base-models";
  
  try {
    const targetUrl = `${TRAYVE_BACKEND_URL}${endpoint}${url.search.replace('?endpoint=' + endpoint, '')}`;
    
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY || "",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });

    if (!response.ok) {
      console.error(`❌ Backend API error: ${response.status} ${response.statusText}`);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error("❌ Proxy error:", error);
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Proxy request failed" 
      },
      { status: 500 }
    );
  }
};

/**
 * POST /api/proxy/models - Proxy POST requests to Trayve backend
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") || "/api/models/base-models";
  
  try {
    const body = await request.json();
    const targetUrl = `${TRAYVE_BACKEND_URL}${endpoint}`;
    
    console.log(`🔄 Proxying request to: ${targetUrl}`);
    console.log(`📦 Request body:`, body);
    
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY || "",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      body: JSON.stringify(body),
    });

    console.log(`📡 Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend error (${response.status}):`, errorText.substring(0, 500));
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Backend response:`, { success: data.success, count: data.count || data.models?.length || 0 });
    
    return json(data);
  } catch (error) {
    console.error("❌ Proxy error:", error);
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Proxy request failed" 
      },
      { status: 500 }
    );
  }
};
