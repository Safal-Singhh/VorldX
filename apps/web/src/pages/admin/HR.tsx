import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Badge, Empty, Field, Modal, PageHeader } from "../../components/ui";
import type { Employee } from "../../lib/types";

export function AdminHR() {
  const { company } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", department: "People Ops", password: "" });
  const [msg, setMsg] = useState("");
  const [pageMsg, setPageMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Employee | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [removeMsg, setRemoveMsg] = useState("");
  const [removingBusy, setRemovingBusy] = useState(false);

  async function edgeMessage(err: unknown): Promise<string> {
    const e = err as { message?: string; context?: unknown };
    const ctx = e?.context as Response | { error?: string } | undefined;
    try {
      if (ctx instanceof Response) {
        const j = (await ctx.clone().json()) as { error?: string; message?: string };
        if (j?.error) return j.error;
        if (j?.message) return j.message;
        return `Request failed (${ctx.status})`;
      }
      if (ctx && typeof ctx === "object" && "error" in ctx && typeof (ctx as { error: unknown }).error === "string") {
        return (ctx as { error: string }).error;
      }
    } catch { /* fall through to generic message */ }
    return e?.message ?? "Request failed";
  }

  const load = async () => {
    if (!company) return;
    const { data: emps } = await supabase.from("employees").select("*").eq("company_id", company.id).order("full_name");
    const { data: mems } = await supabase.from("company_memberships").select("user_id").eq("company_id", company.id).eq("role", "hr").eq("status", "active");
    const hrIds = new Set((mems ?? []).map((m: { user_id: string }) => m.user_id));
    setRows(((emps ?? []) as Employee[]).filter((e) => e.user_id && hrIds.has(e.user_id)));
  };
  useEffect(() => { load(); }, [company]);

  const create = async () => {
    setMsg(""); setPageMsg("");
    if (form.full_name.trim().length < 2) { setMsg("Enter the HR full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setMsg("Enter a valid work email."); return; }
    if (form.password && form.password.length < 8) { setMsg("Temporary password must be at least 8 characters (or leave it empty to send an invite)."); return; }
    if (!company) { setMsg("No active company. Re-login as Admin."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hr", {
        body: { company_id: company.id, full_name: form.full_name.trim(), email: form.email.trim(), department: form.department.trim() || "People Ops", password: form.password, redirect_to: window.location.origin + "/reset-password" },
      });
      const serverErr = (data as { error?: string } | null)?.error;
      if (error || serverErr) { setMsg(serverErr ?? (await edgeMessage(error))); return; }
      const d = data as { invited?: boolean; confirmation_email_sent?: boolean } | null;
      const email = form.email.trim();
      setOpen(false); setForm({ full_name: "", email: "", department: "People Ops", password: "" }); load();
      setPageMsg(d?.invited
        ? `Invite email sent to ${email}. They'll set their own password.`
        : `HR account created for ${email}${d?.confirmation_email_sent ? ". Confirmation email sent." : "."}`);
    } finally { setBusy(false); }
  };

  const deactivate = async (e: Employee) => {
    if (!confirm(`Deactivate ${e.full_name}? History is preserved.`)) return;
    await supabase.from("employees").update({ is_active: false }).eq("id", e.id);
    if (e.user_id) await supabase.from("company_memberships").update({ status: "deactivated" }).eq("company_id", e.company_id).eq("user_id", e.user_id);
    load();
  };

  const remove = async () => {
    if (!removing) return;
    setRemoveMsg("");
    if (confirmCode.trim() !== removing.employee_code) { setRemoveMsg(`Type ${removing.employee_code} to confirm.`); return; }
    setRemovingBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("remove-employee", { body: { employee_id: removing.id } });
      const serverErr = (data as { error?: string } | null)?.error;
      if (error || serverErr) { setRemoveMsg(serverErr ?? (await edgeMessage(error))); return; }
      setRemoving(null); setConfirmCode(""); load();
    } finally { setRemovingBusy(false); }
  };

  const filtered = rows.filter((r) => (r.full_name + r.email + r.department).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="HR management" action={<button className="btn-primary" onClick={() => setOpen(true)}>Add HR</button>} />
      {pageMsg && <div className="text-sm mb-3" style={{ color: "var(--vx-success)" }}>{pageMsg}</div>}
      <input className="input mb-3" placeholder="Search HR…" value={q} onChange={(e) => setQ(e.target.value)} />
      {filtered.length === 0 ? <Empty msg="No HR accounts. Click Add HR." /> : (
        <div className="glass-strong overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left opacity-70"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Dept</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
            <tbody>{filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--vx-border)" }}>
                <td className="p-2">{r.full_name}</td><td className="p-2 mono">{r.email}</td><td className="p-2">{r.department}</td>
                <td className="p-2"><Badge tone={r.is_active ? "ok" : "muted"}>{r.is_active ? "Active" : "Inactive"}</Badge></td>
                <td className="p-2 text-right whitespace-nowrap"><button className="text-xs underline mr-3" onClick={() => deactivate(r)}>Deactivate</button><button className="text-xs underline" style={{ color: "var(--vx-danger)" }} onClick={() => { setRemoving(r); setConfirmCode(""); setRemoveMsg(""); }}>Remove</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <Modal open={open} title="Add HR" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Work email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Department"><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Temporary password" hint="Leave empty to email an invite link so HR sets their own password. If set, use at least 8 characters."><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          {msg && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{msg}</div>}
          <button className="btn-primary" disabled={busy} onClick={create}>{busy ? "Inviting…" : "Invite HR"}</button>
        </div>
      </Modal>
      <Modal open={!!removing} title="Remove HR" onClose={() => setRemoving(null)}>
        {removing && (
          <div className="grid gap-3 text-sm">
            <div style={{ color: "var(--vx-danger)" }}>Irreversible. Deletes {removing.full_name}'s login, profile, attendance, WFH/leave requests and feedback. Audit entries are preserved.</div>
            <Field label={`Type ${removing.employee_code} to confirm`}><input className="input mono" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} /></Field>
            {removeMsg && <div style={{ color: "var(--vx-danger)" }}>{removeMsg}</div>}
            <button className="btn-primary" disabled={removingBusy} onClick={remove}>{removingBusy ? "Removing…" : "Yes, remove everything"}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
