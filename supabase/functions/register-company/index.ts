// VorldX Edge: register-company -> Auth user + create_company_with_admin
// POST {company_name, slug, timezone, admin_name, admin_email, password, redirect_to?}
// The admin account is created unconfirmed; a confirmation email is sent when the
// project mailer (SMTP) is configured. If the RPC fails, the half-created account
// is deleted so the email address is not permanently stuck.
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
    const redirectTo = typeof b.redirect_to === "string" && /^https?:\/\//.test(b.redirect_to) ? b.redirect_to : undefined;
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, service);
    const { data: u, error: e1 } = await sb.auth.admin.createUser({
      email: b.admin_email, password: b.password, email_confirm: false,
      user_metadata: { full_name: b.admin_name },
    });
    if (e1) return Response.json({ error: e1.message }, { status: 400, headers: corsHeaders });
    const { data, error: e2 } = await sb.rpc("create_company_with_admin", {
      p_user_id: u.user.id, p_company_name: b.company_name,
      p_slug: b.slug, p_timezone: b.timezone ?? "Asia/Kolkata", p_admin_name: b.admin_name,
    });
    if (e2) {
      await sb.auth.admin.deleteUser(u.user.id);
      return Response.json({ error: e2.message }, { status: 400, headers: corsHeaders });
    }
    // Confirmation email (best effort — never blocks signup if the mailer fails).
    let confirmationEmailSent = false;
    try {
      const { error: mailErr } = await sb.auth.resend({
        type: "signup", email: b.admin_email,
        ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
      });
      confirmationEmailSent = !mailErr;
    } catch { /* ignore */ }
    return Response.json({ company_id: data, user_id: u.user.id, confirmation_email_sent: confirmationEmailSent }, { headers: corsHeaders });
  } catch (e) { return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders }); }
});
