/**
 * API Client for calling Trayve main app endpoints
 * This proxies requests to your existing Next.js API routes
 */

const TRAYVE_API_URL = process.env.TRAYVE_API_URL || 'http://localhost:3000';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Generic API caller
 */
async function callTrayveApi<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = `${TRAYVE_API_URL}${endpoint}`;
  console.log(`📡 Calling Trayve API: ${method} ${url}`);

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ API Error: ${response.status} ${error}`);
    throw new Error(`API Error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Studio API - Image Generation
 */
export const studioApi = {
  // Create new project
  createProject: (data: { title: string; shopify_product_id?: string }) =>
    callTrayveApi('/api/projects', { method: 'POST', body: data }),

  // Get project results
  getProjectResults: (projectId: string) =>
    callTrayveApi(`/api/projects/${projectId}/results`),

  // Remove background
  removeBackground: (imageId: string, imageUrl: string, projectId: string) =>
    callTrayveApi('/api/remove-background', {
      method: 'POST',
      body: { imageId, imageUrl, projectId },
    }),

  // Get project details
  getProject: (projectId: string) =>
    callTrayveApi(`/api/projects-simple?projectId=${projectId}`),

  // Update project name
  updateProject: (projectId: string, title: string) =>
    callTrayveApi(`/api/projects-simple?projectId=${projectId}`, {
      method: 'PATCH',
      body: { title },
    }),
};

/**
 * User API
 */
export const userApi = {
  // Get subscription status
  getSubscription: () =>
    callTrayveApi('/api/user/subscription-status'),

  // Get user profile
  getProfile: () =>
    callTrayveApi('/api/user/profile'),
};

/**
 * Subscription Plans API
 */
export const subscriptionApi = {
  // Get all subscription plans
  getPlans: () =>
    callTrayveApi('/api/subscription-plans'),
};

// Export all APIs
export const trayveApi = {
  studio: studioApi,
  user: userApi,
  subscription: subscriptionApi,
};
