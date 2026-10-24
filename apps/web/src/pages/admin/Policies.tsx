import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Field, PageHeader } from "../../components/ui";

export function AdminPolicies() {
  const { company } = useAuth();
  const [form, setForm] = useState({ wfh_enabled: true, request_cutoff_minutes: 120, wfh_eligibility_rules: "", grace: 10, auto_absent_enabled: true });
  const [autoAbsentStartedAt, setAutoAbsentStartedAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data: p } = await supabase.from("attendance_policies").select("*").eq("company_id", company.id).single();
      const { data: s } = await supabase.from("shifts").select("*").eq("company_id", company.id).limit(1).single();
      if (p) {
        setForm((f) => ({ ...f, wfh_enabled: p.wfh_enabled, request_cutoff_minutes: p.request_cutoff_minutes, wfh_eligibility_rules: p.wfh_eligibility_rules ?? "", auto_absent_enabled: p.auto_absent_enabled }));
        setAutoAbsentStartedAt(p.auto_absent_started_at ?? "");
      }
      if (s) setForm((f) => ({ ...f, grace: s.grace_period_minutes }));
    })();
  }, [company]);

  const save = async () => {
    setMsg("");
    const { error } = await supabase.from("attendance_policies").update({
      wfh_enabled: form.wfh_enabled, request_cutoff_minutes: 120, wfh_eligibility_rules: form.wfh_eligibility_rules,
      auto_absent_enabled: form.auto_absent_enabled,
    }).eq("company_id", company!.id);
    if (error) { setMsg(error.message); return; }
    await supabase.from("shifts").update({ grace_period_minutes: form.grace }).eq("company_id", company!.id);
    const { data: refreshed } = await supabase.from("attendance_policies").select("auto_absent_started_at").eq("company_id", company!.id).single();
    setAutoAbsentStartedAt(refreshed?.auto_absent_started_at ?? "");
    setDirty(false); setMsg("Saved. WFH cutoff is fixed at 120 minutes before assigned shift.");
  };

  return (
    <div>
      <PageHeader title="Global policies" sub="HR sees these settings read-only." action={<button className="btn-primary" disabled={!dirty} onClick={save}>Save</button>} />
      <div className="glass p-5 grid gap-3 max-w-xl">
        <Field label="WFH enabled"><input type="checkbox" checked={form.wfh_enabled} onChange={(e) => { setForm({ ...form, wfh_enabled: e.target.checked }); setDirty(true); }} /></Field>
        <Field label="WFH cutoff" hint="Requests close 2 hours before shift start."><input className="input mono" value="2 hours before shift start" disabled /></Field>
        <Field label="Grace period (minutes)" hint="Late after shift start + grace."><input className="input mono" type="number" value={form.grace} onChange={(e) => { setForm({ ...form, grace: Number(e.target.value) }); setDirty(true); }} /></Field>
        <Field label="Shift-end auto-absence" hint="Active HR and employees are marked Absent at shift end on a working day when no check-in exists. Past days are never backfilled."><input type="checkbox" checked={form.auto_absent_enabled} onChange={(e) => { setForm({ ...form, auto_absent_enabled: e.target.checked }); setDirty(true); }} /></Field>
        {autoAbsentStartedAt && (
          <div className="text-xs mono" style={{ color: "var(--vx-text-muted)" }}>
            Tracking since {new Date(autoAbsentStartedAt).toLocaleString()} · turning this back on starts a fresh date
          </div>
        )}
        <Field label="WFH eligibility rules"><textarea className="input" rows={4} value={form.wfh_eligibility_rules} onChange={(e) => { setForm({ ...form, wfh_eligibility_rules: e.target.value }); setDirty(true); }} /></Field>
        {dirty && <div className="text-xs" style={{ color: "var(--vx-warning)" }}>Unsaved changes</div>}
        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}
