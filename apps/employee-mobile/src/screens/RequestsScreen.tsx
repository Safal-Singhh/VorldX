import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Home,
  KeyRound,
  Umbrella,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { EmptyState, ErrorState, Notice } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Input';
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radii, spacing, tones, type Tone } from '@/constants/theme';
import { useLeaveRequests, useWfhPasscodes, useWfhRequests } from '@/hooks/use-data';
import { submitLeaveRequest, submitWfhRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_TIMEZONE,
  deadlineLabel,
  formatDateLabel,
  formatTime,
  minutesLabel,
  requestDeadline,
  todayInZone,
  tomorrowInZone,
  yesterdayInZone,
} from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { leaveUsageForMonth } from '@/lib/attendance';
import { useResponsive } from '@/lib/responsive';
import type { LeaveRequest, WfhPasscode, WfhRequest } from '@/lib/types';

type TabValue = 'wfh' | 'leave';
type Feedback = { tone: Tone; title: string; message: string; tab: TabValue };

export function RequestsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const queryClient = useQueryClient();
  const { company, shift, policy } = useAuth();
  const { isWide } = useResponsive();
  const timezone = company?.timezone ?? DEFAULT_TIMEZONE;
  const today = todayInZone(timezone);
  const tab: TabValue = params.tab === 'leave' ? 'leave' : 'wfh';
  const [wfhDate, setWfhDate] = useState(() => tomorrowInZone(timezone));
  const [leaveDate, setLeaveDate] = useState(() => tomorrowInZone(timezone));
  const [wfhReason, setWfhReason] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [busy, setBusy] = useState<'wfh' | 'leave' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const wfhQuery = useWfhRequests(40);
  const leaveQuery = useLeaveRequests(100);
  const wfhRequests = wfhQuery.data ?? [];
  const leaveRequests = leaveQuery.data ?? [];
  const passcodesQuery = useWfhPasscodes(wfhRequests);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const selectTab = (next: TabValue) => {
    setFeedback(null);
    router.setParams({ tab: next });
  };

  const notify = (next: { tone: Tone; title: string; message: string }) => {
    setFeedback({ ...next, tab });
  };

  const wfhPending = wfhRequests.filter((request) => request.status === 'pending').length;
  const leavePending = leaveRequests.filter((request) => request.status === 'pending').length;

  const selectedMonthKey = leaveDate.slice(0, 7);
  const leaveUsed = leaveUsageForMonth(leaveRequests, selectedMonthKey);
  const leaveRemaining = Math.max(0, 3 - leaveUsed);

  const wfhDeadline = useMemo(() => {
    if (!shift || !policy) return null;
    return requestDeadline(
      wfhDate,
      shift.start_time,
      policy.request_cutoff_minutes,
      timezone,
    );
  }, [policy, shift, timezone, wfhDate]);
  const wfhCutoffPassed = Boolean(wfhDeadline && nowMs > 0 && wfhDeadline.getTime() < nowMs);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([wfhQuery.refetch(), leaveQuery.refetch(), passcodesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const submitWfh = async () => {
    setFeedback(null);
    if (!wfhDate) {
      notify({ tone: 'danger', title: 'Choose a date', message: 'Select the day you plan to work from home.' });
      return;
    }
    if (wfhReason.trim().length < 5) {
      notify({
        tone: 'danger',
        title: 'Add a reason',
        message: 'Write at least 5 characters so your Admin can review the request.',
      });
      return;
    }
    if (wfhDeadline && wfhDeadline.getTime() < Date.now()) {
      notify({
        tone: 'danger',
        title: 'Cutoff passed',
        message: 'Requests close before the shift starts. Choose a later date.',
      });
      return;
    }

    setBusy('wfh');
    try {
      await submitWfhRequest(wfhDate, wfhReason.trim());
      setWfhReason('');
      notify({
        tone: 'success',
        title: 'WFH request submitted',
        message: 'Your Admin will review it. The passcode appears here after approval.',
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wfh-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['wfh-passcodes'] }),
      ]);
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Could not submit request',
        message: friendlyError(error),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
    } finally {
      setBusy(null);
    }
  };

  const submitLeave = async () => {
    setFeedback(null);
    if (!leaveDate) {
      notify({ tone: 'danger', title: 'Choose a date', message: 'Select the day you need leave.' });
      return;
    }
    if (leaveReason.trim().length < 5) {
      notify({
        tone: 'danger',
        title: 'Add a reason',
        message: 'Write at least 5 characters so your Admin can review the request.',
      });
      return;
    }
    if (leaveRemaining <= 0) {
      notify({
        tone: 'danger',
        title: 'Monthly limit reached',
        message: 'You already have 3 pending or approved leave requests for that month.',
      });
      return;
    }

    setBusy('leave');
    try {
      await submitLeaveRequest(leaveDate, leaveReason.trim());
      setLeaveReason('');
      notify({
        tone: 'success',
        title: 'Leave request submitted',
        message: 'Your Admin will review it. You can track the decision below.',
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Could not submit leave',
        message: friendlyError(error),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
    } finally {
      setBusy(null);
    }
  };

  const loading = wfhQuery.isLoading || leaveQuery.isLoading;

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
      <PageHeader
        eyebrow="Employee self-service"
        title="Requests"
        subtitle="Plan work from home, request leave, and follow every decision."
        right={
          <Badge
            dot
            label={`${wfhPending + leavePending} pending`}
            tone={wfhPending + leavePending > 0 ? 'warning' : 'neutral'}
          />
        }
      />

      <SegmentedControl
        onChange={(next) => selectTab(next)}
        options={[
          { label: 'WFH', value: 'wfh', count: wfhPending },
          { label: 'Leave', value: 'leave', count: leavePending },
        ]}
        value={tab}
      />

      {feedback && feedback.tab === tab ? (
        <View style={styles.feedback}>
          <Notice
            icon={
              feedback.tone === 'success' ? (
                <CheckCircle2 size={17} color={colors.success} strokeWidth={2} />
              ) : (
                <AlertCircle size={17} color={colors.danger} strokeWidth={2} />
              )
            }
            message={feedback.message}
            title={feedback.title}
            tone={feedback.tone}
          />
        </View>
      ) : null}

      <View style={[styles.columns, isWide && styles.columnsWide]}>
        <View style={[styles.formColumn, isWide && styles.formColumnWide]}>
          {tab === 'wfh' ? (
            <Card padding={18} style={styles.formCard}>
              <View style={styles.formHeader}>
                <View style={styles.formIcon}>
                  <Home size={18} color={colors.info} strokeWidth={1.9} />
                </View>
                <View style={styles.formHeaderCopy}>
                  <Text variant="subheading">Request work from home</Text>
                  <Text variant="small" color={colors.muted}>
                    One date per request.
                  </Text>
                </View>
              </View>

              {policy && !policy.wfh_enabled ? (
                <Notice
                  message="Your company has paused WFH requests. You can still view past requests."
                  title="WFH is disabled"
                  tone="warning"
                />
              ) : null}

              <DateField
                label="Request date"
                minDate={today}
                onChange={(value) => {
                  setWfhDate(value);
                  setFeedback(null);
                }}
                required
                value={wfhDate}
              />

              <View style={styles.cutoffRow}>
                <Clock3 size={14} color={wfhCutoffPassed ? colors.danger : colors.muted} strokeWidth={1.9} />
                <Text
                  variant="small"
                  color={wfhCutoffPassed ? colors.danger : colors.muted}
                  style={styles.cutoffText}>
                  {wfhCutoffPassed
                    ? 'The request cutoff for this date has passed. Pick another day.'
                    : wfhDeadline
                      ? `Requests for ${formatDateLabel(wfhDate, 'dd MMM')} close at ${deadlineLabel(
                          wfhDeadline,
                          timezone,
                          wfhDate,
                        )}.`
                      : `Requests close ${minutesLabel(policy?.request_cutoff_minutes ?? 120)} before shift start.`}
                </Text>
              </View>

              <Field hint={`${wfhReason.trim().length}/500`} label="Reason" required>
                <Input
                  editable={!busy && (!policy || policy.wfh_enabled)}
                  maxLength={500}
                  multiline
                  onChangeText={setWfhReason}
                  placeholder="What will you be working on?"
                  value={wfhReason}
                />
              </Field>

              <Button
                disabled={Boolean(policy && !policy.wfh_enabled) || wfhCutoffPassed}
                label="Submit WFH request"
                loading={busy === 'wfh'}
                onPress={() => void submitWfh()}
                icon={<ArrowRight size={16} color={colors.white} strokeWidth={2} />}
              />
            </Card>
          ) : (
            <Card padding={18} style={styles.formCard}>
              <View style={styles.formHeader}>
                <View style={[styles.formIcon, { backgroundColor: tones.leave.bg }]}>
                  <Umbrella size={18} color={colors.leave} strokeWidth={1.9} />
                </View>
                <View style={styles.formHeaderCopy}>
                  <Text variant="subheading">Request leave</Text>
                  <Text variant="small" color={colors.muted}>
                    Up to 3 requests per month.
                  </Text>
                </View>
              </View>

              <DateField
                label="Leave date"
                minDate={yesterdayInZone(timezone)}
                onChange={(value) => {
                  setLeaveDate(value);
                  setFeedback(null);
                }}
                required
                value={leaveDate}
              />

              <View style={styles.leaveMeter}>
                <View style={styles.leaveMeterHeader}>
                  <Text variant="small" color={colors.textSecondary} weight="medium">
                    {formatDateLabel(`${selectedMonthKey}-01`, 'MMMM yyyy')} usage
                  </Text>
                  <Text variant="small" color={leaveRemaining > 0 ? colors.leave : colors.danger}>
                    {leaveRemaining} of 3 left
                  </Text>
                </View>
                <View style={styles.meterRow}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.meterCell,
                        { backgroundColor: index < leaveUsed ? colors.leave : 'rgba(145,148,186,0.12)' },
                      ]}
                    />
                  ))}
                </View>
                <Text variant="small" color={colors.muted}>
                  Pending and approved requests count toward the monthly limit.
                </Text>
              </View>

              <Field hint={`${leaveReason.trim().length}/500`} label="Reason" required>
                <Input
                  editable={!busy}
                  maxLength={500}
                  multiline
                  onChangeText={setLeaveReason}
                  placeholder="Why do you need this day off?"
                  value={leaveReason}
                />
              </Field>

              <Button
                disabled={leaveRemaining <= 0}
                label={leaveRemaining <= 0 ? 'Monthly limit reached' : 'Submit leave request'}
                loading={busy === 'leave'}
                onPress={() => void submitLeave()}
                icon={<ArrowRight size={16} color={colors.white} strokeWidth={2} />}
              />
            </Card>
          )}
        </View>

        <View style={styles.listColumn}>
          {tab === 'wfh' ? (
            <>
              <SectionHeader
                caption={`${wfhRequests.length} request${wfhRequests.length === 1 ? '' : 's'}`}
                title="My WFH requests"
              />
              {wfhQuery.isError && !wfhRequests.length ? (
                <Card padding={4}>
                  <ErrorState
                    message={friendlyError(wfhQuery.error)}
                    onRetry={() => void wfhQuery.refetch()}
                  />
                </Card>
              ) : loading ? (
                <ListSkeleton />
              ) : wfhRequests.length ? (
                <View style={styles.requestList}>
                  {wfhRequests.map((request) => (
                    <WfhCard
                      key={request.id}
                      onOpen={() => router.navigate('/wfh')}
                      passcode={passcodesQuery.data?.[request.id] ?? null}
                      request={request}
                      timezone={timezone}
                      today={today}
                    />
                  ))}
                </View>
              ) : (
                <Card padding={4}>
                  <EmptyState
                    icon={<Home size={22} color={colors.indigoSoft} strokeWidth={1.7} />}
                    message="Submit your first request with the form. Approved passcodes will appear here."
                    title="No WFH requests yet"
                  />
                </Card>
              )}
            </>
          ) : (
            <>
              <SectionHeader
                caption={`${leaveRequests.length} request${leaveRequests.length === 1 ? '' : 's'}`}
                title="My leave requests"
              />
              {leaveQuery.isError && !leaveRequests.length ? (
                <Card padding={4}>
                  <ErrorState
                    message={friendlyError(leaveQuery.error)}
                    onRetry={() => void leaveQuery.refetch()}
                  />
                </Card>
              ) : loading ? (
                <ListSkeleton />
              ) : leaveRequests.length ? (
                <View style={styles.requestList}>
                  {leaveRequests.map((request) => (
                    <LeaveCard key={request.id} request={request} />
                  ))}
                </View>
              ) : (
                <Card padding={4}>
                  <EmptyState
                    icon={<Umbrella size={22} color={colors.leave} strokeWidth={1.7} />}
                    message="Use the form to request a leave date. Pending and approved requests count toward the 3-per-month limit."
                    title="No leave requests yet"
                  />
                </Card>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.footerNote}>
        <Clock3 size={13} color={colors.muted} strokeWidth={1.9} />
        <Text variant="small" color={colors.muted}>
          Decisions are made by your HR. Pull down to refresh.
        </Text>
      </View>
    </Screen>
  );
}

function WfhCard({
  request,
  passcode,
  timezone,
  today,
  onOpen,
}: {
  request: WfhRequest;
  passcode: WfhPasscode | null;
  timezone: string;
  today: string;
  onOpen: () => void;
}) {
  return (
    <Card padding={0} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <DateBadge date={request.request_date} />
        <View style={styles.requestCopy}>
          <Text variant="bodyMedium" numberOfLines={1}>
            Work from home
          </Text>
          <Text variant="small" color={colors.muted}>
            {formatDateLabel(request.request_date, 'EEEE, dd MMMM')}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>
      <View style={styles.requestBody}>
        <Text variant="small" color={colors.textSecondary}>
          {request.reason}
        </Text>
        {request.review_notes ? (
          <View style={styles.reviewNote}>
            <Text variant="caption" color={colors.muted}>
              Admin note
            </Text>
            <Text variant="small" color={colors.textSecondary}>
              {request.review_notes}
            </Text>
          </View>
        ) : null}
        {request.status === 'approved' ? (
          <View style={styles.codeStrip}>
            <KeyRound size={15} color={colors.indigoSoft} strokeWidth={1.9} />
            {passcode?.passcode ? (
              <>
                <Text variant="mono" color={colors.text}>
                  {passcode.passcode.slice(0, 3)} {passcode.passcode.slice(3)}
                </Text>
                <Text variant="small" color={colors.muted} style={styles.codeMeta}>
                  {passcode.used_up
                    ? 'Used'
                    : passcode.expired
                      ? 'Expired'
                      : `${passcode.uses_left} left`}
                </Text>
              </>
            ) : (
              <Text variant="small" color={colors.muted} style={styles.codeMeta}>
                Passcode not issued yet
              </Text>
            )}
            {request.request_date === today && !passcode?.used_up ? (
              <Button
                label="Open"
                onPress={onOpen}
                size="sm"
                variant="soft"
                fullWidth={false}
                style={styles.openButton}
              />
            ) : null}
          </View>
        ) : null}
        {request.reviewed_at ? (
          <Text variant="small" color={colors.muted}>
            Reviewed {formatDateLabel(request.reviewed_at.slice(0, 10), 'dd MMM')} at{' '}
            {formatTime(request.reviewed_at, timezone)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function LeaveCard({ request }: { request: LeaveRequest }) {
  return (
    <Card padding={0} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <DateBadge date={request.leave_date} tone="leave" />
        <View style={styles.requestCopy}>
          <Text variant="bodyMedium" numberOfLines={1}>
            Leave
          </Text>
          <Text variant="small" color={colors.muted}>
            {formatDateLabel(request.leave_date, 'EEEE, dd MMMM')}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>
      <View style={styles.requestBody}>
        <Text variant="small" color={colors.textSecondary}>
          {request.reason}
        </Text>
        {request.review_notes ? (
          <View style={styles.reviewNote}>
            <Text variant="caption" color={colors.muted}>
              Admin note
            </Text>
            <Text variant="small" color={colors.textSecondary}>
              {request.review_notes}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function DateBadge({ date, tone = 'info' }: { date: string; tone?: Tone }) {
  return (
    <View style={[styles.dateBadge, { backgroundColor: tones[tone].bg }]}>
      <Text variant="caption" color={colors.muted} style={styles.dateWeekday}>
        {formatDateLabel(date, 'EEE')}
      </Text>
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 20,
          lineHeight: 23,
          color: tones[tone].fg,
        }}>
        {formatDateLabel(date, 'dd')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: {
    marginTop: spacing.md,
  },
  columns: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  columnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formColumn: {
    width: '100%',
  },
  formColumnWide: {
    width: 350,
  },
  formCard: {
    gap: spacing.md,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  formIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tones.info.bg,
  },
  formHeaderCopy: {
    flex: 1,
    gap: 1,
  },
  cutoffRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: -2,
  },
  cutoffText: {
    flex: 1,
  },
  leaveMeter: {
    gap: 7,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(196, 167, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(196, 167, 255, 0.16)',
    marginBottom: spacing.xs,
  },
  leaveMeterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meterRow: {
    flexDirection: 'row',
    gap: 5,
  },
  meterCell: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  listColumn: {
    flex: 1,
    minWidth: 0,
  },
  requestList: {
    gap: spacing.sm,
  },
  requestCard: {
    overflow: 'hidden',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  dateBadge: {
    width: 45,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  dateWeekday: {
    fontSize: 8,
    letterSpacing: 0.6,
    marginTop: -2,
  },
  requestCopy: {
    flex: 1,
    gap: 1,
  },
  requestBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reviewNote: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    gap: 2,
  },
  codeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(89, 101, 242, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.16)',
  },
  codeMeta: {
    flex: 1,
  },
  openButton: {
    minWidth: 0,
    height: 30,
    paddingHorizontal: 10,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
});
