// VorldX shared Edge helpers: verified caller resolution + CORS.
// Every sensitive Edge function must resolve the caller from the JWT and use
// the caller's own IDs — never trust actor/employee ids from the request body.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Verified caller from the request's Authorization JWT. Null for missing/invalid tokens (anon key included). */
export async function getCaller(sb: SupabaseClient, req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user ?? null;
}

/**
 * The caller's own active employee record(s). Callers may only act for themselves:
 * if they name an employee id, it must be one of their own records.
 */
export async function resolveCallerEmployee(
  sb: SupabaseClient,
  userId: string,
  requestedId?: string | null,
): Promise<{ emp: { id: string; company_id: string } | null; mismatch: boolean }> {
  const { data } = await sb.from("employees").select("id, company_id").eq("user_id", userId).eq("is_active", true);
  const emps = (data ?? []) as { id: string; company_id: string }[];
  if (emps.length === 0) return { emp: null, mismatch: false };
  if (requestedId) {
    const hit = emps.find((e) => e.id === requestedId);
    return hit ? { emp: hit, mismatch: false } : { emp: null, mismatch: true };
  }
  return { emp: emps[0], mismatch: false };
}

export async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
