export type Role = 'admin' | 'hr' | 'employee';
export type AttendanceType = 'office' | 'wfh';
export type AttendanceStatus = 'present' | 'late' | 'absent';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Company {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  is_active: boolean;
}

export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: Role;
  status: string;
}

export interface Employee {
  id: string;
  company_id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  joining_date: string;
  shift_id: string | null;
  work_type: string;
  is_active: boolean;
}

export interface Shift {
  id: string;
  company_id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  working_days: number[];
  is_active: boolean;
}

export interface AttendancePolicy {
  id: string;
  company_id: string;
  wfh_enabled: boolean;
  wfh_eligibility_rules: string;
  request_cutoff_minutes: number;
  auto_absent_enabled: boolean;
  auto_absent_started_at: string;
}

export interface AttendanceRecord {
  id: string;
  company_id: string;
  employee_id: string;
  work_date: string;
  attendance_type: AttendanceType | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: AttendanceStatus;
  source: string;
}

export interface WfhRequest {
  id: string;
  company_id: string;
  employee_id: string;
  request_date: string;
  reason: string;
  status: RequestStatus;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  company_id: string;
  employee_id: string;
  leave_date: string;
  reason: string;
  status: RequestStatus;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface WfhPasscode {
  passcode: string | null;
  uses_left: number;
  expires_at: string;
  used_up: boolean;
  expired: boolean;
}

export interface FeedbackReview {
  id: string;
  company_id: string;
  subject_employee_id: string;
  period_start: string;
  period_end: string;
  comments: string;
  status: string;
  created_at: string;
}

export interface FeedbackRating {
  id: string;
  review_id: string;
  criterion: string;
  score: number;
  comments: string | null;
}

export interface OfficeAttendanceResult {
  id: string;
  work_date: string;
  type: AttendanceType;
  check_in_at: string;
  check_out_at: string | null;
  status: AttendanceStatus;
}

export interface WfhAttendanceResult {
  id: string;
  work_date: string;
  check_in_at: string;
  check_out_at: string | null;
  status: AttendanceStatus;
  action: 'checkin' | 'checkout';
  uses_left: number;
}
