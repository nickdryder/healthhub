import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pxphayzjpfymnunxskan.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cGhheXpqcGZ5bW51bnhza2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjA1NzksImV4cCI6MjA4MDYzNjU3OX0.0sgBfiN_qV172Lzor84QE_emCUnoXDvaFGzOR6T0cPg';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
