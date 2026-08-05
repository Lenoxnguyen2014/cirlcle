import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Used only for Realtime subscriptions. All reads/writes go through the
// backend API (boardClient.ts) so AI/extraction logic stays server-side.
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
