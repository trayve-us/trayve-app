import { supabaseAdmin } from "../storage/supabase.server";

// =============================================
// TYPE DEFINITIONS
// =============================================

export interface BackgroundResource {
  id: string;
  name: string;
  url: string; // Public URL
  thumbnail_url?: string;
  prompt?: string; // AI Generation Prompt
  category?: string;
  created_at: string;
}

export interface ThemeResource {
  id: string;
  name: string;
  preview_url: string; // Public URL
  description?: string;
  prompt?: string; // AI Generation Prompt
  created_at: string;
}

export interface AngleResource {
  id: string;
  name: string;
  angle_type: 'top' | 'bottom' | 'full';
  image_url: string; // Public URL or icon path
  prompt?: string; // AI Generation Prompt
  created_at: string;
}

// =============================================
// HELPER FOR PUBLIC URL
// =============================================

function getPublicUrl(path: string | null, bucket: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path; // Already a full URL

  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

// =============================================
// SERVICE FUNCTIONS
// =============================================

/**
 * Fetch Shop Ready Backgrounds
 */
export async function getShopReadyBackgrounds(): Promise<BackgroundResource[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('shopready_backgrounds')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching shopready_backgrounds:", error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.title || item.name || 'Untitled Background',
      url: item.image_url || getPublicUrl(item.storage_path, 'backgrounds'),
      thumbnail_url: item.image_url || getPublicUrl(item.storage_path, 'backgrounds'),
      prompt: item.prompt,
      category: item.category || 'Shop Ready',
      created_at: item.created_at
    }));
  } catch (err) {
    console.error("Unexpected error in getShopReadyBackgrounds:", err);
    return [];
  }
}

/**
 * Fetch Post Ready Backgrounds
 */
export async function getPostReadyBackgrounds(): Promise<BackgroundResource[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('postready_backgrounds')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching postready_backgrounds:", error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.title || item.name || 'Untitled Background',
      url: item.image_url || getPublicUrl(item.storage_path, 'backgrounds'),
      thumbnail_url: item.image_url || getPublicUrl(item.storage_path, 'backgrounds'),
      prompt: item.prompt,
      category: item.category || 'Post Ready',
      created_at: item.created_at
    }));
  } catch (err) {
    console.error("Unexpected error in getPostReadyBackgrounds:", err);
    return [];
  }
}

/**
 * Fetch Themes (Shared)
 */
export async function getThemes(): Promise<ThemeResource[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('canvas_themes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching canvas_themes:", error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.title || item.name || 'Untitled Theme',
      preview_url: item.preview_url || item.image_url || getPublicUrl(item.storage_path, 'themes'),
      description: item.description,
      prompt: item.prompt,
      created_at: item.created_at
    }));
  } catch (err) {
    console.error("Unexpected error in getThemes:", err);
    return [];
  }
}

/**
 * Fetch Angles (Shared)
 */
export async function getAngles(): Promise<AngleResource[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('canvas_angles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching canvas_angles:", error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name || item.angle_type || 'Untitled Angle', // Fallback if name is missing
      angle_type: item.angle_type,
      image_url: item.image_url || item.icon_url || getPublicUrl(item.storage_path, 'assets'),
      prompt: item.prompt,
      created_at: item.created_at
    }));
  } catch (err) {
    console.error("Unexpected error in getAngles:", err);
    return [];
  }
}
