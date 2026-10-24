import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useCompanyDirectory } from "../../lib/directory";
import { Badge, Empty, Modal, PageHeader } from "../../components/ui";

interface Row { id: string; leave_date: string; reason: string; status: string; review_notes: string | null; employees: { full_name: string; user_id: string | null } }

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

export function AdminLeave() {
  const { company, userId } = useAuth();
  const { employees } = useCompanyDirectory(company?.id);
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Row | null>(null);
  const [msg, setMsg] = useState("");

  const hrEmployeeIds = useMemo(
    () => employees.filter((e) => e.role === "hr").map((e) => e.id),
    [employees],
  );

  const load = async () => {
    if (!company) return;
    if (hrEmployeeIds.length === 0) { setRows([]); return; }
    const { data } = await supabase.from("leave_requests").select("*, employees!inner(full_name,user_id)").eq("company_id", company.id).eq("status", tab).in("employee_id", hrEmployeeIds).order("leave_date").limit(100);
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); setMsg(""); }, [company, tab, hrEmployeeIds]);

  const review = async (decision: "approved" | "rejected") => {
    if (!sel) return;
    setMsg("");
    const { data, error } = await supabase.functions.invoke("review-leave-request", { body: { request_id: sel.id, reviewer_user_id: userId, decision, notes: "" } });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) { setMsg(serverErr ?? (await edgeMsg(error))); return; }
    setSel(null); load();
  };

  return (
    <div>
      <PageHeader title="HR Leave requests" sub="Admin approves HR leave. Each HR can take up to 3 leaves per month." />
      <div className="flex gap-2 mb-3">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button key={t} className={tab === t ? "btn-primary" : "input"} style={{ maxWidth: 140 }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty msg="No HR leave requests in this state." /> : (
        <div className="grid gap-2">{rows.map((r) => (
          <div key={r.id} className="glass p-4 flex justify-between items-center gap-3">
            <div className="text-sm"><div className="font-semibold">{r.employees.full_name} <span className="mono opacity-60">{r.leave_date}</span></div><div className="opacity-70">{r.reason}</div></div>
            <div className="flex items-center gap-2"><Badge tone={r.status === "pending" ? "warn" : r.status === "approved" ? "ok" : "bad"}>{r.status}</Badge><button className="input" style={{ width: "auto" }} onClick={() => setSel(r)}>Review</button></div>
          </div>))}</div>
      )}
      <Modal open={!!sel} title="Review leave" onClose={() => { setSel(null); setMsg(""); }}>
        {sel && (
          <div className="grid gap-3 text-sm">
            <div className="font-semibold">{sel.employees.full_name} <span className="mono opacity-60">{sel.leave_date}</span></div>
            <div>{sel.reason}</div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => review("approved")}>Approve</button>
              <button className="input" style={{ width: "auto" }} onClick={() => review("rejected")}>Reject</button>
            </div>
            {msg && <div style={{ color: "var(--vx-danger)" }}>{msg}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
