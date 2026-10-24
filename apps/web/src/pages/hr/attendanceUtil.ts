import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Employee } from "../../lib/types";

export interface TodayRecord {
  id: string; attendance_type: "office" | "wfh" | null; check_in_at: string | null; check_out_at: string | null; status: string;
}

const ATTENDANCE_ERRORS: Record<string, string> = {
  SHIFT_ENDED: "Your shift has ended, so check-in is closed for today. Ask HR or Admin to correct your attendance if you were present.",
  ABSENT_FINAL: "Today is marked Absent, so the app can no longer change it. Ask HR or Admin to correct your attendance.",
  CHECK_IN_REQUIRED: "Check in first before checking out.",
  ALREADY_CHECKED_OUT: "You have already checked out today.",
  NO_CHECKIN: "No WFH check-in was found for today.",
  QR_EXPIRED: "That QR code has expired. Point the camera at the display again.",
  QR_INVALID: "This is not a valid VorldX office QR code.",
  PASSCODE_EXPIRED: "This passcode has expired. Ask HR or Admin to issue a new one.",
  PASSCODE_USED: "This passcode has already been used for check-in and check-out.",
};

export function friendlyEdgeError(raw: string | null | undefined): string | undefined {
  const code = raw?.trim();
  if (!code) return undefined;
  return ATTENDANCE_ERRORS[code] ?? code;
}

export function useHrEmployee() {
  const { userId } = useAuth();
  const [me, setMe] = useState<Employee | null>(null);
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [recordChecked, setRecordChecked] = useState(false);

  const load = async () => {
    if (!userId) return;
    const { data: emp } = await supabase.from("employees").select("*").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle();
    setRecordChecked(true);
    if (!emp) { setMe(null); setToday(null); return; }
    setMe(emp as Employee);
    const wd = new Date().toISOString().slice(0, 10);
    const { data: rec } = await supabase.from("attendance_records").select("*").eq("employee_id", (emp as Employee).id).eq("work_date", wd).maybeSingle();
    setToday((rec ?? null) as TodayRecord | null);
  };

  useEffect(() => { load(); }, [userId]);

  return { me, today, recordChecked, load };
}

export async function edgeText(err: unknown, fallback?: string): Promise<string> {
  const e = err as { message?: string; context?: unknown };
  try {
    const ctx = e?.context as Response | undefined;
    if (ctx instanceof Response) {
      const j = (await ctx.clone().json()) as { error?: string };
      if (j?.error) return friendlyEdgeError(j.error) ?? "Request failed";
    }
  } catch { /* ignore */ }
  return friendlyEdgeError(e?.message) ?? fallback ?? e?.message ?? "Request failed";
}
