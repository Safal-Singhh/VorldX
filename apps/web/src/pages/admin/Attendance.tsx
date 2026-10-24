import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { monthStartInTimeZone, todayInTimeZone } from "../../lib/date";
import { Badge, Empty, PageHeader } from "../../components/ui";
import type { AttendanceRecord } from "../../lib/types";

const ROW_LIMIT = 1000;

export function AdminAttendance() {
  const { company } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [rangeError, setRangeError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const initialisedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!company || initialisedFor.current === company.id) return;
    initialisedFor.current = company.id;
    setFrom(monthStartInTimeZone(company.timezone));
    setTo(todayInTimeZone(company.timezone));
  }, [company]);

  const load = async () => {
    if (!company || !from || !to) return;
    if (from > to) {
      setRangeError("Start date must be on or before end date.");
      setRows([]);
      setTruncated(false);
      return;
    }
    setRangeError("");
    let q = supabase
      .from("attendance_records")
      .select("*, employees(full_name,employee_code,department)")
      .eq("company_id", company.id)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: false })
      .order("check_in_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (type) q = q.eq("attendance_type", type);
    const { data } = await q.limit(ROW_LIMIT);
    const list = (data ?? []) as unknown as AttendanceRecord[];
    setRows(list);
    setTruncated(list.length === ROW_LIMIT);
  };
  useEffect(() => { load(); }, [company, from, to, status, type]);

  return (
    <div>
      <PageHeader title="HR attendance" sub="Company-wide attendance. Absences appear after shift end; corrections require a reason and are recorded." />
      <div className="flex gap-2 mb-3 flex-wrap">
        <input className="input mono" style={{ maxWidth: 180 }} type="date" aria-label="Start date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input mono" style={{ maxWidth: 180 }} type="date" aria-label="End date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select>
        <select className="input" style={{ maxWidth: 160 }} value={type} onChange={(e) => setType(e.target.value)}><option value="">Any type</option><option value="office">Office</option><option value="wfh">WFH</option></select>
      </div>
      {rangeError && <div className="text-sm mb-3" style={{ color: "var(--vx-danger)" }}>{rangeError}</div>}
      {truncated && <div className="text-sm mb-3" style={{ color: "var(--vx-warning)" }}>Showing the latest {ROW_LIMIT} records. Narrow the date range to see older rows.</div>}
      {rows.length === 0 ? <Empty msg={rangeError ? "Fix the date range to load attendance." : "No attendance records match these filters."} /> : (
        <div className="glass-strong overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left opacity-70"><th className="p-2">Date</th><th className="p-2">Employee</th><th className="p-2">Type</th><th className="p-2">Check-in</th><th className="p-2">Check-out</th><th className="p-2">Status</th><th className="p-2">Source</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--vx-border)" }}>
                <td className="p-2 mono">{r.work_date}</td>
                <td className="p-2">{r.employees?.full_name} <span className="mono opacity-60 text-xs">{r.employees?.employee_code}</span></td>
                <td className="p-2">{r.attendance_type ? <Badge tone={r.attendance_type === "wfh" ? "info" : "muted"}>{r.attendance_type}</Badge> : <span className="opacity-50">—</span>}</td>
                <td className="p-2 mono">{r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—"}</td>
                <td className="p-2 mono">{r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : r.status === "absent" ? "—" : "In progress"}</td>
                <td className="p-2"><Badge tone={r.status === "absent" ? "bad" : r.status === "late" ? "warn" : "ok"}>{r.status}</Badge></td>
                <td className="p-2 mono text-xs">{r.source}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
