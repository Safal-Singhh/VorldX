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
  AttendanceMix,
  AttendanceTrend,
  DashboardError,
  DashboardSkeleton,
  KpiCard,
  RangeToggle,
  RefreshButton,
  SectionCard,
  TodayTeam,
  WorkforceHealth,
} from "../../components/dashboard";

export function HrDashboard() {
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
        <PageHeader title="Team overview" sub="Live attendance, approvals, and workforce signals from your company data." />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div>
        <PageHeader title="Team overview" sub="Live attendance, approvals, and workforce signals from your company data." />
        <DashboardError message={error || "Metrics are unavailable."} onRetry={() => void load()} />
      </div>
    );
  }

  const { today, pending, range, headcount, shift } = metrics;
  const totals = range.totals;
  const previous = range.previous;
  const onTimeDelta = formatDelta(totals.on_time_rate, previous.on_time_rate, previous.expected);
  const shiftLabel = shift.start && shift.end ? `${shift.start}–${shift.end}` : "No shift configured";

  return (
    <div aria-busy={loading}>
      <PageHeader
        title="Team overview"
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
          label="Expected today"
          value={today.expected}
          hint={`${headcount.employees} employees · ${shiftLabel}`}
        />
        <KpiCard
          label="Checked in"
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
          label="On leave today"
          value={today.on_leave}
          tone="warn"
          hint={`${today.no_check_in} no check-in`}
        />
        <KpiCard
          label="Employee requests"
          value={pending.employee_total}
          tone={pending.employee_total > 0 ? "warn" : "default"}
          hint={`Oldest waiting ${formatAge(pending.oldest_employee_hours)}`}
        />
        <KpiCard
          label="On-time rate"
          value={formatPct(totals.on_time_rate)}
          hint={onTimeDelta ?? "No comparable prior period"}
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
          title="Attendance trend"
          sub={days === 90 ? "Last 30 days shown · totals and comparisons cover 90 days" : `Completed working days · ${days}-day view`}
          action={<span className="text-[10px] mono shrink-0" style={{ color: "var(--vx-text-muted)" }}>{formatPct(totals.attendance_rate)} attendance</span>}
        >
          <AttendanceTrend points={range.trend} />
        </SectionCard>
        <SectionCard
          title="Attendance mix"
          sub={`${totals.checked_in} completed check-ins`}
          action={<span className="text-[10px] mono shrink-0" style={{ color: "var(--vx-text-muted)" }}>{formatPct(totals.on_time_rate)} on time</span>}
        >
          <AttendanceMix totals={totals} />
        </SectionCard>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
        <ApprovalQueue
          title="Employee requests"
          sub={`${pending.employee_total} waiting · oldest ${formatAge(pending.oldest_employee_hours)}`}
          items={metrics.queues?.employee ?? []}
          basePath="/hr"
        />
        <TodayTeam
          team={metrics.today_team}
          expected={today.expected}
          timezone={metrics.timezone}
          workingDay={metrics.is_working_day}
          basePath="/hr"
        />
        <div className="md:col-span-2 xl:col-span-1">
          <WorkforceHealth metrics={metrics} basePath="/hr" />
        </div>
      </div>
    </div>
  );
}
