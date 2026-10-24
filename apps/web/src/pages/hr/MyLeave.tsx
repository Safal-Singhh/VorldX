import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Badge, Empty, Field, PageHeader } from "../../components/ui";
import type { Employee } from "../../lib/types";

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

interface OwnRow { id: string; leave_date: string; reason: string; status: string; review_notes: string | null }

export function HrMyLeave() {
  const { company, userId } = useAuth();
  const [me, setMe] = useState<Employee | null>(null);
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<OwnRow[]>([]);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState("");
  const [listErr, setListErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!company || !userId) return;
    setListErr("");
    const { data: emp, error: eErr } = await supabase.from("employees").select("*").eq("user_id", userId).eq("company_id", company.id).eq("is_active", true).limit(1).single();
    if (eErr || !emp) { setListErr(eErr?.message ?? "Could not load your employee record."); return; }
    setMe(emp as Employee);
    const { data: reqs, error: rErr } = await supabase.from("leave_requests").select("id,leave_date,reason,status,review_notes").eq("employee_id", (emp as Employee).id).order("leave_date", { ascending: false }).limit(30);
    if (rErr) { setListErr(rErr.message); return; }
    setRows((reqs ?? []) as OwnRow[]);
  };
  useEffect(() => { load(); }, [company, userId]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [company, userId]);

  const submit = async () => {
    setMsg(""); setDone("");
    if (!me) { setMsg("No active employee record for your account. Ask Admin."); return; }
    if (!date) { setMsg("Select a date."); return; }
    if (reason.trim().length < 5) { setMsg("Reason must be at least 5 characters."); return; }
    const { data, error } = await supabase.functions.invoke("submit-leave-request", { body: { employee_id: me.id, leave_date: date, reason: reason.trim() } });
    const serverErr = (data as { error?: string } | null)?.error;
    if (error || serverErr) { setMsg(serverErr ?? (await edgeMsg(error))); return; }
    const rid = (data as { data?: string } | null)?.data ?? null;
    const trimmed = reason.trim();
    setReason(""); setDone("Leave request sent to Admin. Max 3 leaves per month.");
    if (rid) setRows((prev) => [{ id: rid, leave_date: date, reason: trimmed, status: "pending", review_notes: null }, ...prev]);
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <div>
      <PageHeader title="My leave requests" sub="Your requests go to Admin. Each person can take up to 3 leaves per month." />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="glass p-5 grid gap-3">
          <Field label="Leave date"><input className="input mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Reason (min 5 chars)"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-primary" onClick={submit}>Send to Admin</button>
          {msg && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{msg}</div>}
          {done && <div className="text-sm" style={{ color: "var(--vx-success)" }}>{done}</div>}
        </div>
        <div className="glass p-5">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-sm">My requests</div>
            <button className="text-xs underline opacity-70" disabled={refreshing} onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
          </div>
          {listErr && <div className="text-sm mb-2" style={{ color: "var(--vx-danger)" }}>{listErr}</div>}
          {rows.length === 0 ? <Empty msg="No leave requests yet." /> : rows.map((r) => (
            <div key={r.id} className="py-2 text-sm" style={{ borderTop: "1px solid var(--vx-border)" }}>
              <div className="flex justify-between items-center gap-2">
                <span className="mono">{r.leave_date}</span>
                <Badge tone={r.status === "pending" ? "warn" : r.status === "approved" ? "ok" : "bad"}>{r.status}</Badge>
              </div>
              <div className="opacity-70 mt-1">{r.reason}</div>
              {r.review_notes && <div className="text-xs opacity-60 mt-1">Admin note: {r.review_notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
