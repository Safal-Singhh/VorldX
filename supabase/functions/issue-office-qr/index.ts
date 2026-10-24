// VorldX Edge: issue-office-qr (18s rotation, hash-only storage, device-bound)
// POST {display_id, device_secret} -> {token, expires_at}.
// The display device holds the raw device secret (localStorage); the server stores only its
// SHA-256 hash (qr_displays.device_secret_hash). A display id alone can no longer mint tokens.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { display_id, device_secret } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const raw = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const hash = await sha256Hex(raw);
    const secretHash = device_secret ? await sha256Hex(String(device_secret)) : null;
    const expires = new Date(Date.now() + 18_000).toISOString();
    const { error } = await sb.rpc("issue_qr_session", {
      p_display_id: display_id,
      p_token_hash: hash,
      p_device_secret_hash: secretHash,
      p_expires_at: expires,
    });
    if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
    return Response.json({ token: raw, expires_at: expires, display_id }, { headers: corsHeaders });
  } catch (e) { return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders }); }
});
