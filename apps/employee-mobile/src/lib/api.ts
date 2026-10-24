import { supabase, supabaseConfigured } from './supabase';
import { AppError } from './errors';
import type {
  AttendanceRecord,
  FeedbackRating,
  FeedbackReview,
  LeaveRequest,
  OfficeAttendanceResult,
  WfhAttendanceResult,
  WfhPasscode,
  WfhRequest,
} from './types';

async function responseError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: string; message?: string };
      return body.error ?? body.message ?? `Request failed (${context.status})`;
    } catch {
      return `Request failed (${context.status})`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? 'Request failed');
}

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabaseConfigured) throw new AppError('NOT_CONFIGURED');

  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await responseError(error);
    throw new AppError(message, message, (error as { context?: Response }).context?.status);
  }

  const serverError = (data as { error?: string } | null)?.error;
  if (serverError) throw new AppError(serverError);
  return data as T;
}

export async function fetchAttendanceBetween(start: string, end: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: false });
  if (error) throw new AppError(error.message);
  return (data ?? []) as AttendanceRecord[];
}

export async function fetchAttendanceRecent(limit = 90): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .order('work_date', { ascending: false })
    .limit(limit);
  if (error) throw new AppError(error.message);
  return (data ?? []) as AttendanceRecord[];
}

export async function fetchWfhRequests(limit = 40): Promise<WfhRequest[]> {
  const { data, error } = await supabase
    .from('wfh_requests')
    .select('*')
    .order('request_date', { ascending: false })
    .limit(limit);
  if (error) throw new AppError(error.message);
  return (data ?? []) as WfhRequest[];
}

export async function fetchLeaveRequests(limit = 100): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .order('leave_date', { ascending: false })
    .limit(limit);
  if (error) throw new AppError(error.message);
  return (data ?? []) as LeaveRequest[];
}

export async function fetchWfhPasscode(requestId: string): Promise<WfhPasscode> {
  const { data, error } = await supabase.rpc('my_wfh_passcode', { p_request_id: requestId });
  if (error) throw new AppError(error.message);
  return data as WfhPasscode;
}

export async function fetchFeedback(): Promise<{
  reviews: FeedbackReview[];
  ratings: FeedbackRating[];
}> {
  const { data: reviews, error } = await supabase
    .from('feedback_reviews')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(12);
  if (error) throw new AppError(error.message);

  const reviewList = (reviews ?? []) as FeedbackReview[];
  if (!reviewList.length) return { reviews: [], ratings: [] };

  const { data: ratings, error: ratingsError } = await supabase
    .from('feedback_ratings')
    .select('*')
    .in(
      'review_id',
      reviewList.map((review) => review.id),
    );
  if (ratingsError) throw new AppError(ratingsError.message);

  return { reviews: reviewList, ratings: (ratings ?? []) as FeedbackRating[] };
}

export function markOfficeAttendance(token: string) {
  return invokeFunction<OfficeAttendanceResult>('process-office-attendance', { token });
}

export function markWfhAttendance(passcode: string) {
  return invokeFunction<WfhAttendanceResult>('mark-wfh-attendance', { passcode });
}

export function submitWfhRequest(requestDate: string, reason: string) {
  return invokeFunction<string>('submit-wfh-request', {
    request_date: requestDate,
    reason,
  });
}

export function submitLeaveRequest(leaveDate: string, reason: string) {
  return invokeFunction<string>('submit-leave-request', {
    leave_date: leaveDate,
    reason,
  });
}
