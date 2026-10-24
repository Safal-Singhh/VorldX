// VorldX Edge: review-wfh-request {request_id, decision, notes} — reviewer is always the verified caller.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, getCaller, json, serviceClient } from "../_shared/guards.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json();
    const sb = serviceClient();
    const caller = await getCaller(sb, req);
    if (!caller) return json({ error: "UNAUTHENTICATED" }, 401);
    const { error } = await sb.rpc("review_wfh_request", { p_request_id: b.request_id, p_reviewer_user_id: caller.id, p_decision: b.decision, p_notes: b.notes ?? null });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
