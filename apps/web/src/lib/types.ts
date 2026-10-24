export type Role = "admin" | "hr" | "employee";
export interface Company { id: string; name: string; slug: string; timezone: string; is_active: boolean; }
export interface Membership { id: string; company_id: string; user_id: string; role: Role; status: string; companies?: Company; }
export interface Employee { id: string; company_id: string; user_id: string | null; employee_code: string; full_name: string; email: string; department: string; designation: string; joining_date: string; shift_id: string | null; work_type: string; is_active: boolean; created_by: string | null; }
export interface Shift { id: string; name: string; start_time: string; end_time: string; grace_period_minutes: number; }
export interface AttendanceRecord { id: string; company_id: string; employee_id: string; work_date: string; attendance_type: "office" | "wfh" | null; check_in_at: string | null; check_out_at: string | null; status: "present" | "late" | "absent"; source: string; employees?: Employee; }
export interface WfhRequest { id: string; company_id: string; employee_id: string; request_date: string; reason: string; status: "pending" | "approved" | "rejected" | "cancelled"; reviewed_by: string | null; reviewed_at: string | null; review_notes: string | null; created_at: string; employees?: Employee; }
export interface QrDisplay { id: string; company_id: string; display_name: string; office_name: string; is_active: boolean; paired_at: string; last_seen_at: string | null; device_secret_hash?: string | null; }
export interface Policy { id: string; company_id: string; wfh_enabled: boolean; wfh_eligibility_rules: string; request_cutoff_minutes: number; auto_absent_enabled: boolean; auto_absent_started_at: string; }
export interface FeedbackReview { id: string; company_id: string; subject_employee_id: string; reviewer_user_id: string; period_start: string; period_end: string; comments: string; employees?: Employee; }
