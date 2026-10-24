import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { Field } from "../components/ui";
import { AmbientBackground } from "../components/ambient";

// Handles both password-recovery links and invite links.
// Supabase puts the session tokens in the URL fragment (#access_token=…&type=recovery|invite)
// and supabase-js picks them up automatically (detectSessionInUrl). We only need to wait
// for that session, then let the user choose a password via auth.updateUser.

type Phase = "checking" | "ready" | "done" | "expired" | "no-session";

function urlParams(): URLSearchParams {
  const merged = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (!merged.has(k)) merged.set(k, v);
  });
  return merged;
}

export function ResetPassword() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [linkType] = useState(() => urlParams().get("type") ?? "recovery");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = urlParams();
    const linkError = p.get("error_code") ?? p.get("error");
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) setPhase("ready");
      else if (linkError) setPhase("expired");
      else setPhase("no-session");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setPhase("ready");
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (pw !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await supabase.auth.signOut();
    setPhase("done");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <AmbientBackground />
      <motion.div
        className="glass p-6 w-full max-w-md grid gap-3 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <h1 className="font-bold text-lg">{phase === "expired" ? "Link no longer valid" : linkType === "invite" ? "Welcome to VorldX" : "Set a new password"}</h1>

        {phase === "checking" && <p className="text-sm" style={{ color: "var(--vx-text-secondary)" }}>Verifying your link…</p>}

        {phase === "expired" && (
          <>
            <p className="text-sm" style={{ color: "var(--vx-text-secondary)" }}>This link is no longer valid. Email links work only once, and sending a new one cancels the previous email. Request one new link and use the newest email.</p>
            <Link className="btn-primary text-center" to="/forgot-password">Request a new link</Link>
          </>
        )}

        {phase === "no-session" && (
          <>
            <p className="text-sm" style={{ color: "var(--vx-text-secondary)" }}>Open this page from the link in your email to set your password.</p>
            <Link className="text-xs underline opacity-70" to="/login">Back to sign in</Link>
          </>
        )}

        {phase === "done" && (
          <>
            <p className="text-sm" style={{ color: "var(--vx-success)" }}>Your password is set. Log in with your new password.</p>
            <button className="btn-primary" onClick={() => nav("/login", { state: { notice: "Password set. Welcome back." } })}>Go to sign in</button>
          </>
        )}

        {phase === "ready" && (
          <form className="grid gap-3" onSubmit={submit}>
            <p className="text-sm" style={{ color: "var(--vx-text-secondary)" }}>
              {linkType === "invite"
                ? "Your account is ready. Choose a password to finish setting it up."
                : "Choose a new password for your account."}
            </p>
            <Field label="New password"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Field label="Confirm new password"><input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
            {err && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{err}</div>}
            <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
