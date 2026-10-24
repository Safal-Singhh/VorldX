// VorldX Edge: admin-correct-attendance {record_id, check_in, check_out, reason} — actor is always the verified caller.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, getCaller, json, serviceClient } from "../_shared/guards.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json();
    const sb = serviceClient();
    const caller = await getCaller(sb, req);
    if (!caller) return json({ error: "UNAUTHENTICATED" }, 401);
    const { error } = await sb.rpc("admin_correct_attendance", {
      p_record_id: b.record_id, p_actor_user_id: caller.id, p_check_in: b.check_in, p_check_out: b.check_out, p_reason: b.reason,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
