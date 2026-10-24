import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Badge, Empty, Field, Modal, PageHeader } from "../../components/ui";
import type { Employee, Shift } from "../../lib/types";

const EMPTY = { full_name: "", email: "", department: "Engineering", designation: "Associate", shift_id: "", work_type: "office", password: "" };
type RoleFilter = "all" | "admin" | "hr" | "employee" | "mine";

async function edgeMsg(err: unknown): Promise<string> {
  const e = err as { message?: string; context?: unknown };
  try {
    const ctx = e?.context as Response | undefined;
    if (ctx instanceof Response) {
      const j = (await ctx.clone().json()) as { error?: string };
      if (j?.error) return j.error;
      return `Request failed (${ctx.status})`;
    }
  } catch { /* ignore */ }
  return e?.message ?? "Request failed";
}

export function HrEmployees() {
  const { company, role, userId } = useAuth();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [rows, setRows] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState("");
  const [pageMsg, setPageMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Employee | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [removeMsg, setRemoveMsg] = useState("");
  const [removingBusy, setRemovingBusy] = useState(false);

  const load = async () => {
    if (!company) return;
    const [{ data: emps }, { data: sh }, { data: roles }] = await Promise.all([
      supabase.from("employees").select("*").eq("company_id", company.id).order("full_name"),
      supabase.from("shifts").select("*").eq("company_id", company.id),
      // Role map via SECURITY DEFINER fn: HR cannot read other membership rows directly (RLS),
      // so the direct table query would return only self and misclassify admin/HR rows.
      supabase.rpc("company_role_map", { p_company_id: company.id }),
    ]);
    setRows((emps ?? []) as Employee[]);
    setShifts((sh ?? []) as Shift[]);
    const map: Record<string, string> = {};
    ((roles ?? []) as { user_id: string; role: string }[]).forEach((m) => { map[m.user_id] = m.role; });
    setRoleByUser(map);
    if (!form.shift_id && sh?.[0]) setForm((f) => ({ ...f, shift_id: (sh[0] as Shift).id }));
  };
  useEffect(() => { load(); }, [company]);

  const canEdit = (r: Employee) => {
    if (role === "admin") return true;
    const rr = r.user_id ? roleByUser[r.user_id] : undefined;
    return rr !== "admin" && rr !== "hr"; // HR sees admin/HR rows read-only; only employee rows editable
  };

  const create = async () => {
    setMsg(""); setPageMsg("");
    if (form.full_name.trim().length < 2) { setMsg("Enter full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setMsg("Enter a valid email."); return; }
    if (form.password && form.password.length < 8) { setMsg("Temporary password must be at least 8 characters (or leave it empty to send an invite)."); return; }
    setSaving(true);
    try {
      // Same shape as Admin Add HR: creates Auth login + linked record, so the employee can log in immediately.
      const { data, error } = await supabase.functions.invoke("create-employee", {
        body: {
          company_id: company!.id, full_name: form.full_name.trim(), email: form.email.trim(),
          department: form.department, designation: form.designation,
          shift_id: form.shift_id || null, work_type: form.work_type, password: form.password,
          redirect_to: window.location.origin + "/reset-password",
        },
      });
      const serverErr = (data as { error?: string } | null)?.error;
      if (error || serverErr) { setMsg(serverErr ?? (await edgeMsg(error))); return; }
      const d = data as { invited?: boolean; confirmation_email_sent?: boolean } | null;
      const email = form.email.trim();
      setOpen(false); setForm(EMPTY); load();
      setPageMsg(d?.invited
        ? `Invite email sent to ${email}. They'll set their own password.`
        : `Employee account created for ${email}${d?.confirmation_email_sent ? ". Confirmation email sent." : "."}`);
    } finally { setSaving(false); }
  };

  const toggle = async (e: Employee) => {
    if (!canEdit(e)) return;
    if (!confirm(`${e.is_active ? "Deactivate" : "Reactivate"} ${e.full_name}? History is preserved.`)) return;
    const { error } = await supabase.from("employees").update({ is_active: !e.is_active }).eq("id", e.id);
    if (error) { alert(error.message); return; }
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
      if (error || serverErr) { setRemoveMsg(serverErr ?? (await edgeMsg(error))); return; }
      setRemoving(null); setConfirmCode(""); load();
    } finally { setRemovingBusy(false); }
  };

  const roleOf = (r: Employee) => (r.user_id ? (roleByUser[r.user_id] ?? "employee") : "employee");
  const filtered = rows.filter((r) => {
    if (!(r.full_name + r.email + r.employee_code + r.department).toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter === "all") return true;
    const employeeRole = roleOf(r);
    if (roleFilter === "admin") return employeeRole === "admin";
    if (roleFilter === "hr") return employeeRole === "hr";
    if (roleFilter === "employee") return employeeRole === "employee";
    return employeeRole === "employee" && r.created_by === userId;
  });

  return (
    <div>
      <PageHeader title="Employees" sub="HR can deactivate or remove employees. Admin and HR accounts are managed by Admin." action={<button className="btn-primary" onClick={() => setOpen(true)}>Add employee</button>} />
      {pageMsg && <div className="text-sm mb-3" style={{ color: "var(--vx-success)" }}>{pageMsg}</div>}
      <input className="input mb-2" placeholder="Search ID, name, email, department…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="input mb-3" style={{ maxWidth: 240 }} aria-label="Filter employees" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
        <option value="all">All people</option>
        <option value="admin">Admin</option>
        <option value="hr">HRs</option>
        <option value="employee">Employees</option>
        <option value="mine">Employees added by me</option>
      </select>
      {filtered.length === 0 ? <Empty msg="No employees. Click Add employee." /> : (
        <div className="glass-strong overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left opacity-70"><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Dept</th><th className="p-2">Shift</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
            <tbody>{filtered.map((r) => {
              const editable = canEdit(r);
              const tag = !r.user_id ? "not activated" : roleByUser[r.user_id] === "admin" ? "admin · managed by Admin" : roleByUser[r.user_id] === "hr" ? "hr · managed by Admin" : "";
              return (
              <tr key={r.id} style={{ borderTop: "1px solid var(--vx-border)" }}>
                <td className="p-2 mono">{r.employee_code}</td>
                <td className="p-2">{r.full_name}<div className="text-xs mono opacity-60">{r.email}{tag ? ` · ${tag}` : ""}</div></td>
                <td className="p-2">{r.department}<div className="text-xs opacity-60">{r.designation}</div></td>
                <td className="p-2 mono text-xs">{shifts.find((s) => s.id === r.shift_id)?.name ?? "—"}</td>
                <td className="p-2">{r.work_type}</td>
                <td className="p-2"><Badge tone={r.is_active ? "ok" : "muted"}>{r.is_active ? "Active" : "Inactive"}</Badge></td>
                <td className="p-2 text-right whitespace-nowrap">
                  {editable ? (
                    <><button className="text-xs underline mr-3" onClick={() => toggle(r)}>{r.is_active ? "Deactivate" : "Reactivate"}</button><button className="text-xs underline" style={{ color: "var(--vx-danger)" }} onClick={() => { setRemoving(r); setConfirmCode(""); setRemoveMsg(""); }}>Remove</button></>
                  ) : <span className="text-xs opacity-50">Read-only</span>}
                </td>
              </tr>);})}</tbody>
          </table>
        </div>
      )}
      <Modal open={open} title="Add employee" onClose={() => setOpen(false)}>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Employee ID" hint="Auto-generated on save."><input className="input mono" value="Auto-generated on save" disabled /></Field>
          <Field label="Work email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Department"><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Designation"><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
          <Field label="Shift"><select className="input" value={form.shift_id} onChange={(e) => setForm({ ...form, shift_id: e.target.value })}>{shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)})</option>)}</select></Field>
          <Field label="Work type"><select className="input" value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })}><option value="office">office</option><option value="wfh">wfh</option><option value="hybrid">hybrid</option></select></Field>
          <Field label="Temporary password" hint="Leave empty to email an invite link so they set their own password. If set, use at least 8 characters."><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        </div>
        {msg && <div className="text-sm mt-2" style={{ color: "var(--vx-danger)" }}>{msg}</div>}
        <button className="btn-primary mt-3" disabled={saving} onClick={create}>{saving ? "Saving…" : "Save record"}</button>
      </Modal>
      <Modal open={!!removing} title="Remove employee" onClose={() => setRemoving(null)}>
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
