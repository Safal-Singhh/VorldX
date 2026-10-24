import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { isVisibleToHr, useCompanyDirectory } from "../../lib/directory";
import { Field, PageHeader } from "../../components/ui";

const CRITERIA = ["punctuality", "attendance_consistency", "teamwork_collaboration", "adaptability", "accountability"];

export function HrFeedback() {
  const { company, userId } = useAuth();
  const { employees, activeHrUserIds } = useCompanyDirectory(company?.id);
  const [subject, setSubject] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({ punctuality: 7, attendance_consistency: 7, teamwork_collaboration: 7, adaptability: 7, accountability: 7 });
  const [comments, setComments] = useState("");
  const [msg, setMsg] = useState("");

  const emps = useMemo(
    () => employees.filter((e) => e.is_active && isVisibleToHr(e, activeHrUserIds, userId)).map((e) => ({ id: e.id, full_name: e.full_name })),
    [employees, activeHrUserIds, userId],
  );

  useEffect(() => {
    setSubject((current) => (emps.some((e) => e.id === current) ? current : (emps[0]?.id ?? "")));
  }, [emps]);

  const submit = async () => {
    setMsg("");
    if (!subject) { setMsg("No employee is available for feedback."); return; }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data, error } = await supabase.functions.invoke("submit-feedback-review", {
      body: { company_id: company!.id, subject_employee_id: subject, reviewer_user_id: userId, period_start: start, period_end: end, comments, scores },
    });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) {
      let m = serverErr ?? (error as { message?: string })?.message ?? "Request failed";
      try {
        const ctx = (error as { context?: unknown })?.context as Response | undefined;
        if (ctx instanceof Response) { const j = (await ctx.clone().json()) as { error?: string }; if (j?.error) m = j.error; }
      } catch { /* keep m */ }
      setMsg(m); return;
    }
    setMsg("Review saved."); setComments("");
  };

  return (
    <div>
      <PageHeader title="Employee feedback" sub="Rate each criterion from 0 to 10 and add written comments." />
      <div className="glass p-5 grid gap-3 max-w-xl">
        <Field label="Employee">
          <select className="input" value={subject} disabled={emps.length === 0} onChange={(e) => setSubject(e.target.value)}>
            {emps.length === 0 ? <option value="">No employee available</option> : emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </Field>
        {CRITERIA.map((c) => (
          <Field key={c} label={`${c} (${scores[c]}/10)`}><div className="flex items-center gap-2"><input type="range" min={0} max={10} value={scores[c]} onChange={(e) => setScores({ ...scores, [c]: Number(e.target.value) })} className="flex-1" /><span className="mono w-8 text-center">{scores[c]}</span></div></Field>
        ))}
        <Field label="Written comments"><textarea className="input" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
        <button className="btn-primary" disabled={!subject} onClick={submit}>Preview & submit</button>
        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}
