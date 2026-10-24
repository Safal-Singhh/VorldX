import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Badge, Field, PageHeader } from "../../components/ui";
import { edgeText, friendlyEdgeError, useHrEmployee } from "./attendanceUtil";

export function HrWfhAttendance() {
  const { me, today, recordChecked, load } = useHrEmployee();
  const [passcode, setPasscode] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [marking, setMarking] = useState(false);
  const isAbsent = today?.status === "absent";

  const markWfh = async () => {
    setMsg(""); setOk(false);
    if (!me) { setMsg("No active employee record found for your login. Ask your Admin to create/link it, then refresh."); return; }
    if (isAbsent) { setMsg("Today is marked Absent, so WFH check-in is closed. Ask HR or Admin to correct it if needed."); return; }
    if (!passcode.trim()) { setMsg("Enter the passcode from your approved WFH request (see My WFH requests)."); return; }
    setMarking(true);
    try {
      const { data, error } = await supabase.functions.invoke("mark-wfh-attendance", { body: { employee_id: me.id, passcode: passcode.trim() } });
      const serverErr = (data as { error?: string } | null)?.error;
      if (error || serverErr) { setMsg(friendlyEdgeError(serverErr) ?? (await edgeText(error))); return; }
      setOk(true);
      const r = data as { check_in_at: string; check_out_at: string | null; status: string; action: string };
      setMsg(r.action === "checkout"
        ? `WFH checked out at ${new Date(r.check_out_at!).toLocaleTimeString()}. Passcode fully used.`
        : `WFH checked in at ${new Date(r.check_in_at).toLocaleTimeString()} (${r.status}). Same code works once more for check-out.`);
      setPasscode("");
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Request failed. Check connection and retry."); }
    finally { setMarking(false); }
  };

  return (
    <div>
      <PageHeader title="WFH attendance" sub="Enter the passcode from your approved request. First entry checks in, second checks out." />
      <div className="glass p-5 max-w-xl grid gap-3 text-sm">
        {recordChecked && !me && (
          <div className="glass p-3" style={{ border: "1px solid var(--vx-border-active)" }}>
            No active employee record found for this login. Ask your Admin to create/link it, then press Refresh.
            <div className="mt-2"><button className="input" style={{ width: "auto" }} onClick={load}>Refresh</button></div>
          </div>
        )}
        <div>Today: {today ? (
          isAbsent ? (
            <><Badge tone="bad">absent</Badge> <span className="opacity-70">No check-in by shift end. Ask HR or Admin to correct it if you were present.</span></>
          ) : (
            <><Badge tone={today.status === "late" ? "warn" : "ok"}>{today.status} · {today.attendance_type}</Badge> <span className="mono">in {today.check_in_at ? new Date(today.check_in_at).toLocaleTimeString() : "—"}{today.check_out_at ? ` · out ${new Date(today.check_out_at).toLocaleTimeString()}` : " · In progress"}</span></>
          )
        ) : "No record yet today."}</div>
        {isAbsent && <div className="opacity-70">Today is marked absent, so WFH check-in and check-out are closed. Contact HR or Admin for a correction.</div>}
        <Field label="WFH passcode" hint="From your approved request under My WFH requests. First entry checks in, second checks out.">
          <div className="flex gap-2"><input className="input mono" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="6-digit code" disabled={!me || marking || isAbsent} /><button className="btn-primary" style={{ width: "auto" }} disabled={!me || marking || isAbsent} onClick={markWfh}>{marking ? "Marking…" : "Mark WFH"}</button></div>
        </Field>
        {msg && <div style={{ color: ok ? "var(--vx-success)" : "var(--vx-danger)" }}>{msg}</div>}
      </div>
    </div>
  );
}
