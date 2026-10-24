import { MessageSquare, Star, TrendingUp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ScoreBars, type ScoreItem } from '@/components/charts/ScoreBars';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Notice } from '@/components/ui/Feedback';
import { ProgressRing } from '@/components/ui/Progress';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/hooks/use-data';
import { formatDateLabel } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import type { FeedbackRating, FeedbackReview } from '@/lib/types';

export function FeedbackScreen() {
  const feedbackQuery = useFeedback();
  const [refreshing, setRefreshing] = useState(false);
  const reviews = useMemo(() => feedbackQuery.data?.reviews ?? [], [feedbackQuery.data?.reviews]);
  const ratings = useMemo(() => feedbackQuery.data?.ratings ?? [], [feedbackQuery.data?.ratings]);

  const criteriaAverages = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const rating of ratings) {
      const current = map.get(rating.criterion) ?? { total: 0, count: 0 };
      current.total += rating.score;
      current.count += 1;
      map.set(rating.criterion, current);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, score: value.total / value.count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ratings]);

  const overallAverage = criteriaAverages.length
    ? criteriaAverages.reduce((sum, item) => sum + item.score, 0) / criteriaAverages.length
    : 0;
  const latestAverage = useMemo(() => {
    const latest = reviews[0];
    if (!latest) return null;
    const values = ratings.filter((rating) => rating.review_id === latest.id);
    if (!values.length) return null;
    return values.reduce((sum, rating) => sum + rating.score, 0) / values.length;
  }, [ratings, reviews]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await feedbackQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[colors.indigoSoft]}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          tintColor={colors.indigoSoft}
        />
      }>
      <ScreenHeader subtitle="Shared by your Admin or HR" title="My feedback" />

      <Notice
        message="Feedback is read-only in the app. Scores and comments are shared by your Admin or HR after each review period."
        title="Read-only review"
        tone="info"
      />

      {feedbackQuery.isError && !feedbackQuery.data ? (
        <Card padding={4} style={styles.spaced}>
          <ErrorState
            message={friendlyError(feedbackQuery.error)}
            onRetry={() => void feedbackQuery.refetch()}
          />
        </Card>
      ) : feedbackQuery.isLoading && !feedbackQuery.data ? (
        <View style={styles.spaced}>
          <ListSkeleton rows={4} />
        </View>
      ) : reviews.length === 0 ? (
        <Card padding={4} style={styles.spaced}>
          <EmptyState
            icon={<MessageSquare size={23} color={colors.indigoSoft} strokeWidth={1.7} />}
            message="Your Admin or HR has not shared any feedback yet. Scores and comments will appear here when they do."
            title="No feedback yet"
          />
        </Card>
      ) : (
        <>
          <Card style={styles.spaced} variant="raised">
            <View style={styles.summaryRow}>
              <ProgressRing progress={overallAverage / 5} size={98} stroke={9} sublabel="avg score" />
              <View style={styles.summaryCopy}>
                <Text variant="heading">Overall performance</Text>
                <Text variant="small" color={colors.textSecondary}>
                  Averaged across {criteriaAverages.length} criteria in {reviews.length} review
                  {reviews.length === 1 ? '' : 's'}.
                </Text>
                <View style={styles.summaryBadge}>
                  <Badge
                    dot
                    label={latestAverage == null ? 'No score yet' : `Latest ${latestAverage.toFixed(1)}/5`}
                    tone={latestAverage == null ? 'neutral' : latestAverage >= 4 ? 'success' : 'warning'}
                  />
                </View>
              </View>
            </View>
          </Card>

          <View style={styles.statGrid}>
            <StatTile
              hint="shared"
              icon={MessageSquare}
              label="Reviews"
              tone="indigo"
              value={reviews.length}
            />
            <StatTile
              hint="scored"
              icon={Star}
              label="Criteria"
              tone="success"
              value={criteriaAverages.length}
            />
            <StatTile
              hint="average"
              icon={TrendingUp}
              label="Rating"
              tone={overallAverage >= 4 ? 'success' : 'warning'}
              value={criteriaAverages.length ? overallAverage.toFixed(1) : '—'}
            />
          </View>

          {criteriaAverages.length ? (
            <Card style={styles.spaced}>
              <Text variant="subheading">Criteria averages</Text>
              <Text variant="small" color={colors.muted} style={styles.cardCaption}>
                Scores are shown out of 5.
              </Text>
              <ScoreBars items={criteriaAverages} />
            </Card>
          ) : null}

          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                ratings={ratings.filter((rating) => rating.review_id === review.id)}
                review={review}
              />
            ))}
          </View>
        </>
      )}

      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function ReviewCard({ review, ratings }: { review: FeedbackReview; ratings: FeedbackRating[] }) {
  const average = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
    : null;
  const items: ScoreItem[] = ratings
    .map((rating) => ({ label: rating.criterion, score: rating.score }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewPeriod}>
          <Text variant="small" color={colors.textSecondary} weight="medium">
            {formatDateLabel(review.period_start, 'dd MMM yyyy')} –{' '}
            {formatDateLabel(review.period_end, 'dd MMM yyyy')}
          </Text>
          <Text variant="caption" color={colors.muted}>
            Review period
          </Text>
        </View>
        {average == null ? (
          <Badge label={review.status} tone="neutral" />
        ) : (
          <ProgressRing
            progress={average / 5}
            size={68}
            stroke={7}
            label={average.toFixed(1)}
            sublabel="of 5"
          />
        )}
      </View>

      {review.comments ? (
        <View style={styles.comments}>
          <Text variant="caption" color={colors.muted}>
            Reviewer comments
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {review.comments}
          </Text>
        </View>
      ) : null}

      {items.length ? (
        <ScoreBars items={items} />
      ) : (
        <Text variant="small" color={colors.muted}>
          No individual criteria were shared for this review.
        </Text>
      )}

      {ratings.some((rating) => rating.comments) ? (
        <View style={styles.ratingNotes}>
          {ratings
            .filter((rating) => rating.comments)
            .map((rating) => (
              <View key={rating.id} style={styles.ratingNote}>
                <Text variant="small" color={colors.textSecondary} weight="medium">
                  {rating.criterion}
                </Text>
                <Text variant="small" color={colors.muted}>
                  {rating.comments}
                </Text>
              </View>
            ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  spaced: {
    marginTop: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  summaryCopy: {
    flex: 1,
    gap: 4,
  },
  summaryBadge: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cardCaption: {
    marginTop: 2,
    marginBottom: spacing.md,
  },
  reviewList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  reviewCard: {
    gap: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reviewPeriod: {
    flex: 1,
    gap: 2,
  },
  comments: {
    gap: 3,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  ratingNotes: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
  },
  ratingNote: {
    gap: 1,
  },
  bottomSpace: {
    height: spacing.xxl,
  },
});
