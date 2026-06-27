import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safeguard initialization: if keys are missing or placeholders, export null instead of throwing and crashing the bundle
const isConfigured = 
  supabaseUrl && 
  !supabaseUrl.includes('YOUR_') && 
  supabaseAnonKey && 
  !supabaseAnonKey.includes('YOUR_');

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null as any;
export default supabase;
