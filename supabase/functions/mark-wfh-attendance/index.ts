// VorldX Edge: mark-wfh-attendance {passcode, employee_id?} — caller-bound; returns the RPC result directly.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, getCaller, json, resolveCallerEmployee, serviceClient, sha256Hex } from "../_shared/guards.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json();
    const sb = serviceClient();
    const caller = await getCaller(sb, req);
    if (!caller) return json({ error: "UNAUTHENTICATED" }, 401);
    const { emp, mismatch } = await resolveCallerEmployee(sb, caller.id, b.employee_id);
    if (mismatch) return json({ error: "EMPLOYEE_MISMATCH" }, 403);
    if (!emp) return json({ error: "EMPLOYEE_NOT_FOUND" }, 403);
    const hash = await sha256Hex(String(b.passcode ?? ""));
    const { data, error } = await sb.rpc("mark_wfh_attendance", { p_employee_id: emp.id, p_passcode_hash: hash });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  } catch (e) { return json({ error: String(e) }, 500); }
});
