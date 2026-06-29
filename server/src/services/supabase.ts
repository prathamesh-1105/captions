import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environmental keys from the root .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL 
  || process.env.VITE_SUPABASE_URL 
  || 'https://aejxsfozuzrgnkewhpzf.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlanhzZm96dXpyZ25rZXdocHpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYxNzU1OSwiZXhwIjoyMDk3MTkzNTU5fQ.KVb901X1rVAjZmelYHyUiHqS6zkFKb9qdYUtBAB6STo';

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
export default supabase;
