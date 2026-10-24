import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useCompanyDirectory } from "../../lib/directory";
import { Badge, Empty, Modal, PageHeader } from "../../components/ui";
import type { WfhRequest } from "../../lib/types";

export function AdminWfh() {
  const { company, userId } = useAuth();
  const { employees } = useCompanyDirectory(company?.id);
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<WfhRequest[]>([]);
  const [sel, setSel] = useState<WfhRequest | null>(null);
  const [passcode, setPasscode] = useState("");
  const [note, setNote] = useState("");

  const hrEmployeeIds = useMemo(
    () => employees.filter((e) => e.role === "hr").map((e) => e.id),
    [employees],
  );

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

  const load = async () => {
    if (!company) return;
    if (hrEmployeeIds.length === 0) { setRows([]); return; }
    const { data } = await supabase.from("wfh_requests").select("*, employees!inner(full_name,department)").eq("company_id", company.id).eq("status", tab).in("employee_id", hrEmployeeIds).order("request_date").limit(100);
    setRows((data ?? []) as unknown as WfhRequest[]);
  };
  useEffect(() => { load(); setPasscode(""); }, [company, tab, hrEmployeeIds]);

  const review = async (decision: "approved" | "rejected") => {
    if (!sel) return;
    setNote("");
    const { data, error } = await supabase.functions.invoke("review-wfh-request", { body: { request_id: sel.id, reviewer_user_id: userId, decision, notes: "" } });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) { setNote(serverErr ?? (await edgeMsg(error))); return; }
    if (decision === "approved") {
      // Auto-generate single-use passcode on approve (expires end of day). Shown once — share with HR.
      const { data: g, error: ge } = await supabase.functions.invoke("generate-wfh-passcode", { body: { request_id: sel.id, generated_by: userId, request_date: sel.request_date } });
      const gErr = (g as { error?: string } | null)?.error;
      if (ge || gErr) { setNote(`Approved, but passcode failed: ${gErr ?? (await edgeMsg(ge))}`); }
      else setPasscode((g as { passcode: string }).passcode ?? "");
      setSel({ ...sel, status: "approved" });
      load();
      return;
    }
    setSel(null); load();
  };

  const genPasscode = async () => {
    if (!sel) return;
    setNote("");
    const { data, error } = await supabase.functions.invoke("generate-wfh-passcode", { body: { request_id: sel.id, generated_by: userId, request_date: sel.request_date } });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) { setNote(serverErr ?? (await edgeMsg(error))); return; }
    setPasscode((data as { passcode: string }).passcode ?? JSON.stringify(data));
  };

  return (
    <div>
      <PageHeader title="HR WFH requests" sub="Admin approves HR requests. The passcode is shown once, right after approval." />
      <div className="flex gap-2 mb-3">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button key={t} className={tab === t ? "btn-primary" : "input"} style={{ maxWidth: 140 }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty msg="No HR requests in this state." /> : (
        <div className="grid gap-2">{rows.map((r) => (
          <div key={r.id} className="glass p-4 flex justify-between items-center gap-3">
            <div className="text-sm"><div className="font-semibold">{(r as unknown as { employees: { full_name: string } }).employees.full_name} <span className="mono opacity-60">{r.request_date}</span></div><div className="opacity-70">{r.reason}</div></div>
            <div className="flex items-center gap-2"><Badge tone={r.status === "pending" ? "warn" : r.status === "approved" ? "ok" : "bad"}>{r.status}</Badge><button className="input" style={{ width: "auto" }} onClick={() => setSel(r)}>Review</button></div>
          </div>))}</div>
      )}
      <Modal open={!!sel} title="Review request" onClose={() => { setSel(null); setPasscode(""); setNote(""); }}>
        {sel && (
          <div className="grid gap-3 text-sm">
            <div>{sel.reason}</div>
            <div className="mono opacity-70">Date {sel.request_date} · requests close 2 hours before shift start</div>
            <div className="flex gap-2">
              {sel.status === "pending" && <button className="btn-primary" onClick={() => review("approved")}>Approve & generate passcode</button>}
              {sel.status === "pending" && <button className="input" style={{ width: "auto" }} onClick={() => review("rejected")}>Reject</button>}
              {sel.status !== "pending" && <button className="input" style={{ width: "auto" }} onClick={genPasscode}>Generate passcode</button>}
            </div>
            {note && <div style={{ color: "var(--vx-danger)" }}>{note}</div>}
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
