import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Server-side, read-only Supabase client. Returns null when Supabase isn't
 * configured yet (e.g. local dev before `.env.local` is filled in) so pages
 * can render an honest "not connected" state instead of crashing — Phase 2
 * is the first phase that actually needs a live project, Phase 1's health
 * check deliberately never touched Supabase.
 *
 * Uses the anon key, not the service role key: these are read-only public
 * marketplace listings, and the service role key never belongs in a
 * request path that could end up in a server component's dependency graph
 * for a client bundle.
 */
export function getSupabaseReadClient(): SupabaseClient | null {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}
