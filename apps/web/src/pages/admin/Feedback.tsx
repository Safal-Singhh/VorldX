import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useCompanyDirectory } from "../../lib/directory";
import { Empty, Field, PageHeader } from "../../components/ui";

const CRITERIA = ["punctuality", "attendance_consistency", "teamwork_collaboration", "adaptability", "accountability"];

export function AdminFeedback() {
  const { company, userId } = useAuth();
  const { employees } = useCompanyDirectory(company?.id);
  const [subject, setSubject] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({ punctuality: 7, attendance_consistency: 7, teamwork_collaboration: 7, adaptability: 7, accountability: 7 });
  const [comments, setComments] = useState("");
  const [msg, setMsg] = useState("");
  const [prev, setPrev] = useState<{ id: string; period_start: string; period_end: string; comments: string }[]>([]);

  const hrs = useMemo(
    () => employees.filter((e) => e.role === "hr" && e.is_active).map((e) => ({ id: e.id, full_name: e.full_name })),
    [employees],
  );

  useEffect(() => {
    setSubject((current) => (hrs.some((h) => h.id === current) ? current : (hrs[0]?.id ?? "")));
  }, [hrs]);

  useEffect(() => {
    if (!subject) { setPrev([]); return; }
    (async () => {
      const { data } = await supabase.from("feedback_reviews").select("id,period_start,period_end,comments").eq("subject_employee_id", subject).order("period_start", { ascending: false }).limit(5);
      setPrev((data ?? []) as never);
    })();
  }, [subject]);

  const submit = async () => {
    setMsg("");
    if (!subject) { setMsg("No HR is available for feedback."); return; }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data, error } = await supabase.functions.invoke("submit-feedback-review", {
      body: { company_id: company!.id, subject_employee_id: subject, reviewer_user_id: userId, period_start: start, period_end: end, comments, scores },
    });
    if (error || (data as { error?: string })?.error) { setMsg(error?.message ?? (data as { error: string }).error); return; }
    setMsg("Review saved."); setComments("");
  };

  return (
    <div>
      <PageHeader title="HR feedback" sub="Rate each criterion from 0 to 10 and add written comments." />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="glass p-5 grid gap-3">
          <Field label="HR subject">
            <select className="input" value={subject} disabled={hrs.length === 0} onChange={(e) => setSubject(e.target.value)}>
              {hrs.length === 0 ? <option value="">No HR available</option> : hrs.map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
            </select>
          </Field>
          {CRITERIA.map((c) => (
            <Field key={c} label={c}><div className="flex items-center gap-2"><input type="range" min={0} max={10} value={scores[c]} onChange={(e) => setScores({ ...scores, [c]: Number(e.target.value) })} className="flex-1" /><span className="mono w-8 text-center">{scores[c]}</span></div></Field>
          ))}
          <Field label="Written comments"><textarea className="input" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
          <button className="btn-primary" disabled={!subject} onClick={submit}>Save review</button>
          {msg && <div className="text-sm">{msg}</div>}
        </div>
        <div className="glass p-5">
          <div className="font-semibold text-sm mb-2">Previous reviews</div>
          {prev.length === 0 ? <Empty msg="No previous reviews." /> : prev.map((r) => <div key={r.id} className="text-sm py-2" style={{ borderTop: "1px solid var(--vx-border)" }}><div className="mono text-xs opacity-60">{r.period_start} → {r.period_end}</div><div>{r.comments || "—"}</div></div>)}
        </div>
      </div>
    </div>
  );
}
