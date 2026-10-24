import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  fetchDashboardMetrics,
  formatAge,
  formatDelta,
  formatPct,
  formatTime,
  type DashboardMetrics,
  type DashboardRange,
} from "../../lib/dashboard";
import { PageHeader } from "../../components/ui";
import {
  ApprovalQueue,
  AttendanceTrend,
  DashboardError,
  DashboardSkeleton,
  DepartmentFootprint,
  KpiCard,
  QrHealth,
  RangeToggle,
  RefreshButton,
  SectionCard,
} from "../../components/dashboard";

export function AdminDashboard() {
  const { company } = useAuth();
  const [days, setDays] = useState<DashboardRange>(30);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    setError("");
    try {
      setMetrics(await fetchDashboardMetrics(company.id, days));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, [company, days]);

  useEffect(() => { void load(); }, [load]);

  if (!metrics && loading) {
    return (
      <div>
        <PageHeader title="Company overview" sub="Company-wide attendance, approvals, and HR operations." />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div>
        <PageHeader title="Company overview" sub="Company-wide attendance, approvals, and HR operations." />
        <DashboardError message={error || "Metrics are unavailable."} onRetry={() => void load()} />
      </div>
    );
  }

  const { today, pending, range, headcount } = metrics;
  const totals = range.totals;
  const previous = range.previous;
  const attendanceDelta = formatDelta(totals.attendance_rate, previous.attendance_rate, previous.expected);

  return (
    <div aria-busy={loading}>
      <PageHeader
        title="Company overview"
        sub={`${company?.name ?? "Company"} · updated ${formatTime(metrics.generated_at, metrics.timezone)} · ${metrics.timezone}`}
        action={(
          <>
            <RangeToggle value={days} onChange={setDays} />
            <RefreshButton onClick={() => void load()} busy={loading} />
          </>
        )}
      />

      {error && (
        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: "var(--vx-danger)", background: "rgba(255,107,131,.08)" }}>
          {error}
        </div>
      )}

      {!metrics.is_working_day && (
        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: "var(--vx-warning)", background: "rgba(245,199,107,.08)" }}>
          Today is a non-working day. Attendance totals below cover completed working days.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Employees"
          value={headcount.employees}
          hint={`${headcount.departments} departments · ${headcount.new_joiners} joined this month`}
        />
        <KpiCard
          label="Total staff"
          value={headcount.total_staff}
          hint={`${headcount.hr} HR · ${headcount.admins} Admin`}
        />
        <KpiCard
          label="Checked in today"
          value={today.checked_in}
          tone="good"
          hint={`${today.on_time} on time · ${today.late} late`}
        />
        <KpiCard
          label="Absent today"
          value={today.absent}
          tone={today.absent > 0 ? "bad" : "default"}
          hint={`${today.no_check_in} no check-in · ${today.on_leave} on leave`}
        />
        <KpiCard
          label="WFH today"
          value={today.wfh}
          tone="info"
          hint={`${today.wfh_awaiting} approved, awaiting check-in`}
        />
        <KpiCard
          label="Pending oversight"
          value={pending.total}
          tone={pending.total > 0 ? "warn" : "default"}
          hint={`${pending.employee_total} employee · ${pending.hr_total} HR`}
        />
        <KpiCard
          label="Attendance rate"
          value={formatPct(totals.attendance_rate)}
          hint={attendanceDelta ?? "No comparable prior period"}
        />
        <KpiCard
          label="Absences in range"
          value={totals.absent_days}
          tone={totals.absent_days > 0 ? "bad" : "default"}
          hint={`${totals.expected} expected days · ${days}d range`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mt-4">
        <SectionCard
          className="lg:col-span-2"
          title="Company attendance trend"
          sub={days === 90 ? "Last 30 days shown · totals and comparisons cover 90 days" : `Completed working days · ${days}-day view`}
          action={<span className="text-[10px] mono shrink-0" style={{ color: "var(--vx-text-muted)" }}>{formatPct(totals.on_time_rate)} on time</span>}
        >
          <AttendanceTrend points={range.trend} />
        </SectionCard>
        <SectionCard
          title="Department footprint"
          sub={`${headcount.employees} employees · ${headcount.departments} departments`}
          action={<span className="text-[10px] mono shrink-0" style={{ color: "var(--vx-text-muted)" }}>{days}d range</span>}
        >
          <DepartmentFootprint departments={range.departments} />
        </SectionCard>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
        <ApprovalQueue
          title="Employee requests"
          sub={`${pending.employee_total} waiting · ${pending.wfh_employee} WFH · ${pending.leave_employee} leave`}
          items={metrics.queues?.employee ?? []}
          basePath="/admin"
          interactive={false}
        />
        <ApprovalQueue
          title="HR requests"
          sub={`${pending.hr_total} waiting · oldest ${formatAge(pending.oldest_hr_hours)}`}
          items={metrics.queues?.hr ?? []}
          basePath="/admin"
          hrQueue
        />
        <div className="md:col-span-2 xl:col-span-1">
          <QrHealth displays={metrics.displays} generatedAt={metrics.generated_at} />
        </div>
      </div>
    </div>
  );
}
