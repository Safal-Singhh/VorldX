// VorldX Edge: submit-feedback-review {company_id, subject_employee_id, period_start, period_end, comments, scores} — reviewer is always the verified caller.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, getCaller, json, serviceClient } from "../_shared/guards.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json();
    const sb = serviceClient();
    const caller = await getCaller(sb, req);
    if (!caller) return json({ error: "UNAUTHENTICATED" }, 401);
    const { data, error } = await sb.rpc("submit_feedback", {
      p_company_id: b.company_id,
      p_subject_employee_id: b.subject_employee_id,
      p_reviewer_user_id: caller.id,
      p_period_start: b.period_start,
      p_period_end: b.period_end,
      p_comments: b.comments ?? "",
      p_scores: b.scores,
    });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  } catch (e) { return json({ error: String(e) }, 500); }
});
