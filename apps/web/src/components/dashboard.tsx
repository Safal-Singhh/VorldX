import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "./ui";
import {
  formatAge,
  formatCount,
  formatDate,
  formatDateTime,
  formatHours,
  formatPct,
  formatTime,
  initials,
  type DashboardDepartment,
  type DashboardDisplay,
  type DashboardMetrics,
  type DashboardQueueItem,
  type DashboardTeamMember,
  type DashboardTotals,
  type DashboardTrendPoint,
} from "../lib/dashboard";

const COLORS = {
  officeOnTime: "#45D6A6",
  officeLate: "#F5C76B",
  wfhOnTime: "#76B8FF",
  wfhLate: "#B7A6FF",
  absent: "#FF6B83",
  line: "#F4F5FF",
  grid: "rgba(184,190,255,.12)",
  muted: "#7E849E",
};

const tooltipStyle = {
  background: "rgba(13,16,27,.96)",
  border: "1px solid rgba(184,190,255,.16)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--vx-text)",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "info" | "bad";
}) {
  const color = tone === "good" ? "var(--vx-success)"
    : tone === "warn" ? "var(--vx-warning)"
    : tone === "info" ? "var(--vx-info)"
    : tone === "bad" ? "var(--vx-danger)"
    : "var(--vx-text)";
  return (
    <div className="glass p-4 min-w-0">
      <div className="text-[10px] uppercase eyebrow truncate" style={{ color: "var(--vx-text-muted)" }}>{label}</div>
      <div className="mono text-[26px] leading-tight mt-1" style={{ color }}>{value}</div>
      {hint && <div className="text-[11px] mt-1 leading-snug" style={{ color: "var(--vx-text-secondary)" }}>{hint}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass p-4 md:p-5 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--vx-text-secondary)" }}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RangeToggle({
  value,
  onChange,
}: {
  value: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl p-1"
      style={{ border: "1px solid var(--vx-border)", background: "rgba(13,16,27,.6)" }}
    >
      {([7, 30, 90] as const).map((days) => {
        const active = value === days;
        return (
          <button
            key={days}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(days)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
            style={active
              ? { background: "rgba(89,101,242,.28)", color: "var(--vx-text)" }
              : { color: "var(--vx-text-muted)" }}
          >
            {days}d
          </button>
        );
      })}
    </div>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      className="btn-secondary grid place-items-center"
      style={{ width: 38, height: 38, padding: 0 }}
      onClick={onClick}
      disabled={busy}
      aria-label="Refresh dashboard"
      title="Refresh dashboard"
    >
      <RefreshCw size={15} className={busy ? "animate-spin" : undefined} />
    </button>
  );
}

export function EmptyPanel({ msg }: { msg: string }) {
  return (
    <div className="glass-strong p-6 text-center text-xs" style={{ color: "var(--vx-text-secondary)" }}>
      {msg}
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardTrendPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="glass-strong p-3 text-xs min-w-[190px]">
      <div className="font-semibold mb-2">{formatDate(point.date, true)}</div>
      <div className="grid gap-1" style={{ color: "var(--vx-text-secondary)" }}>
        <div className="flex justify-between gap-4"><span>Checked in</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.checked_in}</span></div>
        <div className="flex justify-between gap-4"><span>Office · on time</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.office_on_time}</span></div>
        <div className="flex justify-between gap-4"><span>Office · late</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.office_late}</span></div>
        <div className="flex justify-between gap-4"><span>WFH · on time</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.wfh_on_time}</span></div>
        <div className="flex justify-between gap-4"><span>WFH · late</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.wfh_late}</span></div>
        <div className="flex justify-between gap-4"><span>Approved leave</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.on_leave}</span></div>
        <div className="flex justify-between gap-4"><span>Absent</span><span className="mono" style={{ color: point.absent > 0 ? "var(--vx-danger)" : "var(--vx-text)" }}>{point.absent}</span></div>
        <div className="flex justify-between gap-4"><span>No check-in</span><span className="mono" style={{ color: "var(--vx-text)" }}>{point.no_check_in}</span></div>
        <div className="flex justify-between gap-4 pt-1" style={{ borderTop: "1px solid var(--vx-border)" }}><span>Attendance rate</span><span className="mono" style={{ color: "var(--vx-info)" }}>{formatPct(point.rate)}</span></div>
      </div>
    </div>
  );
}

