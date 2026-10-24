import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { Field } from "../components/ui";
import { AmbientBackground } from "../components/ambient";
import { useAuth } from "../lib/auth";

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(((loc.state as { notice?: string } | null)?.notice) ?? "");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setInfo(""); setNeedsConfirm(false); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if ((error.message ?? "").toLowerCase().includes("not confirmed")) {
        setErr("Your email isn't confirmed yet. Check your inbox for the confirmation link.");
        setNeedsConfirm(true);
      } else {
        setErr("Incorrect email or password. Contact your Admin if you need help.");
      }
      setBusy(false); return;
    }
    await refresh();
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    const { data: mems } = await supabase.from("company_memberships").select("role").eq("user_id", uid!).eq("status", "active").limit(1);
    const role = (mems?.[0] as { role?: string } | undefined)?.role;
    setBusy(false);
    nav(role === "admin" ? "/admin/dashboard" : role === "hr" ? "/hr/dashboard" : "/");
  };

  const resendConfirm = async () => {
    setInfo(""); setErr("");
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + "/login" } });
    if (error) setErr(`Could not resend the email: ${error.message}`);
    else setInfo("Confirmation email sent. Check your inbox.");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <AmbientBackground />
      <motion.form
        className="glass p-6 w-full max-w-md grid gap-3 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={go}>
        <h1 className="font-bold text-lg">Sign in</h1>
        <Field label="Work email"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{err}</div>}
        {needsConfirm && <button type="button" className="text-xs underline opacity-80 self-start" onClick={resendConfirm}>Resend confirmation email</button>}
        {info && <div className="text-sm" style={{ color: "var(--vx-success)" }}>{info}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <div className="flex justify-between text-xs"><Link className="underline opacity-70" to="/forgot-password">Forgot password?</Link><Link className="underline opacity-70" to="/company/signup">Create company</Link></div>
      </motion.form>
    </div>
  );
}

export function Forgot() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    setBusy(false);
    setMsg(error ? error.message : "If this email belongs to a company account, a reset link was sent. Use the newest email: each new request cancels the previous link.");
  };
  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <AmbientBackground />
      <motion.form
        className="glass p-6 w-full max-w-md grid gap-3 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={send}>
        <h1 className="font-bold">Password recovery</h1>
        <Field label="Work email"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        {msg && <div className="text-sm">{msg}</div>}
      </motion.form>
    </div>
  );
}
