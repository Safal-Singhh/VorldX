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

interface OwnReq {
  id: string; request_date: string; reason: string; status: string;
  reviewed_at: string | null; review_notes: string | null;
}

interface CodeInfo { passcode: string | null; uses_left: number; expires_at: string; used_up: boolean; expired: boolean }

export function HrMyWfh() {
  const { company, userId } = useAuth();
  const [me, setMe] = useState<Employee | null>(null);
  const [shiftStart, setShiftStart] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<OwnReq[]>([]);
  const [codes, setCodes] = useState<Record<string, CodeInfo | null>>({});
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState("");
  const [listErr, setListErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const cutoff = (() => {
    if (!shiftStart) return "";
    const [h, m] = shiftStart.split(":").map(Number);
    const mins = h * 60 + m - 120;
    if (mins < 0) return "the previous day";
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  })();

  const load = async () => {
    if (!company || !userId) return;
    setListErr("");
    const { data: emp, error: eErr } = await supabase.from("employees").select("*").eq("user_id", userId).eq("company_id", company.id).eq("is_active", true).limit(1).single();
    if (eErr || !emp) { setListErr(eErr?.message ?? "Could not load your employee record."); return; }
    setMe(emp as Employee);
    if ((emp as Employee).shift_id) {
      const { data: sh } = await supabase.from("shifts").select("start_time").eq("id", (emp as Employee).shift_id!).single();
      if (sh) setShiftStart((sh as { start_time: string }).start_time.slice(0, 5));
    }
    const { data: reqs, error: rErr } = await supabase.from("wfh_requests").select("id,request_date,reason,status,reviewed_at,review_notes").eq("employee_id", (emp as Employee).id).order("request_date", { ascending: false }).limit(30);
    if (rErr) { setListErr(rErr.message); return; }
    const list = (reqs ?? []) as OwnReq[];
    setRows(list);
    // Fetch display passcodes for approved requests (visible only to requester/reviewer roles)
    const entries = await Promise.all(list.filter((r) => r.status === "approved").map(async (r) => {
      const { data } = await supabase.rpc("my_wfh_passcode", { p_request_id: r.id });
      return [r.id, (data ?? null) as CodeInfo | null] as const;
    }));
    setCodes(Object.fromEntries(entries));
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
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-wfh-request", { body: { employee_id: me.id, request_date: date, reason: reason.trim() } });
      const serverErr = (data as { error?: string } | null)?.error;
      if (error || serverErr) { setMsg(serverErr ?? (await edgeMsg(error))); return; }
      const rid = (data as { data?: string; id?: string } | string | null) as { data?: string; id?: string } | string | null;
      const id = typeof rid === "string" ? rid : (rid?.data ?? rid?.id ?? null);
      const trimmed = reason.trim();
      setReason(""); setDone("Request submitted. An Admin will review it.");
      if (id) setRows((prev) => [{ id, request_date: date, reason: trimmed, status: "pending", reviewed_at: null, review_notes: null }, ...prev]);
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="My WFH requests" sub="Your requests go to Admin. Approved passcodes appear here and expire at the end of the day." />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="glass p-5 grid gap-3">
          <Field label="Request date"><input className="input mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {cutoff && <div className="text-xs mono opacity-60">Requests for {date} close at {cutoff}.</div>}
          <Field label="Reason"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit to Admin"}</button>
          {msg && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{msg}</div>}
          {done && <div className="text-sm" style={{ color: "var(--vx-success)" }}>{done}</div>}
        </div>
        <div className="glass p-5">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-sm">My requests</div>
            <button className="text-xs underline opacity-70" disabled={refreshing} onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
          </div>
          {listErr && <div className="text-sm mb-2" style={{ color: "var(--vx-danger)" }}>{listErr}</div>}
          {rows.length === 0 ? <Empty msg="No WFH requests yet." /> : rows.map((r) => {
            const c = codes[r.id];
            return (
              <div key={r.id} className="py-2 text-sm" style={{ borderTop: "1px solid var(--vx-border)" }}>
                <div className="flex justify-between items-center gap-2">
                  <span className="mono">{r.request_date}</span>
                  <Badge tone={r.status === "pending" ? "warn" : r.status === "approved" ? "ok" : "bad"}>{r.status}</Badge>
                </div>
                <div className="opacity-70 mt-1">{r.reason}</div>
                {r.review_notes && <div className="text-xs opacity-60 mt-1">Admin note: {r.review_notes}</div>}
                {r.status === "approved" && (
                  c?.passcode ? (
                    <div className="glass p-3 mt-2 text-center">
                      <div className="mono text-lg tracking-widest">{c.passcode}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {c.expired ? "Expired at the end of the day." : c.used_up ? "Fully used for check-in and check-out." : `${c.uses_left} of 2 uses left. Expires at the end of the day.`}
                      </div>
                    </div>
                  ) : <div className="text-xs opacity-60 mt-1">Passcode being issued… press Refresh.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
