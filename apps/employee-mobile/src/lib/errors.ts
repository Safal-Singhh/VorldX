export class AppError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message?: string, status?: number) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  EMPLOYEE_NOT_FOUND: 'No active employee record is linked to this account.',
  EMPLOYEE_INACTIVE: 'Your employee record is inactive. Contact your HR or Admin.',
  EMPLOYEE_MISMATCH: 'This request does not belong to your account.',
  COMPANY_INACTIVE: 'Your company account is inactive.',
  COMPANY_MISMATCH: 'This QR code belongs to a different company.',
  MEMBERSHIP_INACTIVE: 'Your company membership is inactive. Contact your HR or Admin.',
  NOT_ACTIVATED: 'Your account is not fully activated. Contact your HR or Admin.',
  QR_INVALID: 'This is not a valid VorldX office QR code.',
  QR_EXPIRED: 'That QR code has expired. Point the camera at the display again.',
  DISPLAY_INACTIVE: 'That office display is disabled.',
  DISPLAY_DISABLED: 'That office display is disabled.',
  TYPE_CONFLICT: 'You already have a different attendance type recorded today.',
  SHIFT_ENDED: 'Your shift has ended, so check-in is closed for today. Ask HR or Admin to correct your attendance if you were present.',
  ABSENT_FINAL: 'Today is marked absent, so check-in and check-out are closed. Ask HR or Admin to correct your attendance.',
  CHECK_IN_REQUIRED: 'Check in first before checking out.',
  ALREADY_CHECKED_OUT: 'You have already checked out today.',
  PASSCODE_INVALID: 'That passcode is not valid. Check the six digits and try again.',
  PASSCODE_USED: 'This passcode has already been used for check-in and check-out.',
  PASSCODE_EXPIRED: 'This passcode has expired.',
  PASSCODE_WRONG_USER: 'This passcode belongs to a different employee.',
  PASSCODE_WRONG_DATE: 'This passcode is for a different work date.',
  PASSCODE_NOT_ISSUED: 'Your approved request does not have a passcode yet. Ask your Admin to issue it.',
  NO_CHECKIN: 'No WFH check-in was found for today.',
  REQUEST_NOT_FOUND: 'That request could not be found.',
  REASON_TOO_SHORT: 'Please write at least 5 characters for the reason.',
  INVALID_DATE: 'That date is not available for a request.',
  ATTENDANCE_EXISTS: 'Attendance already exists for that date.',
  DUPLICATE_REQUEST: 'You already have a request for that date.',
  MONTHLY_LIMIT: 'You have used all 3 leave requests for that month.',
  WFH_DISABLED: 'Work-from-home requests are disabled for your company.',
  CUTOFF_PASSED: 'The request cutoff for that date has passed.',
  UNAUTHORIZED: 'You do not have permission to do that.',
  NOT_CONFIGURED: 'The app is not configured. Check the Supabase environment variables.',
  NETWORK: 'Could not reach VorldX. Check your connection and try again.',
};

export function friendlyError(error: unknown): string {
  if (error instanceof AppError) {
    return MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error) {
    const raw = error.message.replace(/^Error:\s*/i, '').trim();
    if (MESSAGES[raw]) return MESSAGES[raw];
    if (raw === 'Failed to fetch' || raw.includes('Network request failed')) {
      return MESSAGES.NETWORK;
    }
    if (/^[A-Z0-9_]+$/.test(raw)) return MESSAGES[raw] ?? 'Something went wrong. Please try again.';
    return raw || 'Something went wrong. Please try again.';
  }

  if (typeof error === 'string') return MESSAGES[error] ?? error;
  return 'Something went wrong. Please try again.';
}

export function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)) return error.message;
  return 'UNKNOWN';
}
