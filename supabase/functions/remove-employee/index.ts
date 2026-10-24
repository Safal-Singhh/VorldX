// VorldX Edge: remove-employee (hr/admin, employee targets only enforced in SQL). Body {employee_id}
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const b = await req.json();
    if (!b.employee_id) return Response.json({ error: "EMPLOYEE_REQUIRED" }, { status: 400, headers: corsHeaders });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user: caller } } = await sb.auth.getUser(jwt);
    if (!caller) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: corsHeaders });
    const { data: target } = await sb.from("employees").select("user_id").eq("id", b.employee_id).single();
    const { error: rpcErr } = await sb.rpc("remove_employee", { p_employee_id: b.employee_id, p_actor_user_id: caller.id });
    if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 400, headers: corsHeaders });
    const targetUid = (target as { user_id?: string } | null)?.user_id;
    if (targetUid) {
      const { error: delErr } = await sb.auth.admin.deleteUser(targetUid);
      if (delErr) return Response.json({ error: `Data removed but login delete failed: ${delErr.message}` }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (e) { return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders }); }
});
