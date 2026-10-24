import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useCompanyDirectory } from "../../lib/directory";
import { Badge, Empty, PageHeader } from "../../components/ui";
import type { AttendanceRecord } from "../../lib/types";

type RoleFilter = "all" | "hr" | "employee" | "mine";

export function HrAttendance() {
  const { company, userId } = useAuth();
  const { employees } = useCompanyDirectory(company?.id);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [emp, setEmp] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [rows, setRows] = useState<AttendanceRecord[]>([]);

  const allowedEmployeeIds = useMemo(() => {
    if (roleFilter === "all") return null;
    return employees.filter((e) => {
      if (roleFilter === "hr") return e.role === "hr";
      if (roleFilter === "employee") return e.role === "employee";
      return e.role === "employee" && e.created_by === userId;
    }).map((e) => e.id);
  }, [employees, roleFilter, userId]);

  const load = async () => {
    if (!company) return;
    if (allowedEmployeeIds && allowedEmployeeIds.length === 0) { setRows([]); return; }
    let q = supabase.from("attendance_records").select("*, employees!inner(full_name,employee_code,department)").eq("company_id", company.id).gte("work_date", from).lte("work_date", to).order("work_date", { ascending: false }).order("check_in_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (type) q = q.eq("attendance_type", type);
    if (dept) q = q.ilike("employees.department", `%${dept}%`);
    if (allowedEmployeeIds) q = q.in("employee_id", allowedEmployeeIds);
    const { data } = await q.limit(300);
    let list = (data ?? []) as unknown as AttendanceRecord[];
    if (emp) list = list.filter((r) => `${r.employees?.full_name} ${r.employees?.employee_code}`.toLowerCase().includes(emp.toLowerCase()));
    setRows(list);
  };
  useEffect(() => { load(); }, [company, from, to, status, type, allowedEmployeeIds]);

  return (
    <div>
      <PageHeader title="Team attendance" sub="Absences appear after shift end. Missing check-outs show as In progress." />
      <div className="flex gap-2 mb-3 flex-wrap">
        <input className="input mono" style={{ maxWidth: 170 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input mono" style={{ maxWidth: 170 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <input className="input" style={{ maxWidth: 200 }} placeholder="Employee / ID" value={emp} onChange={(e) => setEmp(e.target.value)} />
        <input className="input" style={{ maxWidth: 160 }} placeholder="Department" value={dept} onChange={(e) => setDept(e.target.value)} />
        <select className="input" style={{ maxWidth: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select>
        <select className="input" style={{ maxWidth: 150 }} value={type} onChange={(e) => setType(e.target.value)}><option value="">Any type</option><option value="office">Office</option><option value="wfh">WFH</option></select>
        <select className="input" style={{ maxWidth: 210 }} aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
          <option value="all">All roles</option>
          <option value="hr">HRs</option>
          <option value="employee">Employees</option>
          <option value="mine">Employees added by me</option>
        </select>
        <button className="btn-primary" style={{ width: "auto" }} onClick={load}>Apply</button>
      </div>
      {rows.length === 0 ? <Empty msg="No attendance records match these filters." /> : (
        <div className="glass-strong overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left opacity-70"><th className="p-2">Date</th><th className="p-2">Employee</th><th className="p-2">Type</th><th className="p-2">Check-in</th><th className="p-2">Check-out</th><th className="p-2">Duration</th><th className="p-2">Status</th></tr></thead>
            <tbody>{rows.map((r) => {
              const dur = r.check_out_at && r.check_in_at ? Math.round((new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime()) / 60000) : null;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--vx-border)" }}>
                  <td className="p-2 mono">{r.work_date}</td>
                  <td className="p-2">{r.employees?.full_name} <span className="mono opacity-60 text-xs">{r.employees?.employee_code}</span></td>
                  <td className="p-2">{r.attendance_type ? <Badge tone={r.attendance_type === "wfh" ? "info" : "muted"}>{r.attendance_type}</Badge> : <span className="opacity-50">—</span>}</td>
                  <td className="p-2 mono">{r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—"}</td>
                  <td className="p-2 mono">{r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : r.status === "absent" ? "—" : "In progress"}</td>
                  <td className="p-2 mono">{dur === null ? "—" : `${Math.floor(dur / 60)}h ${dur % 60}m`}</td>
                  <td className="p-2"><Badge tone={r.status === "absent" ? "bad" : r.status === "late" ? "warn" : "ok"}>{r.status}</Badge></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
