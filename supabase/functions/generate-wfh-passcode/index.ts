// VorldX Edge: generate-wfh-passcode {request_id, request_date} — generator is always the verified caller.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, getCaller, json, serviceClient, sha256Hex } from "../_shared/guards.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json();
    const sb = serviceClient();
    const caller = await getCaller(sb, req);
    if (!caller) return json({ error: "UNAUTHENTICATED" }, 401);
    const raw = String(Math.floor(100000 + Math.random() * 900000));
    const hash = await sha256Hex(raw);
    const exp = new Date(`${b.request_date}T23:59:59Z`).toISOString();
    const { data, error } = await sb.rpc("generate_wfh_passcode", {
      p_request_id: b.request_id, p_generated_by: caller.id, p_passcode_hash: hash, p_expires_at: exp, p_passcode_display: raw,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ passcode_id: data, passcode: raw, expires_at: exp });
  } catch (e) { return json({ error: String(e) }, 500); }
});
