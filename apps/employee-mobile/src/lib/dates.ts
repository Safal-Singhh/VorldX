import {
  addDays,
  addMonths,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function todayInZone(timezone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

export function tomorrowInZone(timezone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(addDays(new Date(), 1), timezone, 'yyyy-MM-dd');
}

export function yesterdayInZone(timezone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(addDays(new Date(), -1), timezone, 'yyyy-MM-dd');
}

export function formatTime(iso: string | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), timezone, 'h:mm a');
}

export function formatDateLabel(date: string, pattern = 'dd MMM yyyy'): string {
  return format(parseISO(date), pattern);
}

export function formatDateLong(date: string): string {
  return format(parseISO(date), 'EEEE, dd MMMM');
}

export function formatMonth(date: string | Date): string {
  const value = typeof date === 'string' ? parseISO(date) : date;
  return format(value, 'MMMM yyyy');
}

export function formatMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function formatZoneDate(date: Date, timezone = DEFAULT_TIMEZONE, pattern = 'EEEE, dd MMMM') {
  return formatInTimeZone(date, timezone, pattern);
}

export function minutesBetween(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.max(0, differenceInMinutes(new Date(end), new Date(start)));
}

export function durationLabel(minutes: number | null): string {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

export function monthBounds(month: Date): { start: string; end: string } {
  return {
    start: format(startOfMonth(month), 'yyyy-MM-dd'),
    end: format(endOfMonth(month), 'yyyy-MM-dd'),
  };
}

export function calendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function previousMonth(month: Date): Date {
  return subMonths(month, 1);
}

export function nextMonth(month: Date): Date {
  return addMonths(month, 1);
}

export function isToday(date: Date, timezone = DEFAULT_TIMEZONE): boolean {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
}

export function isCurrentMonth(date: Date, month: Date): boolean {
  return isSameMonth(date, month);
}

export { isSameDay };

/**
 * Returns the deadline for a request date: shift start minus the company cutoff.
 * The shift time is interpreted in the company's timezone.
 */
export function requestDeadline(
  requestDate: string,
  shiftStart: string,
  cutoffMinutes: number,
  timezone = DEFAULT_TIMEZONE,
): Date {
  const [hours, minutes] = shiftStart.split(':').map(Number);
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  const zoned = fromZonedTime(`${requestDate}T${time}`, timezone);
  return new Date(zoned.getTime() - cutoffMinutes * 60_000);
}

export function deadlineLabel(
  deadline: Date,
  timezone = DEFAULT_TIMEZONE,
  referenceDate?: string,
): string {
  const day = formatInTimeZone(deadline, timezone, 'dd MMM');
  const time = formatInTimeZone(deadline, timezone, 'h:mm a');
  if (referenceDate && day === formatDateLabel(referenceDate, 'dd MMM')) return time;
  return `${day}, ${time}`;
}

export function minutesLabel(minutes: number): string {
  if (minutes <= 0) return '0 minutes';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const base = `${hours} hour${hours === 1 ? '' : 's'}`;
  return rest ? `${base} ${rest} min` : base;
}

export function timeLabelFromDb(time: string): string {
  const [hourString, minuteString] = time.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 || 12;
  return `${normalized}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function workingDaysLabel(days: number[]): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (!days.length) return 'Not set';
  if (days.join(',') === '1,2,3,4,5') return 'Mon – Fri';
  return days.map((day) => names[day] ?? '').filter(Boolean).join(', ');
}
