export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      food_entries: {
        Row: {
          id: string;
          user_id: string;
          food_name: string;
          brand: string | null;
          meal_type: string;
          calories: number;
          carbs: number;
          fat: number;
          protein: number;
          fiber: number | null;
          sodium: number | null;
          contains_dairy: boolean;
          contains_gluten: boolean;
          contains_caffeine: boolean;
          logged_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_name: string;
          brand?: string | null;
          meal_type: string;
          calories: number;
          carbs: number;
          fat: number;
          protein: number;
          fiber?: number | null;
          sodium?: number | null;
          contains_dairy?: boolean;
          contains_gluten?: boolean;
          contains_caffeine?: boolean;
          logged_at: string;
          source: string;
          created_at?: string;
        };
        Update: {
          food_name?: string;
          brand?: string | null;
          meal_type?: string;
          calories?: number;
          carbs?: number;
          fat?: number;
          protein?: number;
          fiber?: number | null;
          sodium?: number | null;
          contains_dairy?: boolean;
          contains_gluten?: boolean;
          contains_caffeine?: boolean;
          logged_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          height_cm: number | null;
          sex: string | null;
          step_goal: number | null;
          sleep_goal: number | null;
          weight_goal: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          sex?: string | null;
          step_goal?: number | null;
          sleep_goal?: number | null;
          weight_goal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          sex?: string | null;
          step_goal?: number | null;
          sleep_goal?: number | null;
          weight_goal?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      health_metrics: {
        Row: {
          id: string;
          user_id: string;
          metric_type: string;
          value: number;
          unit: string;
          source: string;
          recorded_at: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_type: string;
          value: number;
          unit: string;
          source: string;
          recorded_at: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          metric_type?: string;
          value?: number;
          unit?: string;
          source?: string;
          recorded_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      manual_logs: {
        Row: {
          id: string;
          user_id: string;
          log_type: string;
          category: string | null;
          value: string;
          severity: number | null;
          notes: string | null;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_type: string;
          category?: string | null;
          value: string;
          severity?: number | null;
          notes?: string | null;
          logged_at: string;
          created_at?: string;
        };
        Update: {
          log_type?: string;
          category?: string | null;
          value?: string;
          severity?: number | null;
          notes?: string | null;
          logged_at?: string;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          is_connected: boolean;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          is_connected?: boolean;
          last_sync_at?: string | null;
        };
        Update: {
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          is_connected?: boolean;
          last_sync_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_insights: {
        Row: {
          id: string;
          user_id: string;
          insight_type: string;
          title: string;
          description: string;
          confidence: number | null;
          related_metrics: string[] | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          insight_type: string;
          title: string;
          description: string;
          confidence?: number | null;
          related_metrics?: string[] | null;
          metadata?: Json;
        };
        Update: {
          insight_type?: string;
          title?: string;
          description?: string;
          confidence?: number | null;
          related_metrics?: string[] | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      medication_logs: {
        Row: {
          id: string;
          user_id: string;
          took_medication: boolean;
          notes: string | null;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          took_medication: boolean;
          notes?: string | null;
          logged_at?: string;
          created_at?: string;
        };
        Update: {
          took_medication?: boolean;
          notes?: string | null;
          logged_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          external_id: string | null;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          is_all_day: boolean;
          location: string | null;
          event_type: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          external_id?: string | null;
          title: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          is_all_day?: boolean;
          location?: string | null;
          event_type?: string | null;
          metadata?: Json;
        };
        Update: {
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          is_all_day?: boolean;
          location?: string | null;
          event_type?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type HealthMetric = Database['public']['Tables']['health_metrics']['Row'];
export type ManualLog = Database['public']['Tables']['manual_logs']['Row'];
export type Integration = Database['public']['Tables']['integrations']['Row'];
export type AIInsight = Database['public']['Tables']['ai_insights']['Row'];
export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
export type FoodEntry = Database['public']['Tables']['food_entries']['Row'];
