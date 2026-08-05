// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Bypasses RLS — used only for trusted server-side writes to the board tables.
// Never expose this key or this client to the frontend.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
