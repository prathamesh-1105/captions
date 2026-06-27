import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environmental keys from the root .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey || supabaseServiceRoleKey.includes('YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE')) {
  console.warn('CaptionFlow AI Backend: Supabase SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unconfigured in server env.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
export default supabase;
