import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Badge, Empty, PageHeader, Stat } from "../../components/ui";

export function HrMyAttendance() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<{ id: string; work_date: string; attendance_type: "office" | "wfh" | null; check_in_at: string | null; check_out_at: string | null; status: string }[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: emp } = await supabase.from("employees").select("id").eq("user_id", userId).eq("is_active", true).limit(1).single();
      if (!emp) return;
      const { data } = await supabase.from("attendance_records").select("*").eq("employee_id", (emp as { id: string }).id).order("work_date", { ascending: false }).limit(60);
      setRows((data ?? []) as never);
    })();
  }, [userId]);

  const present = rows.filter((r) => r.status === "present").length;
  const late = rows.filter((r) => r.status === "late").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const wfh = rows.filter((r) => r.attendance_type === "wfh").length;

  return (
    <div>
      <PageHeader title="My attendance" sub="Check-in and check-out times for each day. Absences appear after shift end." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
        <Stat label="Present" value={present} />
        <Stat label="Late" value={late} />
        <Stat label="Absent" value={absent} />
        <Stat label="WFH days" value={wfh} />
      </div>
      <div className="glass-strong overflow-x-auto mt-4">
        {rows.length === 0 ? <Empty msg="No attendance records yet." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left opacity-70"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">In</th><th className="p-2">Out</th><th className="p-2">Duration</th><th className="p-2">Status</th></tr></thead>
            <tbody>{rows.map((r) => {
              const dur = r.check_out_at && r.check_in_at ? Math.round((new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime()) / 60000) : null;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--vx-border)" }}>
                  <td className="p-2 mono">{r.work_date}</td>
                  <td className="p-2">{r.attendance_type ?? "—"}</td>
                  <td className="p-2 mono">{r.check_in_at ? new Date(r.check_in_at).toLocaleString() : "—"}</td>
                  <td className="p-2 mono">{r.check_out_at ? new Date(r.check_out_at).toLocaleString() : r.status === "absent" ? "—" : "In progress"}</td>
                  <td className="p-2 mono">{dur === null ? "—" : `${Math.floor(dur / 60)}h ${dur % 60}m`}</td>
                  <td className="p-2"><Badge tone={r.status === "absent" ? "bad" : r.status === "late" ? "warn" : "ok"}>{r.status}</Badge></td>
                </tr>);
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
