/**
 * Extended database types that complement the generated Supabase types
 *
 * These types handle cases where the generated types are incomplete or
 * where we need more flexible types for inserts.
 */

import { Database } from '@/integrations/supabase/types';

// Re-export the base Database type
export type { Database };

// Extended manual_logs insert type with metadata support
export interface ManualLogInsert extends Database['public']['Tables']['manual_logs']['Insert'] {
  metadata?: Record<string, any>;
}

// Extended health_metrics insert type for better type safety
export interface HealthMetricInsert extends Database['public']['Tables']['health_metrics']['Insert'] {
  metadata?: Record<string, any> | null;
}

// Extended integrations insert type
export interface IntegrationInsert extends Database['public']['Tables']['integrations']['Insert'] {
  id?: string;
  user_id: string;
  provider: string;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  is_connected: boolean;
  last_sync_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Extended integrations update type
export interface IntegrationUpdate {
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  is_connected?: boolean;
  last_sync_at?: string | null;
  updated_at?: string;
}
