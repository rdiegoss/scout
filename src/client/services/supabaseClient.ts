/**
 * Supabase client singleton for browser-side operations.
 *
 * Uses environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * configured in config.ts with sensible defaults for local development.
 *
 * Validates: Requirements 9.3, 9.4
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@shared/utils/config';

/**
 * Supabase database schema types matching the migrations.
 * Maps TypeScript types → Supabase column names (snake_case).
 */
export interface DbService {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  phone: string;
  has_whatsapp: boolean;
  whatsapp_confirmed: boolean;
  address: string;
  latitude: number;
  longitude: number;
  service_radius?: number;
  average_rating: number;
  total_ratings: number;
  registered_by?: string;
  neighborhood_score: number;
  data_source: string;
  source_id?: string;
  source_url?: string;
  imported_at?: string;
  verified_by_users: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbRating {
  id: string;
  service_id: string;
  user_id?: string;
  score: number;
  comment?: string;
  user_latitude?: number;
  user_longitude?: number;
  is_neighbor: boolean;
  helpful: number;
  created_at?: string;
}

export interface DbUser {
  id: string;
  first_name?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  manual_address?: string;
  favorite_categories?: string[];
  session_count?: number;
}

/**
 * Singleton Supabase client.
 * Safe to import in test environments — will use placeholder URL/key
 * and operations will simply fail (caught by SyncService retry logic).
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
);
