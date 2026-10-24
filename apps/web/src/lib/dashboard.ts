import { supabase } from "./supabase";

export type DashboardRange = 7 | 30 | 90;

export interface DashboardShift {
  start: string | null;
  end: string | null;
  grace_minutes: number | null;
  started: boolean;
}

export interface DashboardHeadcount {
  employees: number;
  hr: number;
  admins: number;
  total_staff: number;
  unactivated: number;
  new_joiners: number;
  departments: number;
}

export interface DashboardToday {
  expected: number;
  checked_in: number;
  on_time: number;
  late: number;
  office: number;
  wfh: number;
  on_leave: number;
  absent: number;
  no_check_in: number;
  wfh_awaiting: number;
  still_in: number;
}

export interface DashboardPending {
  employee_total: number;
  hr_total: number;
  total: number;
  wfh_employee: number;
  leave_employee: number;
  wfh_hr: number;
  leave_hr: number;
  oldest_employee_hours: number | null;
  oldest_hr_hours: number | null;
  oldest_hours: number | null;
}

export interface DashboardTrendPoint {
  date: string;
  expected: number;
  checked_in: number;
  on_time: number;
  late: number;
  office: number;
  wfh: number;
  office_on_time: number;
  office_late: number;
  wfh_on_time: number;
  wfh_late: number;
  on_leave: number;
  absent: number;
  no_check_in: number;
  rate: number | null;
}

export interface DashboardTotals {
  expected: number;
  checked_in: number;
  on_time: number;
  late: number;
  office: number;
  wfh: number;
  office_on_time: number;
  office_late: number;
  wfh_on_time: number;
  wfh_late: number;
  leave_days: number;
  absent_days: number;
  no_check_in: number;
  attendance_rate: number | null;
  on_time_rate: number | null;
  wfh_share: number | null;
  median_hours: number | null;
  completed_records: number;
  missing_checkouts: number;
}

export interface DashboardPrevious {
  attendance_rate: number | null;
  on_time_rate: number | null;
  expected: number;
  checked_in: number;
  absent_days: number;
}

export interface DashboardDepartment {
  department: string;
  headcount: number;
  checked_in: number;
  late: number;
  wfh: number;
  absent: number;
  attendance_rate: number | null;
}

export interface DashboardQueueItem {
  kind: "wfh" | "leave";
  id: string;
  name: string;
  code: string;
  department: string;
  request_date: string;
  created_at: string;
  age_hours: number;
}

export interface DashboardTeamMember {
  id: string;
  name: string;
  code: string;
  department: string;
  attendance_type: "office" | "wfh" | null;
  status: "present" | "late" | "absent" | null;
  check_in_at: string | null;
  check_out_at: string | null;
  on_leave: boolean;
}

export interface DashboardDisplay {
  id: string;
  name: string;
  office: string;
  is_active: boolean;
  last_seen_at: string | null;
}

export interface DashboardMetrics {
  generated_at: string;
  timezone: string;
  local_date: string;
  range_days: DashboardRange;
  viewer_role: "admin" | "hr";
  is_working_day: boolean;
  shift: DashboardShift;
  headcount: DashboardHeadcount;
  today: DashboardToday;
  pending: DashboardPending;
  range: {
    start_date: string;
    end_date: string;
    trend_start_date: string;
    totals: DashboardTotals;
    previous: DashboardPrevious;
    trend: DashboardTrendPoint[];
    departments: DashboardDepartment[];
  };
  month: {
    leave_days: number;
    leave_allowance: number;
    absent_days: number;
    wfh_days: number;
    feedback_reviews: number;
    feedback_coverage: number | null;
    avg_score: number | null;
  };
  approvals: {
    completed_by_hr: number;
    completed_total: number;
    median_response_hours: number | null;
    manual_corrections: number;
  };
  displays: {
    total: number;
    active: number;
    online: number;
    stale: number;
    offline: number;
    list: DashboardDisplay[];
  };
  queues: {
    employee: DashboardQueueItem[];
    hr: DashboardQueueItem[];
  };
  today_team: DashboardTeamMember[];
}

export async function fetchDashboardMetrics(
  companyId: string,
  days: DashboardRange,
): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc("get_dashboard_metrics", {
    p_company_id: companyId,
    p_days: days,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Dashboard metrics returned no data.");
  return data as DashboardMetrics;
}

function cleanNumber(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${cleanNumber(value)}%`;
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatAge(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainder = Math.round(hours % 24);
  return remainder > 0 ? `${days}d ${remainder}h` : `${days}d`;
}

export function formatDate(iso: string, long = false): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-IN", long
    ? { weekday: "short", day: "2-digit", month: "short" }
    : { day: "2-digit", month: "short" }
  ).format(date);
}

export function formatTime(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatDelta(
  current: number | null,
  previous: number | null,
  previousExpected: number,
  unit = "pt",
): string | null {
  if (current === null || previous === null || previousExpected < 5) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return `No change vs previous period`;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${cleanNumber(delta)} ${unit} vs previous period`;
}

export function rangeLabel(days: DashboardRange): string {
  return `Last ${days} days`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