export function AttendanceTrend({ points }: { points: DashboardTrendPoint[] }) {
  if (points.length === 0) {
    return <EmptyPanel msg="No completed working days in this range yet." />;
  }
  const data = points.map((point) => ({ ...point, label: formatDate(point.date) }));
  const legend = [
    { label: "Office · on time", color: COLORS.officeOnTime },
    { label: "Office · late", color: COLORS.officeLate },
    { label: "WFH · on time", color: COLORS.wfhOnTime },
    { label: "WFH · late", color: COLORS.wfhLate },
    { label: "Absent", color: COLORS.absent },
  ];
  return (
    <div className="w-full">
      <div className="h-[246px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.muted }} tickLine={false} axisLine={false} minTickGap={22} />
            <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10, fill: COLORS.muted }} tickLine={false} axisLine={false} width={34} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(184,190,255,.05)" }} />
            <Bar yAxisId="count" dataKey="office_on_time" name="Office · on time" stackId="day" fill={COLORS.officeOnTime} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="count" dataKey="office_late" name="Office · late" stackId="day" fill={COLORS.officeLate} isAnimationActive={false} />
            <Bar yAxisId="count" dataKey="wfh_on_time" name="WFH · on time" stackId="day" fill={COLORS.wfhOnTime} isAnimationActive={false} />
            <Bar yAxisId="count" dataKey="wfh_late" name="WFH · late" stackId="day" fill={COLORS.wfhLate} isAnimationActive={false} />
            <Bar yAxisId="count" dataKey="absent" name="Absent" stackId="day" fill={COLORS.absent} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1 text-[10px]" style={{ color: COLORS.muted }}>
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AttendanceMix({ totals }: { totals: DashboardTotals }) {
  const data = [
    { name: "Office · on time", value: totals.office_on_time, color: COLORS.officeOnTime },
    { name: "Office · late", value: totals.office_late, color: COLORS.officeLate },
    { name: "WFH · on time", value: totals.wfh_on_time, color: COLORS.wfhOnTime },
    { name: "WFH · late", value: totals.wfh_late, color: COLORS.wfhLate },
    { name: "Absent", value: totals.absent_days, color: COLORS.absent },
  ].filter((item) => item.value > 0);

  if (data.length === 0) {
    return <EmptyPanel msg="No completed check-ins in this range yet." />;
  }

  const logged = totals.checked_in + totals.absent_days;

  return (
    <div>
      <div className="relative h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCount(Number(value)), "records"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="mono text-2xl">{formatCount(logged)}</div>
            <div className="text-[9px] uppercase eyebrow" style={{ color: "var(--vx-text-muted)" }}>logged</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-[10px] truncate" style={{ color: "var(--vx-text-secondary)" }}>{item.name}</span>
            <span className="text-[10px] mono ml-auto">{formatCount(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DepartmentFootprint({ departments }: { departments: DashboardDepartment[] }) {
  if (departments.length === 0) return <EmptyPanel msg="No active employees yet." />;
  const max = Math.max(...departments.map((d) => d.headcount), 1);
  return (
    <div className="grid gap-3.5">
      {departments.map((department) => (
        <div key={department.department}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium truncate">{department.department}</span>
            <span className="text-[11px] mono shrink-0">{department.headcount}<span style={{ color: "var(--vx-text-muted)" }}> people</span></span>
          </div>
          <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(184,190,255,.08)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(department.headcount / max) * 100}%`,
                background: "linear-gradient(90deg, #5965f2, #76b8ff)",
              }}
            />
          </div>
          <div className="flex justify-between gap-2 mt-1 text-[10px]" style={{ color: "var(--vx-text-muted)" }}>
            <span>{formatPct(department.attendance_rate)} attendance</span>
            <span>{department.late} late · {department.wfh} WFH · <span style={{ color: department.absent > 0 ? "var(--vx-danger)" : undefined }}>{department.absent} absent</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApprovalQueue({
  title,
  sub,
  items,
  basePath,
  hrQueue = false,
  interactive = true,
}: {
  title: string;
  sub?: string;
  items: DashboardQueueItem[];
  basePath: "/hr" | "/admin";
  hrQueue?: boolean;
  interactive?: boolean;
}) {
  return (
    <SectionCard title={title} sub={sub}>
      {items.length === 0 ? <EmptyPanel msg={hrQueue ? "No HR requests waiting for Admin." : "No employee requests waiting."} /> : (
        <div className="grid">
          {items.map((item, index) => {
            const content = (
              <>
                <div
                  className="w-8 h-8 rounded-full grid place-items-center text-[10px] mono shrink-0"
                  style={{ background: "rgba(89,101,242,.16)", color: "#c9ccff" }}
                >
                  {initials(item.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium truncate">{item.name}</span>
                    <Badge tone={item.kind === "wfh" ? "info" : "warn"}>{item.kind === "wfh" ? "WFH" : "Leave"}</Badge>
                  </div>
                  <div className="text-[10px] truncate" style={{ color: "var(--vx-text-muted)" }}>
                    {item.department} · {formatDate(item.request_date)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] mono" style={{ color: item.age_hours >= 24 ? "var(--vx-warning)" : "var(--vx-text-secondary)" }}>
                    {formatAge(item.age_hours)}
                  </div>
                  <div className="text-[9px]" style={{ color: "var(--vx-text-muted)" }}>{interactive ? "waiting" : "oversight"}</div>
                </div>
              </>
            );
            const className = "flex items-center gap-3 py-2.5";
            const style = { borderTop: index === 0 ? "none" : "1px solid var(--vx-border)" };
            return interactive ? (
              <Link
                key={`${item.kind}-${item.id}`}
                to={`${basePath}/${item.kind === "wfh" ? "wfh-requests" : "leave-requests"}`}
                className={className}
                style={style}
              >
                {content}
              </Link>
            ) : (
              <div key={`${item.kind}-${item.id}`} className={className} style={style}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function TeamBadge({ member }: { member: DashboardTeamMember }) {
  if (member.status === "absent") return <Badge tone="bad">Absent</Badge>;
  if (member.on_leave) return <Badge tone="warn">On leave</Badge>;
  if (!member.check_in_at) return <Badge tone="muted">No check-in</Badge>;
  if (member.attendance_type === "wfh") return <Badge tone="info">WFH</Badge>;
  if (member.status === "late") return <Badge tone="warn">Late</Badge>;
  return <Badge tone="ok">In office</Badge>;
}

export function TodayTeam({
  team,
  expected,
  timezone,
  workingDay,
  basePath,
}: {
  team: DashboardTeamMember[];
  expected: number;
  timezone: string;
  workingDay: boolean;
  basePath: "/hr" | "/admin";
}) {
  const checkedIn = team.filter((member) => member.check_in_at).length;
  const absent = team.filter((member) => member.status === "absent").length;
  return (
    <SectionCard
      title="Today's team"
      sub={workingDay ? `${checkedIn} of ${expected} checked in${absent > 0 ? ` · ${absent} absent` : ""}` : "Non-working day"}
      action={<Link to={`${basePath}/attendance`} className="text-[11px] inline-flex items-center gap-1 shrink-0" style={{ color: "var(--vx-text-secondary)" }}>Attendance <ArrowRight size={12} /></Link>}
    >
      {team.length === 0 ? <EmptyPanel msg="No one is expected today." /> : (
        <div className="max-h-[326px] overflow-y-auto pr-1">
          {team.map((member, index) => (
            <div
              key={member.id}
              className="flex items-center gap-3 py-2"
              style={{ borderTop: index === 0 ? "none" : "1px solid var(--vx-border)" }}
            >
              <div
                className="w-7 h-7 rounded-full grid place-items-center text-[9px] mono shrink-0"
                style={{
                  background: member.status === "absent" ? "rgba(255,107,131,.12)" : member.on_leave ? "rgba(245,199,107,.12)" : member.check_in_at ? "rgba(69,214,166,.12)" : "rgba(184,190,255,.08)",
                  color: member.status === "absent" ? "var(--vx-danger)" : member.on_leave ? "var(--vx-warning)" : member.check_in_at ? "var(--vx-success)" : "var(--vx-text-muted)",
                }}
              >
                {initials(member.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{member.name}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--vx-text-muted)" }}>{member.department} · {member.code}</div>
              </div>
              <div className="text-right shrink-0">
                <TeamBadge member={member} />
                <div className="text-[9px] mono mt-0.5" style={{ color: "var(--vx-text-muted)" }}>
                  {member.check_in_at ? formatTime(member.check_in_at, timezone) : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function HealthBar({
  label,
  value,
  display,
  hint,
  color,
}: {
  label: string;
  value: number | null;
  display: string;
  hint: string;
  color: string;
}) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs">{label}</span>
        <span className="text-xs mono">{display}</span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(184,190,255,.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
      <div className="text-[10px] mt-1" style={{ color: "var(--vx-text-muted)" }}>{hint}</div>
    </div>
  );
}

export function WorkforceHealth({ metrics, basePath }: { metrics: DashboardMetrics; basePath: "/hr" | "/admin" }) {
  const { totals } = metrics.range;
  const leavePct = metrics.month.leave_allowance > 0
    ? (metrics.month.leave_days / metrics.month.leave_allowance) * 100
    : null;
  return (
    <SectionCard
      title="Workforce health"
      sub="Completed attendance; leave and feedback for the current month"
      action={<Link to={`${basePath}/attendance`} className="text-[11px] inline-flex items-center gap-1 shrink-0" style={{ color: "var(--vx-text-secondary)" }}>Details <ArrowRight size={12} /></Link>}
    >
      <div className="grid gap-4">
        <HealthBar
          label="On-time rate"
          value={totals.on_time_rate}
          display={formatPct(totals.on_time_rate)}
          hint={`${totals.on_time} of ${totals.checked_in} completed check-ins`}
          color={COLORS.officeOnTime}
        />
        <HealthBar
          label="WFH adoption"
          value={totals.wfh_share}
          display={formatPct(totals.wfh_share)}
          hint={`${totals.wfh} WFH check-ins in this range`}
          color={COLORS.wfhOnTime}
        />
        <HealthBar
          label="Absences"
          value={totals.expected > 0 ? (totals.absent_days / totals.expected) * 100 : null}
          display={`${formatCount(totals.absent_days)} days`}
          hint={`${formatCount(metrics.month.absent_days)} this month · ${formatCount(totals.no_check_in)} no check-in`}
          color={COLORS.absent}
        />
        <HealthBar
          label="Feedback coverage"
          value={metrics.month.feedback_coverage}
          display={formatPct(metrics.month.feedback_coverage)}
          hint={`${metrics.month.feedback_reviews} submitted reviews${metrics.month.avg_score !== null ? ` · ${metrics.month.avg_score}/10 avg` : ""}`}
          color={COLORS.wfhLate}
        />
        <HealthBar
          label="Leave used this month"
          value={leavePct}
          display={`${metrics.month.leave_days} / ${metrics.month.leave_allowance} days`}
          hint="3 approved leave days per employee per month"
          color={COLORS.officeLate}
        />
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 text-[10px]" style={{ borderTop: "1px solid var(--vx-border)", color: "var(--vx-text-muted)" }}>
        <span className="inline-flex items-center gap-1"><Clock3 size={11} /> Median day {formatHours(totals.median_hours)}</span>
        <span className="inline-flex items-center gap-1"><Users size={11} /> {formatPct(totals.attendance_rate)} attendance</span>
      </div>
    </SectionCard>
  );
}

export function HrActivity({ metrics }: { metrics: DashboardMetrics }) {
  const boxes = [
    { label: "Reviews by HR", value: `${metrics.approvals.completed_by_hr}`, hint: `of ${metrics.approvals.completed_total} completed` },
    { label: "Median response", value: formatAge(metrics.approvals.median_response_hours), hint: "request to decision" },
    { label: "Manual corrections", value: formatCount(metrics.approvals.manual_corrections), hint: "attendance records" },
    { label: "Feedback reviews", value: formatCount(metrics.month.feedback_reviews), hint: `${formatPct(metrics.month.feedback_coverage)} coverage` },
  ];
  return (
    <SectionCard
      title="HR activity"
      sub="Approval throughput, corrections, and feedback in this range"
      action={<Link to="/admin/attendance" className="text-[11px] inline-flex items-center gap-1 shrink-0" style={{ color: "var(--vx-text-secondary)" }}>Audit <ArrowRight size={12} /></Link>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {boxes.map((box) => (
          <div key={box.label} className="rounded-xl p-3" style={{ background: "rgba(13,16,27,.55)", border: "1px solid var(--vx-border)" }}>
            <div className="text-[9px] uppercase eyebrow truncate" style={{ color: "var(--vx-text-muted)" }}>{box.label}</div>
            <div className="mono text-lg mt-0.5">{box.value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "var(--vx-text-muted)" }}>{box.hint}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 pt-3 text-[11px]" style={{ borderTop: "1px solid var(--vx-border)", color: "var(--vx-text-secondary)" }}>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> HR owns employee approvals; Admin owns HR approvals.</span>
        <span className="mono shrink-0">{metrics.pending.hr_total} HR pending</span>
      </div>
    </SectionCard>
  );
}

function displayStatus(display: DashboardDisplay, generatedAt: string): { tone: "ok" | "warn" | "bad" | "muted"; label: string } {
  if (!display.is_active) return { tone: "bad", label: "Disabled" };
  if (!display.last_seen_at) return { tone: "muted", label: "Never seen" };
  const minutes = (new Date(generatedAt).getTime() - new Date(display.last_seen_at).getTime()) / 60000;
  if (minutes < 2) return { tone: "ok", label: "Online" };
  if (minutes < 10) return { tone: "warn", label: "Stale" };
  return { tone: "muted", label: "Offline" };
}

export function QrHealth({ displays, generatedAt }: { displays: DashboardMetrics["displays"]; generatedAt: string }) {
  return (
    <SectionCard
      title="QR display health"
      sub={`${displays.online} online · ${displays.active} active`}
      action={<Link to="/admin/qr-displays" className="text-[11px] inline-flex items-center gap-1 shrink-0" style={{ color: "var(--vx-text-secondary)" }}>Manage <ArrowRight size={12} /></Link>}
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Online", value: displays.online, color: "var(--vx-success)" },
          { label: "Stale", value: displays.stale, color: "var(--vx-warning)" },
          { label: "Offline", value: displays.offline, color: "var(--vx-text-muted)" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg p-2 text-center" style={{ background: "rgba(13,16,27,.55)", border: "1px solid var(--vx-border)" }}>
            <div className="mono text-lg" style={{ color: item.color }}>{item.value}</div>
            <div className="text-[9px] uppercase eyebrow" style={{ color: "var(--vx-text-muted)" }}>{item.label}</div>
          </div>
        ))}
      </div>
      {displays.list.length === 0 ? <EmptyPanel msg="No displays paired." /> : (
        <div>
          {displays.list.map((display, index) => {
            const status = displayStatus(display, generatedAt);
            const lastSeen = display.last_seen_at
              ? formatAge((new Date(generatedAt).getTime() - new Date(display.last_seen_at).getTime()) / 3600000)
              : "never";
            return (
              <div key={display.id} className="flex items-center gap-2 py-2" style={{ borderTop: index === 0 ? "none" : "1px solid var(--vx-border)" }}>
                <QrCode size={13} style={{ color: "var(--vx-text-muted)" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs truncate">{display.name}</div>
                  <div className="text-[9px]" style={{ color: "var(--vx-text-muted)" }}>{display.office} · seen {lastSeen}</div>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export function AuditTrail({
  rows,
  timezone,
}: {
  rows: Array<{ id: string; action: string; created_at: string }>;
  timezone: string;
}) {
  return (
    <SectionCard title="Recent admin activity" sub="Latest audit events for this company">
      {rows.length === 0 ? <EmptyPanel msg="No audit events yet." /> : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--vx-indigo)" }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] mono truncate">{row.action}</div>
                <div className="text-[9px]" style={{ color: "var(--vx-text-muted)" }}>{formatDateTime(row.created_at, timezone)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="glass p-4 animate-pulse">
            <div className="h-2 w-20 rounded" style={{ background: "rgba(184,190,255,.12)" }} />
            <div className="h-7 w-14 rounded mt-3" style={{ background: "rgba(184,190,255,.10)" }} />
            <div className="h-2 w-24 rounded mt-3" style={{ background: "rgba(184,190,255,.08)" }} />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="glass p-5 h-[320px] lg:col-span-2 animate-pulse" />
        <div className="glass p-5 h-[320px] animate-pulse" />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="glass p-5 h-[260px] animate-pulse" />)}
      </div>
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass p-6 text-center">
      <Sparkles size={20} className="mx-auto mb-2" style={{ color: "var(--vx-warning)" }} />
      <div className="text-sm font-semibold">Dashboard could not load</div>
      <div className="text-xs mt-1 mb-4" style={{ color: "var(--vx-text-secondary)" }}>{message}</div>
      <button className="btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}
