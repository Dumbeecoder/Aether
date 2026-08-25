import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged write access, server-only (the `server-only` import throws a
 * build error if this module is ever pulled into a client bundle). Used
 * exclusively by API routes that have already independently verified
 * on-chain state (see app/api/jobs/route.ts) — this client is never handed
 * anything a browser claims without that verification happening first.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
