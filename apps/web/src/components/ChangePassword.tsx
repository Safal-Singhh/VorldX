import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Field } from "./ui";

// Self-service password change for signed-in users (Admin & HR profiles).
// Verifies the current password first (fresh re-auth), then updates it.
export function ChangePassword() {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setMsg("");
    if (!cur) { setErr("Enter your current password."); return; }
    if (pw.length < 8) { setErr("New password must be at least 8 characters."); return; }
    if (pw !== confirm) { setErr("New passwords don't match."); return; }
    if (pw === cur) { setErr("New password must be different from the current password."); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) { setErr("Session expired. Please log in again."); return; }
      const { error: ve } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (ve) { setErr("Current password is incorrect."); return; }
      const { error: ue } = await supabase.auth.updateUser({ password: pw });
      if (ue) { setErr(ue.message); return; }
      setMsg("Password updated.");
      setCur(""); setPw(""); setConfirm("");
    } finally { setBusy(false); }
  };

  return (
    <form className="glass p-5 grid gap-3 max-w-md mt-4" onSubmit={submit}>
      <div className="font-semibold text-sm">Change password</div>
      <Field label="Current password"><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label="New password"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <Field label="Confirm new password"><input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      {err && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{err}</div>}
      {msg && <div className="text-sm" style={{ color: "var(--vx-success)" }}>{msg}</div>}
      <button className="btn-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>
  );
}
