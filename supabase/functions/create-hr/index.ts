// VorldX Edge: create-hr (admin-only).
// Body {company_id, full_name, email, department, password?, redirect_to?}
//  - password set   -> account created with the temporary password + confirmation email
//  - password empty -> invite email; HR sets their own password via the link
// Any failure after login creation rolls the account back (no orphan auth users).
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
    const fullName = String(b.full_name ?? "").trim();
    const email = String(b.email ?? "").trim();
    const department = String(b.department ?? "People Ops").trim() || "People Ops";
    const password = String(b.password ?? "");
    const redirectTo = typeof b.redirect_to === "string" && /^https?:\/\//.test(b.redirect_to) ? b.redirect_to : undefined;
    if (!b.company_id) return Response.json({ error: "COMPANY_REQUIRED" }, { status: 400, headers: corsHeaders });
    if (fullName.length < 2) return Response.json({ error: "FULL_NAME_REQUIRED" }, { status: 400, headers: corsHeaders });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "EMAIL_INVALID" }, { status: 400, headers: corsHeaders });
    if (password && password.length < 8) return Response.json({ error: "PASSWORD_MIN_8" }, { status: 400, headers: corsHeaders });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await sb.auth.getUser(jwt);
    if (!caller) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: corsHeaders });
    const { data: mem } = await sb.from("company_memberships").select("role").eq("company_id", b.company_id).eq("user_id", caller.id).eq("status", "active").single();
    if ((mem as { role?: string } | null)?.role !== "admin") return Response.json({ error: "ADMIN_ONLY" }, { status: 403, headers: corsHeaders });

    // 1) Create the login: temp password (unconfirmed) or invite email.
    let uid: string;
    let invited = false;
    if (password) {
      const { data: created, error: e1 } = await sb.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: fullName } });
      if (e1) return Response.json({ error: e1.message }, { status: 400, headers: corsHeaders });
      uid = created.user.id;
    } else {
      const { data: inv, error: e1 } = await sb.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, ...(redirectTo ? { redirectTo } : {}) });
      if (e1) return Response.json({ error: e1.message }, { status: 400, headers: corsHeaders });
      uid = inv.user.id;
      invited = true;
    }

    // 2) Records — any failure rolls the login back.
    await sb.from("profiles").upsert({ id: uid, full_name: fullName });
    const { data: shift } = await sb.from("shifts").select("id").eq("company_id", b.company_id).limit(1).single();
    const code = "HR-" + String(Date.now()).slice(-6);
    const { data: emp, error: e2 } = await sb.from("employees").insert({
      company_id: b.company_id, user_id: uid, employee_code: code, full_name: fullName,
      email, department, designation: "HR Executive", shift_id: (shift as { id?: string } | null)?.id ?? null,
      created_by: caller.id,
    }).select("id").single();
    if (e2) {
      await sb.auth.admin.deleteUser(uid);
      return Response.json({ error: e2.message }, { status: 400, headers: corsHeaders });
    }
    const { error: e3 } = await sb.from("company_memberships").insert({ company_id: b.company_id, user_id: uid, role: "hr", status: "active" });
    if (e3) {
      await sb.from("employees").delete().eq("id", (emp as { id: string }).id);
      await sb.auth.admin.deleteUser(uid);
      return Response.json({ error: e3.message }, { status: 400, headers: corsHeaders });
    }

    // 3) Confirmation email for the temp-password path (best effort).
    let confirmationEmailSent = false;
    if (password) {
      try {
        const { error: mailErr } = await sb.auth.resend({
          type: "signup", email,
          ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
        });
        confirmationEmailSent = !mailErr;
      } catch { /* ignore */ }
    }

    await sb.from("audit_logs").insert({ company_id: b.company_id, actor_user_id: caller.id, action: "hr.created", entity_type: "employee", entity_id: (emp as { id: string }).id });
    return Response.json({ user_id: uid, employee_id: (emp as { id: string }).id, invited, confirmation_email_sent: confirmationEmailSent }, { headers: corsHeaders });
  } catch (e) { return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders }); }
});
