import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { isVisibleToHr, useCompanyDirectory } from "../../lib/directory";
import { Badge, Empty, Modal, PageHeader } from "../../components/ui";
import type { WfhRequest } from "../../lib/types";

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

export function HrWfh() {
  const { company, userId } = useAuth();
  const { employees, activeHrUserIds } = useCompanyDirectory(company?.id);
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<(WfhRequest & { employees: { full_name: string; user_id: string | null } })[]>([]);
  const [sel, setSel] = useState<(WfhRequest & { employees: { full_name: string; user_id: string | null } }) | null>(null);
  const [passcode, setPasscode] = useState("");
  const [msg, setMsg] = useState("");

  const visibleEmployeeIds = useMemo(
    () => employees.filter((e) => isVisibleToHr(e, activeHrUserIds, userId)).map((e) => e.id),
    [employees, activeHrUserIds, userId],
  );

  const load = async () => {
    if (!company) return;
    if (visibleEmployeeIds.length === 0) { setRows([]); return; }
    const { data } = await supabase.from("wfh_requests").select("*, employees!inner(full_name,user_id)").eq("company_id", company.id).eq("status", tab).in("employee_id", visibleEmployeeIds).order("request_date").limit(100);
    setRows((data ?? []) as never);
  };
  useEffect(() => { load(); setPasscode(""); setMsg(""); }, [company, tab, visibleEmployeeIds]);

  const review = async (decision: "approved" | "rejected") => {
    if (!sel) return;
    setMsg("");
    const { data, error } = await supabase.functions.invoke("review-wfh-request", { body: { request_id: sel.id, reviewer_user_id: userId, decision, notes: "" } });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) { setMsg(serverErr ?? (await edgeMsg(error))); return; }
    if (decision === "approved") {
      // Auto-generate single-use passcode on approve (expires end of day). Shown once — share with employee.
      const { data: g, error: ge } = await supabase.functions.invoke("generate-wfh-passcode", { body: { request_id: sel.id, generated_by: userId, request_date: sel.request_date } });
      const gErr = (g as { error?: string } | null)?.error;
      if (ge || gErr) { setMsg(`Approved, but passcode failed: ${gErr ?? (await edgeMsg(ge))}`); }
      else setPasscode((g as { passcode: string }).passcode ?? "");
      setSel({ ...sel, status: "approved" });
      load();
      return;
    }
    setSel(null); load();
  };

  const gen = async () => {
    if (!sel) return;
    setMsg("");
    const { data, error } = await supabase.functions.invoke("generate-wfh-passcode", { body: { request_id: sel.id, generated_by: userId, request_date: sel.request_date } });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) { setMsg(serverErr ?? (await edgeMsg(error))); return; }
    setPasscode((data as { passcode: string }).passcode ?? JSON.stringify(data));
  };

  return (
    <div>
      <PageHeader title="Employee WFH" sub="HR approves WFH requests from employees they added, plus unassigned employees." />
      <div className="flex gap-2 mb-3">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button key={t} className={tab === t ? "btn-primary" : "input"} style={{ maxWidth: 140 }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty msg="No employee WFH requests in this state." /> : (
        <div className="grid gap-2">{rows.map((r) => (
          <div key={r.id} className="glass p-4 flex justify-between items-center gap-3">
            <div className="text-sm"><div className="font-semibold">{r.employees.full_name} <span className="mono opacity-60">{r.request_date}</span></div><div className="opacity-70">{r.reason}</div></div>
            <div className="flex items-center gap-2"><Badge tone={r.status === "pending" ? "warn" : r.status === "approved" ? "ok" : "bad"}>{r.status}</Badge><button className="input" style={{ width: "auto" }} onClick={() => setSel(r)}>Review</button></div>
          </div>))}</div>
      )}
      <Modal open={!!sel} title="Review request" onClose={() => { setSel(null); setPasscode(""); setMsg(""); }}>
        {sel && (
          <div className="grid gap-3 text-sm">
            <div className="font-semibold">{sel.employees.full_name} <span className="mono opacity-60">{sel.request_date}</span></div>
            <div>{sel.reason}</div>
            <div className="flex gap-2 flex-wrap">
              {sel.status === "pending" && <button className="btn-primary" onClick={() => review("approved")}>Approve & generate passcode</button>}
              {sel.status === "pending" && <button className="input" style={{ width: "auto" }} onClick={() => review("rejected")}>Reject</button>}
              {sel.status === "approved" && <button className="input" style={{ width: "auto" }} onClick={gen}>Generate passcode</button>}
            </div>
            {msg && <div style={{ color: "var(--vx-danger)" }}>{msg}</div>}
            {passcode && (
              <div className="glass p-3 text-center">
                <div className="mono text-lg tracking-widest">{passcode}</div>
                <div className="text-xs opacity-70 mt-1">Valid for check-in and check-out · expires at the end of {sel.request_date}. Share it now, it cannot be shown again.</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
