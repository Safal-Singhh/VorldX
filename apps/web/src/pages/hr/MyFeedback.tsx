import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Empty, PageHeader } from "../../components/ui";

export function HrMyFeedback() {
  const { userId } = useAuth();
  const [reviews, setReviews] = useState<{ id: string; period_start: string; period_end: string; comments: string }[]>([]);
  const [ratings, setRatings] = useState<{ criterion: string; score: number }[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: emp } = await supabase.from("employees").select("id").eq("user_id", userId).eq("is_active", true).limit(1).single();
      if (!emp) return;
      const { data: rev } = await supabase.from("feedback_reviews").select("id,period_start,period_end,comments").eq("subject_employee_id", (emp as { id: string }).id).order("period_start", { ascending: false }).limit(10);
      setReviews((rev ?? []) as never);
      if (rev?.[0]) {
        const { data: rat } = await supabase.from("feedback_ratings").select("criterion,score").eq("review_id", (rev[0] as { id: string }).id);
        setRatings((rat ?? []) as never);
      }
    })();
  }, [userId]);

  return (
    <div>
      <PageHeader title="My feedback" sub="Reviews written about you by Admin." />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="glass p-4">
          <div className="font-semibold text-sm mb-2">Latest criterion scores</div>
          {ratings.length === 0 ? <Empty msg="No ratings yet." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ratings}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="criterion" tick={{ fontSize: 10 }} interval={0} angle={-20} height={60} /><YAxis domain={[0, 10]} /><Tooltip /> <Bar dataKey="score" fill="#5965F2" /></BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="glass p-4">
          <div className="font-semibold text-sm mb-2">History</div>
          {reviews.length === 0 ? <Empty msg="No feedback addressed to you yet." /> : reviews.map((r) => <div key={r.id} className="text-sm py-2" style={{ borderTop: "1px solid var(--vx-border)" }}><div className="mono text-xs opacity-60">{r.period_start} → {r.period_end}</div><div>{r.comments || "—"}</div></div>)}
        </div>
      </div>
    </div>
  );
}
