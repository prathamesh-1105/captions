import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY_HERE')) {
  console.warn('CaptionFlow AI: Supabase VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or unconfigured in .env.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
