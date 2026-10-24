import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Info,
  MessageSquare,
  RotateCw,
  Star,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

interface FeedbackReview {
  id: string;
  company_id: string;
  subject_employee_id: string;
  reviewer_user_id: string;
  period_start: string;
  period_end: string;
  comments: string;
  status: string;
  created_at: string;
}

interface FeedbackRating {
  id: string;
  review_id: string;
  criterion: string;
  score: number;
  comments: string | null;
}

interface ScoreItem {
  label: string;
  score: number;
}

/** Formats criteria keys like 'teamwork_collaboration' into 'Teamwork & Collaboration' */
function formatCriterionLabel(key: string): string {
  const customMap: Record<string, string> = {
    punctuality: "Punctuality",
    attendance_consistency: "Attendance Consistency",
    teamwork_collaboration: "Teamwork & Collaboration",
    adaptability: "Adaptability",
    accountability: "Accountability",
  };
  if (customMap[key]) return customMap[key];
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Formats ISO dates into 'DD MMM YYYY' */
function formatDateLabel(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/** Pure SVG Circular Progress Ring */
function ProgressRing({
  progress,
  size = 96,
  stroke = 8,
  label,
  sublabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  const gradId = `ringGrad-${size}-${Math.round(progress * 100)}`;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5965f2" />
            <stop offset="100%" stopColor="#8c95ff" />
          </linearGradient>
        </defs>
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(145, 148, 186, 0.14)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Fill circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          style={{ transition: "stroke-dashoffset 0.65s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {label ? (
          <span
            className="font-bold tracking-tight text-white leading-none mono"
            style={{ fontSize: `${Math.round(size * 0.22)}px` }}
          >
            {label}
          </span>
        ) : null}
        {sublabel ? (
          <span
            className="text-[9px] uppercase tracking-wider font-medium mt-1 leading-none"
            style={{ color: "var(--vx-text-muted)" }}
          >
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Horizontal score bars with threshold coloring */
function ScoreBars({ items, max = 10 }: { items: ScoreItem[]; max?: number }) {
  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const ratio = Math.min(1, Math.max(0, item.score / max));
        const color =
          ratio >= 0.8
            ? "var(--vx-success)" // #45D6A6
            : ratio >= 0.6
            ? "var(--vx-indigo)" // #5965F2
            : "var(--vx-warning)"; // #F5C76B

        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium" style={{ color: "var(--vx-text-secondary)" }}>
                {formatCriterionLabel(item.label)}
              </span>
              <span className="mono font-semibold text-white">
                {item.score.toFixed(1)}
                <span className="text-[10px] font-normal ml-1" style={{ color: "var(--vx-text-muted)" }}>
                  / {max}
                </span>
              </span>
            </div>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(145, 148, 186, 0.14)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.round(ratio * 100)}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}33`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HrMyFeedback() {
  const { userId, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviews, setReviews] = useState<FeedbackReview[]>([]);
  const [ratings, setRatings] = useState<FeedbackRating[]>([]);

  const loadFeedback = useCallback(async () => {
    if (!userId) return;
    setErrorMsg(null);
    try {
      // 1. Get the HR's employee record
      let empQuery = supabase
        .from("employees")
        .select("id, full_name, employee_code")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (company?.id) {
        empQuery = empQuery.eq("company_id", company.id);
      }

      const { data: emp, error: empErr } = await empQuery.limit(1).maybeSingle();

      if (empErr) throw new Error(empErr.message);
      if (!emp) {
        setReviews([]);
        setRatings([]);
        return;
      }

      // 2. Query feedback reviews where subject_employee_id = emp.id
      const { data: revData, error: revErr } = await supabase
        .from("feedback_reviews")
        .select("*")
        .eq("subject_employee_id", emp.id)
        .order("period_start", { ascending: false })
        .limit(16);

      if (revErr) throw new Error(revErr.message);

      const reviewList = (revData ?? []) as FeedbackReview[];
      setReviews(reviewList);

      if (!reviewList.length) {
        setRatings([]);
        return;
      }

      // 3. Query all ratings for these reviews
      const reviewIds = reviewList.map((r) => r.id);
      const { data: ratData, error: ratErr } = await supabase
        .from("feedback_ratings")
        .select("*")
        .in("review_id", reviewIds);

      if (ratErr) throw new Error(ratErr.message);

      setRatings((ratData ?? []) as FeedbackRating[]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load feedback records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, company?.id]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeedback();
  };

  // Determine whether scores are based on 10-point or 5-point scale
  const maxScale = useMemo(() => {
    return ratings.some((r) => r.score > 5) ? 10 : 5;
  }, [ratings]);

  // Aggregate criteria averages across all reviews
  const criteriaAverages = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of ratings) {
      const current = map.get(r.criterion) ?? { total: 0, count: 0 };
      current.total += r.score;
      current.count += 1;
      map.set(r.criterion, current);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, score: v.total / v.count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ratings]);

  // Overall average
  const overallAverage = useMemo(() => {
    if (!criteriaAverages.length) return 0;
    return criteriaAverages.reduce((sum, item) => sum + item.score, 0) / criteriaAverages.length;
  }, [criteriaAverages]);

  // Latest review average
  const latestAverage = useMemo(() => {
    const latest = reviews[0];
    if (!latest) return null;
    const values = ratings.filter((r) => r.review_id === latest.id);
    if (!values.length) return null;
    return values.reduce((sum, r) => sum + r.score, 0) / values.length;
  }, [ratings, reviews]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">My feedback</h1>
          <p className="text-sm mt-1" style={{ color: "var(--vx-text-secondary)" }}>
            Scores and written reviews shared by your company Admin.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs py-2 px-3.5"
          title="Refresh feedback data"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Notice Banner */}
      <div
        className="glass p-4 rounded-2xl flex items-start gap-3.5 border-l-4 transition-all"
        style={{
          borderLeftColor: "var(--vx-info)",
          background: "rgba(118, 184, 255, 0.05)",
        }}
      >
        <div
          className="p-2 rounded-xl shrink-0 mt-0.5"
          style={{ background: "rgba(118, 184, 255, 0.14)", color: "var(--vx-info)" }}
        >
          <Info className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Read-only review</div>
          <div className="text-xs sm:text-sm mt-0.5 leading-relaxed" style={{ color: "var(--vx-text-secondary)" }}>
            Feedback is read-only. Scores and comments are shared by your Admin after each review period to highlight operational excellence and areas for growth.
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          <div className="glass p-6 rounded-2xl animate-pulse h-36" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass p-5 rounded-2xl animate-pulse h-24" />
            <div className="glass p-5 rounded-2xl animate-pulse h-24" />
            <div className="glass p-5 rounded-2xl animate-pulse h-24" />
          </div>
          <div className="glass p-6 rounded-2xl animate-pulse h-48" />
        </div>
      ) : errorMsg ? (
        <div className="glass p-6 rounded-2xl flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-2xl" style={{ background: "rgba(255, 107, 131, 0.12)", color: "var(--vx-danger)" }}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="text-base font-semibold text-white">Unable to load feedback</div>
          <p className="text-xs sm:text-sm max-w-md" style={{ color: "var(--vx-text-secondary)" }}>
            {errorMsg}
          </p>
          <button onClick={handleRefresh} className="btn-primary mt-2 text-xs py-2 px-4">
            Try again
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="glass-strong p-10 sm:p-14 rounded-2xl flex flex-col items-center text-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(89, 101, 242, 0.12)",
              color: "var(--vx-indigo)",
              border: "1px solid rgba(89, 101, 242, 0.22)",
            }}
          >
            <MessageSquare className="w-7 h-7" strokeWidth={1.8} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">No feedback yet</h2>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--vx-text-secondary)" }}>
              Your company Admin has not submitted any feedback reviews for your profile yet.
              Scores, ratings, and comments will appear here once published.
            </p>
          </div>
          <div
            className="text-xs px-3.5 py-1.5 rounded-full mono font-medium mt-2"
            style={{ background: "rgba(184, 190, 255, 0.08)", color: "var(--vx-text-muted)" }}
          >
            Awaiting administrator review
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Performance Hero Card */}
          <div className="glass-strong p-6 sm:p-7 rounded-2xl flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <ProgressRing
              progress={overallAverage / maxScale}
              size={108}
              stroke={10}
              label={overallAverage.toFixed(1)}
              sublabel="avg score"
            />
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Overall performance</h2>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--vx-text-secondary)" }}>
                Averaged across {criteriaAverages.length} criteria in {reviews.length} review
                {reviews.length === 1 ? "" : "s"}.
              </p>
              <div className="pt-1 flex justify-center sm:justify-start">
                {latestAverage == null ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mono"
                    style={{ background: "rgba(184, 190, 255, 0.1)", color: "var(--vx-text-secondary)" }}
                  >
                    No score yet
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mono"
                    style={{
                      background:
                        latestAverage >= maxScale * 0.8
                          ? "rgba(69, 214, 166, 0.15)"
                          : "rgba(245, 199, 107, 0.15)",
                      color:
                        latestAverage >= maxScale * 0.8
                          ? "var(--vx-success)"
                          : "var(--vx-warning)",
                      border: `1px solid ${
                        latestAverage >= maxScale * 0.8
                          ? "rgba(69, 214, 166, 0.3)"
                          : "rgba(245, 199, 107, 0.3)"
                      }`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{
                        backgroundColor:
                          latestAverage >= maxScale * 0.8
                            ? "var(--vx-success)"
                            : "var(--vx-warning)",
                      }}
                    />
                    Latest {latestAverage.toFixed(1)} / {maxScale}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI Stat Tiles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Reviews Tile */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold font-mono" style={{ color: "var(--vx-text-muted)" }}>
                  Reviews
                </div>
                <div className="text-3xl font-bold mono mt-1 text-white">{reviews.length}</div>
                <div className="text-xs mt-1" style={{ color: "var(--vx-text-secondary)" }}>
                  shared
                </div>
              </div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(89, 101, 242, 0.14)", color: "var(--vx-indigo)" }}
              >
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>

            {/* Criteria Tile */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold font-mono" style={{ color: "var(--vx-text-muted)" }}>
                  Criteria
                </div>
                <div className="text-3xl font-bold mono mt-1 text-white">{criteriaAverages.length}</div>
                <div className="text-xs mt-1" style={{ color: "var(--vx-text-secondary)" }}>
                  scored
                </div>
              </div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(69, 214, 166, 0.14)", color: "var(--vx-success)" }}
              >
                <Star className="w-5 h-5" />
              </div>
            </div>

            {/* Rating Tile */}
            <div className="glass p-5 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold font-mono" style={{ color: "var(--vx-text-muted)" }}>
                  Rating
                </div>
                <div className="text-3xl font-bold mono mt-1 text-white">
                  {criteriaAverages.length ? overallAverage.toFixed(1) : "—"}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--vx-text-secondary)" }}>
                  average of {maxScale}
                </div>
              </div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    overallAverage >= maxScale * 0.8
                      ? "rgba(69, 214, 166, 0.14)"
                      : "rgba(245, 199, 107, 0.14)",
                  color:
                    overallAverage >= maxScale * 0.8
                      ? "var(--vx-success)"
                      : "var(--vx-warning)",
                }}
              >
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Criteria Averages Card */}
          {criteriaAverages.length > 0 ? (
            <div className="glass p-6 rounded-2xl space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white">Criteria averages</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--vx-text-muted)" }}>
                  Normalized average across all completed review periods (scores shown out of {maxScale}).
                </p>
              </div>
              <ScoreBars items={criteriaAverages} max={maxScale} />
            </div>
          ) : null}

          {/* Detailed Review Cards List */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Review history</h3>
              <span className="text-xs font-mono" style={{ color: "var(--vx-text-muted)" }}>
                {reviews.length} {reviews.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            <div className="space-y-4">
              {reviews.map((review) => {
                const reviewRatings = ratings.filter((r) => r.review_id === review.id);
                const reviewAvg = reviewRatings.length
                  ? reviewRatings.reduce((sum, r) => sum + r.score, 0) / reviewRatings.length
                  : null;
                const items: ScoreItem[] = reviewRatings
                  .map((r) => ({ label: r.criterion, score: r.score }))
                  .sort((a, b) => a.label.localeCompare(b.label));

                return (
                  <div
                    key={review.id}
                    className="glass p-5 sm:p-6 rounded-2xl space-y-4 hover:border-white/20 transition-all duration-200"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" style={{ color: "var(--vx-indigo)" }} />
                          <span className="font-semibold text-sm text-white">
                            {formatDateLabel(review.period_start)} – {formatDateLabel(review.period_end)}
                          </span>
                        </div>
                        <div className="text-xs font-medium" style={{ color: "var(--vx-text-muted)" }}>
                          Review period
                        </div>
                      </div>

                      {reviewAvg == null ? (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-mono uppercase self-start sm:self-auto"
                          style={{ background: "rgba(184, 190, 255, 0.12)", color: "var(--vx-text-secondary)" }}
                        >
                          {review.status || "Submitted"}
                        </span>
                      ) : (
                        <div className="self-start sm:self-auto">
                          <ProgressRing
                            progress={reviewAvg / maxScale}
                            size={66}
                            stroke={6.5}
                            label={reviewAvg.toFixed(1)}
                            sublabel={`of ${maxScale}`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Reviewer Comments */}
                    {review.comments ? (
                      <div
                        className="p-4 rounded-xl space-y-1.5"
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.035)",
                          border: "1px solid rgba(184, 190, 255, 0.08)",
                        }}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--vx-text-muted)" }}>
                          Admin comments
                        </div>
                        <div className="text-sm leading-relaxed" style={{ color: "var(--vx-text-secondary)" }}>
                          {review.comments}
                        </div>
                      </div>
                    ) : null}

                    {/* Criteria Score Bars */}
                    {items.length ? (
                      <div className="pt-1">
                        <ScoreBars items={items} max={maxScale} />
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: "var(--vx-text-muted)" }}>
                        No individual criteria scores were recorded for this period.
                      </div>
                    )}

                    {/* Criterion Notes */}
                    {reviewRatings.some((r) => r.comments) ? (
                      <div
                        className="pt-3 space-y-2"
                        style={{ borderTop: "1px solid rgba(184, 190, 255, 0.08)" }}
                      >
                        {reviewRatings
                          .filter((r) => r.comments)
                          .map((r) => (
                            <div key={r.id} className="text-xs space-y-0.5">
                              <span className="font-semibold text-white">
                                {formatCriterionLabel(r.criterion)}:{" "}
                              </span>
                              <span style={{ color: "var(--vx-text-secondary)" }}>{r.comments}</span>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
