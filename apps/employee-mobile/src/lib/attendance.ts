import { format, parseISO, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import type { AttendanceRecord, LeaveRequest, WfhRequest } from './types';
import { DEFAULT_TIMEZONE, minutesBetween, todayInZone } from './dates';
import type { Tone } from '@/constants/theme';

export function recordTone(record: AttendanceRecord): Tone {
  if (record.status === 'absent') return 'danger';
  if (record.attendance_type === 'wfh') return 'info';
  return record.status === 'late' ? 'warning' : 'success';
}

export function recordTypeLabel(record: AttendanceRecord): string {
  if (record.status === 'absent') return 'Absent';
  return record.attendance_type === 'wfh' ? 'Work from home' : 'Office';
}

export function todayRecord(
  records: AttendanceRecord[],
  timezone = DEFAULT_TIMEZONE,
): AttendanceRecord | null {
  const today = todayInZone(timezone);
  return records.find((record) => record.work_date === today) ?? null;
}

export function todayApprovedWfh(
  requests: WfhRequest[],
  timezone = DEFAULT_TIMEZONE,
): WfhRequest | null {
  const today = todayInZone(timezone);
  return (
    requests.find((request) => request.request_date === today && request.status === 'approved') ??
    null
  );
}

export function todayApprovedLeave(
  requests: LeaveRequest[],
  timezone = DEFAULT_TIMEZONE,
): LeaveRequest | null {
  const today = todayInZone(timezone);
  return (
    requests.find((request) => request.leave_date === today && request.status === 'approved') ?? null
  );
}

export function monthRecords(records: AttendanceRecord[], monthKey: string): AttendanceRecord[] {
  return records.filter((record) => record.work_date.startsWith(monthKey));
}

export function monthLeaves(leaves: LeaveRequest[], monthKey: string): LeaveRequest[] {
  return leaves.filter(
    (leave) =>
      leave.leave_date.startsWith(monthKey) &&
      (leave.status === 'approved' || leave.status === 'pending'),
  );
}

export function monthStats(records: AttendanceRecord[], leaves: LeaveRequest[]) {
  const present = records.filter(
    (record) => record.attendance_type === 'office' && record.status === 'present',
  ).length;
  const late = records.filter(
    (record) => record.attendance_type === 'office' && record.status === 'late',
  ).length;
  const wfh = records.filter((record) => record.attendance_type === 'wfh').length;
  const absent = records.filter((record) => record.status === 'absent').length;
  const approvedLeave = leaves.filter((leave) => leave.status === 'approved').length;
  return { present, late, wfh, absent, approvedLeave, total: records.length };
}

export function leaveUsageForMonth(leaves: LeaveRequest[], monthKey: string): number {
  return leaves.filter(
    (leave) =>
      leave.leave_date.startsWith(monthKey) &&
      (leave.status === 'pending' || leave.status === 'approved'),
  ).length;
}

export function previousLeaveUsage(leaves: LeaveRequest[], monthKey: string): LeaveRequest[] {
  return leaves.filter(
    (leave) =>
      leave.leave_date.startsWith(monthKey) &&
      (leave.status === 'pending' || leave.status === 'approved'),
  );
}

export function weekHoursSeries(
  records: AttendanceRecord[],
  timezone = DEFAULT_TIMEZONE,
): { label: string; value: number; absent: boolean }[] {
  const today = todayInZone(timezone);
  const byDate = new Map(records.map((record) => [record.work_date, record]));
  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = subDays(parseISO(today), 6 - index);
    const key = format(date, 'yyyy-MM-dd');
    const record = byDate.get(key);
    const absent = record?.status === 'absent';
    let minutes = 0;
    if (record?.check_in_at) {
      if (record.check_out_at) {
        minutes = minutesBetween(record.check_in_at, record.check_out_at) ?? 0;
      } else if (key === today) {
        minutes = Math.max(0, minutesBetween(record.check_in_at, new Date().toISOString()) ?? 0);
      }
    }
    return {
      label: format(date, 'EEEEE'),
      value: Math.round((minutes / 60) * 10) / 10,
      absent,
    };
  });
  return days;
}

export function weekHoursTotal(series: { value: number }[]): number {
  return Math.round(series.reduce((sum, point) => sum + point.value, 0) * 10) / 10;
}

export function attendanceMarks(
  records: AttendanceRecord[],
  leaves: LeaveRequest[],
): Record<string, { tone: Tone; label: string }> {
  const marks: Record<string, { tone: Tone; label: string }> = {};
  for (const record of records) {
    marks[record.work_date] =
      record.status === 'absent'
        ? { tone: 'danger', label: 'Absent' }
        : record.attendance_type === 'wfh'
          ? { tone: 'info', label: 'Work from home' }
          : record.status === 'late'
            ? { tone: 'warning', label: 'Late' }
            : { tone: 'success', label: 'Present' };
  }
  for (const leave of leaves) {
    if (leave.status !== 'approved' || marks[leave.leave_date]) continue;
    marks[leave.leave_date] = { tone: 'leave', label: 'Approved leave' };
  }
  return marks;
}

export function greeting(timezone = DEFAULT_TIMEZONE): string {
  const hour = Number(formatInTimeZone(new Date(), timezone, 'H'));
  if (hour < 5) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function todayLongDate(timezone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(), timezone, 'EEEE, dd MMMM');
}

export function formatLeavePeriod(request: LeaveRequest, timezone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(`${request.leave_date}T12:00:00`), timezone, 'dd MMM yyyy');
}
