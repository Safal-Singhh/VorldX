import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/ui";

export function HrPolicies() {
  const { company } = useAuth();
  const [policy, setPolicy] = useState<{ wfh_enabled: boolean; request_cutoff_minutes: number; wfh_eligibility_rules: string; auto_absent_enabled: boolean; auto_absent_started_at: string } | null>(null);
  const [shift, setShift] = useState<{ name: string; start_time: string; end_time: string; grace_period_minutes: number } | null>(null);

  useEffect(() => {
    if (!company) return;
    (async () => {
      const { data: p } = await supabase.from("attendance_policies").select("*").eq("company_id", company.id).single();
      const { data: s } = await supabase.from("shifts").select("*").eq("company_id", company.id).limit(1).single();
      if (p) setPolicy(p as never);
      if (s) setShift(s as never);
    })();
  }, [company]);

  return (
    <div>
      <PageHeader title="Policies" sub="Only an Admin can change these settings." />
      <div className="glass p-5 max-w-xl grid gap-2 text-sm">
        <div>WFH: <b>{policy?.wfh_enabled ? "Enabled" : "Disabled"}</b></div>
        <div>Auto-absence: <b>{policy?.auto_absent_enabled ? "Enabled" : "Disabled"}</b></div>
        <div className="mono">Cutoff: 120 minutes before assigned shift</div>
        {shift && <div className="mono">Shift {shift.name}: {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)} · grace {shift.grace_period_minutes}m</div>}
        <div className="opacity-70 text-xs">
          When enabled, active HR and employees with no check-in are marked Absent at shift end on a working day.
          Approved leave is excluded, and past days are never backfilled.
        </div>
        {policy?.auto_absent_started_at && (
          <div className="mono text-xs opacity-70">Tracking since {new Date(policy.auto_absent_started_at).toLocaleString()}</div>
        )}
        <div className="opacity-70">{policy?.wfh_eligibility_rules || "No additional eligibility rules."}</div>
      </div>
    </div>
  );
}
