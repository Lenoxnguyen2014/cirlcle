// src/lib/supabaseUser.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// A Supabase client authenticated as the calling user (their JWT is sent on
// every request), so RLS evaluates auth.uid()/auth.role() as that user
// rather than bypassing RLS entirely like the service-role client does.
// Build one per request from req.accessToken (set by requireAuth) — never
// share/cache an instance across requests/users.
export function createUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
