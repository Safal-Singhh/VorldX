import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  MessageSquare,
  QrCode,
  ScanLine,
  Umbrella,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Orb } from '@/components/orb/Orb';
import { DonutChart, DonutLegend } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, Notice } from '@/components/ui/Feedback';
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Reveal } from '@/components/ui/Reveal';
import { Screen } from '@/components/ui/Screen';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, tones, type Tone } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useLeaveRequests, useRecentAttendance, useWfhRequests } from '@/hooks/use-data';
import { useAuth } from '@/lib/auth';
import {
  greeting,
  leaveUsageForMonth,
  monthRecords,
  monthStats,
  recordTone,
  recordTypeLabel,
  todayApprovedLeave,
  todayApprovedWfh,
  todayLongDate,
  todayRecord,
  weekHoursSeries,
  weekHoursTotal,
} from '@/lib/attendance';
import {
  DEFAULT_TIMEZONE,
  durationLabel,
  formatTime,
  minutesBetween,
  timeLabelFromDb,
  todayInZone,
  workingDaysLabel,
} from '@/lib/dates';
import { firstName as first } from '@/lib/format';
import { useResponsive } from '@/lib/responsive';

export function DashboardScreen() {
  const router = useRouter();
  const { employee, company, shift, refresh: refreshProfile } = useAuth();
  const { isWide } = useResponsive();
  const reducedMotion = useReducedMotion();
  const attendanceQuery = useRecentAttendance(90);
  const leaveQuery = useLeaveRequests(100);
  const wfhQuery = useWfhRequests(40);
  const [refreshing, setRefreshing] = useState(false);

  const timezone = company?.timezone ?? DEFAULT_TIMEZONE;
  const records = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);
  const leaves = useMemo(() => leaveQuery.data ?? [], [leaveQuery.data]);
  const wfhRequests = useMemo(() => wfhQuery.data ?? [], [wfhQuery.data]);
  const today = todayInZone(timezone);
  const monthKey = today.slice(0, 7);
  const todayAttendance = todayRecord(records, timezone);
  const todayLeave = todayApprovedLeave(leaves, timezone);
  const todayWfh = todayApprovedWfh(wfhRequests, timezone);
  const thisMonth = useMemo(() => monthRecords(records, monthKey), [records, monthKey]);
  const thisMonthLeaves = useMemo(
    () => leaves.filter((leave) => leave.leave_date.startsWith(monthKey)),
    [leaves, monthKey],
  );
  const stats = useMemo(() => monthStats(thisMonth, thisMonthLeaves), [thisMonth, thisMonthLeaves]);
  const leaveUsed = leaveUsageForMonth(leaves, monthKey);
  const weeklySeries = useMemo(() => weekHoursSeries(records, timezone), [records, timezone]);
  const weeklyTotal = weekHoursTotal(weeklySeries);

  const pending = useMemo(() => {
    const rows: {
      id: string;
      type: 'wfh' | 'leave';
      date: string;
      label: string;
    }[] = [];
    for (const request of wfhRequests) {
      if (request.status === 'pending') {
        rows.push({
          id: request.id,
          type: 'wfh',
          date: request.request_date,
          label: 'Work-from-home request',
        });
      }
    }
    for (const request of leaves) {
      if (request.status === 'pending') {
        rows.push({
          id: request.id,
          type: 'leave',
          date: request.leave_date,
          label: 'Leave request',
        });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [leaves, wfhRequests]);

  const recent = records.slice(0, 4);
  const attendanceError = attendanceQuery.isError && !attendanceQuery.data;
  const isLoading = attendanceQuery.isLoading || leaveQuery.isLoading || wfhQuery.isLoading;
  const softError =
    (attendanceQuery.isError && attendanceQuery.data) ||
    (leaveQuery.isError && leaveQuery.data) ||
    (wfhQuery.isError && wfhQuery.data);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        attendanceQuery.refetch(),
        leaveQuery.refetch(),
        wfhQuery.refetch(),
        refreshProfile(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <PageHeader
          eyebrow={company?.name ?? 'VorldX'}
          title={`${greeting(timezone)}, ${first(employee?.full_name ?? 'there')}`}
          subtitle={todayLongDate(timezone)}
        />
        <DashboardSkeleton />
      </Screen>
    );
  }

  if (attendanceError) {
    return (
      <Screen>
        <PageHeader
          eyebrow={company?.name ?? 'VorldX'}
          title="Your dashboard"
          subtitle="Attendance, leave and WFH at a glance."
        />
        <ErrorState
          message="We could not load your attendance. Check your connection and try again."
          onRetry={() => void attendanceQuery.refetch()}
        />
      </Screen>
    );
  }

  const hero = heroCopy({
    attendance: todayAttendance,
    leave: todayLeave,
    wfh: todayWfh,
    timezone,
  });

  const scanAction = () => router.navigate('/scan');
  const wfhAction = () => router.navigate('/wfh');
  const attendanceAction = () => router.push('/attendance');

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[colors.indigoSoft]}
          onRefresh={() => void onRefresh()}
          refreshing={refreshing}
          tintColor={colors.indigoSoft}
        />
      }>
      <PageHeader
        eyebrow={company?.name ?? 'VorldX'}
        title={`${greeting(timezone)}, ${first(employee?.full_name ?? 'there')}`}
        subtitle={todayLongDate(timezone)}
        right={
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            haptic="selection"
            onPress={() => router.navigate('/profile')}>
            <Avatar name={employee?.full_name ?? 'VX'} showRing size={44} />
          </PressableScale>
        }
      />

      {softError ? (
        <Notice
          message="Some information could not be refreshed. Showing the last data saved on this device."
          tone="warning"
          title="Offline data"
        />
      ) : null}

      <Reveal>
        <Card style={styles.heroCard} variant="raised" padding={20}>
          <View pointerEvents="none" style={styles.heroOrb}>
            <Orb animated={!reducedMotion} intensity="soft" size={isWide ? 210 : 168} />
          </View>
          <View style={styles.heroCopy}>
            <Text variant="caption" color={colors.muted}>
              {todayAttendance ? 'Today' : 'Today · Not checked in'}
            </Text>
            <Text variant="title" style={styles.heroTitle}>
              {hero.title}
            </Text>
            <Text variant="small" color={colors.textSecondary} style={styles.heroSubtitle}>
              {hero.subtitle}
            </Text>
            <View style={styles.heroBadgeRow}>
              <Badge label={hero.badge} tone={hero.tone} dot />
              {hero.secondaryBadge ? (
                <Badge label={hero.secondaryBadge} tone="neutral" />
              ) : null}
            </View>
          </View>

          {todayAttendance && todayAttendance.status !== 'absent' ? (
            <View style={styles.timeStrip}>
              <TimeCell label="Check in" value={formatTime(todayAttendance.check_in_at, timezone)} />
              <View style={styles.timeDivider} />
              <TimeCell label="Check out" value={formatTime(todayAttendance.check_out_at, timezone)} />
              <View style={styles.timeDivider} />
              <TimeCell
                label="Duration"
                value={
                  todayAttendance.check_out_at && todayAttendance.check_in_at
                    ? durationLabel(
                        minutesBetween(todayAttendance.check_in_at, todayAttendance.check_out_at),
                      )
                    : todayAttendance.check_in_at
                      ? durationLabel(
                          minutesBetween(todayAttendance.check_in_at, new Date().toISOString()),
                        )
                      : '—'
                }
              />
            </View>
          ) : todayAttendance?.status === 'absent' ? (
            <View style={styles.shiftStrip}>
              <View style={styles.shiftIcon}>
                <AlertCircle size={16} color={colors.danger} strokeWidth={1.9} />
              </View>
              <View style={styles.shiftCopy}>
                <Text variant="small" color={colors.textSecondary}>
                  No check-in before shift end
                </Text>
                <Text variant="monoSmall" color={colors.text}>
                  {shift
                    ? `Shift ended ${timeLabelFromDb(shift.end_time)}`
                    : 'Contact HR or Admin'}
                </Text>
              </View>
              <Text variant="caption" color={colors.danger}>
                Absent
              </Text>
            </View>
          ) : (
            <View style={styles.shiftStrip}>
              <View style={styles.shiftIcon}>
                <Clock3 size={16} color={colors.indigoSoft} strokeWidth={1.9} />
              </View>
              <View style={styles.shiftCopy}>
                <Text variant="small" color={colors.textSecondary}>
                  {shift?.name ?? 'Default shift'}
                </Text>
                <Text variant="monoSmall" color={colors.text}>
                  {shift
                    ? `${timeLabelFromDb(shift.start_time)} – ${timeLabelFromDb(shift.end_time)}`
                    : 'Shift not assigned'}
                </Text>
              </View>
              <Text variant="caption" color={colors.muted}>
                {shift ? workingDaysLabel(shift.working_days) : '—'}
              </Text>
            </View>
          )}

          <View style={styles.heroActions}>
            {hero.action === 'scan' ? (
              <>
                <Button
                  icon={<QrCode size={17} color={colors.white} strokeWidth={2} />}
                  label="Scan office QR"
                  onPress={scanAction}
                  size="sm"
                  style={styles.heroButton}
                />
                <Button
                  icon={<Home size={16} color={colors.text} strokeWidth={1.9} />}
                  label="Work from home"
                  onPress={wfhAction}
                  size="sm"
                  style={styles.heroButton}
                  variant="secondary"
                />
              </>
            ) : hero.action === 'wfh' ? (
              <>
                <Button
                  icon={<Home size={17} color={colors.white} strokeWidth={2} />}
                  label="Open WFH"
                  onPress={wfhAction}
                  size="sm"
                  style={styles.heroButton}
                />
                <Button
                  label="My requests"
                  onPress={() => router.navigate('/requests')}
                  size="sm"
                  style={styles.heroButton}
                  variant="secondary"
                />
              </>
            ) : (
              <>
                <Button
                  icon={<CalendarDays size={16} color={colors.white} strokeWidth={2} />}
                  label="View attendance"
                  onPress={attendanceAction}
                  size="sm"
                  style={styles.heroButton}
                />
                <Button
                  label="My requests"
                  onPress={() => router.navigate('/requests')}
                  size="sm"
                  style={styles.heroButton}
                  variant="secondary"
                />
              </>
            )}
          </View>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Feedback, view manager ratings and reviews"
          haptic="selection"
          onPress={() => router.push('/feedback')}
          style={styles.feedbackBanner}>
          <View style={styles.feedbackBannerLeft}>
            <View style={styles.feedbackBannerIcon}>
              <MessageSquare size={17} color={colors.success} strokeWidth={2} />
            </View>
            <View style={styles.feedbackBannerCopy}>
              <View style={styles.feedbackBannerTitleRow}>
                <Text variant="subheading" weight="semibold">
                  Feedback
                </Text>
                <Badge label="Read-only" tone="success" size="sm" />
              </View>
              <Text variant="small" color={colors.muted}>
                View manager ratings and performance reviews
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.muted} strokeWidth={1.8} />
        </PressableScale>
      </Reveal>

      <Reveal delay={100}>
        <View style={styles.statGrid}>
          <StatTile
            hint="this month"
            icon={CheckCircle2}
            label="Present"
            tone="success"
            value={stats.present}
          />
          <StatTile hint="this month" icon={Clock3} label="Late" tone="warning" value={stats.late} />
          <StatTile hint="this month" icon={AlertCircle} label="Absent" tone="danger" value={stats.absent} />
          <StatTile hint="this month" icon={Home} label="WFH" tone="info" value={stats.wfh} />
          <StatTile
            hint={`${leaveUsed} of 3 leave`}
            icon={Umbrella}
            label="Leave"
            tone="leave"
            value={stats.approvedLeave}
          />
        </View>
      </Reveal>

      <Reveal delay={140}>
        <Card padding={14} style={styles.shiftCard} variant="soft">
          <View style={styles.shiftCardIcon}>
            <Clock3 size={17} color={colors.indigoSoft} strokeWidth={1.8} />
          </View>
          <View style={styles.shiftCardCopy}>
            <Text variant="small" color={colors.textSecondary} weight="medium">
              {shift?.name ?? 'Shift'}
            </Text>
            <Text variant="small" color={colors.muted}>
              {shift
                ? `${timeLabelFromDb(shift.start_time)} – ${timeLabelFromDb(shift.end_time)} · ${workingDaysLabel(shift.working_days)}`
                : 'No shift assigned yet'}
            </Text>
          </View>
          {shift ? (
            <Badge label={`${shift.grace_period_minutes}m grace`} tone="neutral" />
          ) : null}
        </Card>
      </Reveal>

      <Reveal delay={180}>
        <View style={[styles.chartGrid, isWide && styles.chartGridWide]}>
          <Card style={styles.chartCard}>
            <View style={styles.cardTitleRow}>
              <View>
                <Text variant="subheading">Hours this week</Text>
                <Text variant="small" color={colors.muted}>
                  Last 7 days
                </Text>
              </View>
              <Text variant="numberSmall" color={colors.indigoSoft}>
                {weeklyTotal}h
              </Text>
            </View>
            <LineChart data={weeklySeries} height={150} />
          </Card>

          <Card style={styles.chartCard}>
            <View style={styles.cardTitleRow}>
              <View>
                <Text variant="subheading">Month mix</Text>
                <Text variant="small" color={colors.muted}>
                  {stats.total + stats.approvedLeave} recorded days
                </Text>
              </View>
            </View>
            {stats.total + stats.approvedLeave > 0 ? (
              <View style={styles.donutRow}>
                <DonutChart
                  centerLabel="days"
                  centerValue={String(stats.total + stats.approvedLeave)}
                  segments={[
                    { label: 'Office', value: stats.present, color: colors.success },
                    { label: 'Late', value: stats.late, color: colors.warning },
                    { label: 'WFH', value: stats.wfh, color: colors.info },
                    { label: 'Leave', value: stats.approvedLeave, color: colors.leave },
                    { label: 'Absent', value: stats.absent, color: colors.danger },
                  ]}
                  size={124}
                />
                <DonutLegend
                  segments={[
                    { label: 'Office', value: stats.present, color: colors.success },
                    { label: 'Late', value: stats.late, color: colors.warning },
                    { label: 'WFH', value: stats.wfh, color: colors.info },
                    { label: 'Leave', value: stats.approvedLeave, color: colors.leave },
                    { label: 'Absent', value: stats.absent, color: colors.danger },
                  ]}
                />
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <CalendarDays size={22} color={colors.muted} strokeWidth={1.6} />
                <Text variant="small" color={colors.muted} align="center">
                  Your month starts with your first scan.
                </Text>
              </View>
            )}
          </Card>
        </View>
      </Reveal>

      {pending.length > 0 ? (
        <Reveal delay={220}>
          <SectionHeader
            actionLabel="View all"
            caption={`${pending.length} awaiting review`}
            onAction={() => router.navigate('/requests')}
            title="Pending requests"
          />
          <Card padding={0}>
            {pending.slice(0, 3).map((request, index) => (
              <PressableScale
                key={`${request.type}-${request.id}`}
                accessibilityRole="button"
                haptic="selection"
                onPress={() => router.navigate('/requests')}
                style={[styles.pendingRow, index > 0 ? styles.rowDivider : null]}>
                <View
                  style={[
                    styles.pendingIcon,
                    {
                      backgroundColor:
                        request.type === 'wfh' ? tones.info.bg : tones.leave.bg,
                    },
                  ]}>
                  {request.type === 'wfh' ? (
                    <Home size={15} color={colors.info} strokeWidth={1.9} />
                  ) : (
                    <Umbrella size={15} color={colors.leave} strokeWidth={1.9} />
                  )}
                </View>
                <View style={styles.pendingCopy}>
                  <Text variant="small" color={colors.text} weight="medium">
                    {request.label}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    {request.date}
                  </Text>
                </View>
                <Badge label="Pending" tone="warning" dot />
                <ChevronRight size={15} color={colors.muted} strokeWidth={1.9} />
              </PressableScale>
            ))}
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={260}>
        <SectionHeader
          actionLabel="View all"
          caption="Latest 4 records"
          onAction={attendanceAction}
          title="Recent attendance"
        />
        <Card padding={0}>
          {recent.length ? (
            recent.map((record, index) => (
              <PressableScale
                key={record.id}
                accessibilityRole="button"
                haptic="selection"
                onPress={attendanceAction}
                style={[styles.recentRow, index > 0 ? styles.rowDivider : null]}>
                <View
                  style={[
                    styles.recentIcon,
                    { backgroundColor: tones[recordTone(record)].bg },
                  ]}>
                  {record.status === 'absent' ? (
                    <AlertCircle size={15} color={colors.danger} strokeWidth={1.9} />
                  ) : record.attendance_type === 'wfh' ? (
                    <Home size={15} color={colors.info} strokeWidth={1.9} />
                  ) : (
                    <MapPin size={15} color={colors.success} strokeWidth={1.9} />
                  )}
                </View>
                <View style={styles.recentCopy}>
                  <Text variant="small" color={colors.text} weight="medium">
                    {formatDate(record.work_date)}
                  </Text>
                  <Text variant="small" color={colors.muted} numberOfLines={1}>
                    {record.status === 'absent'
                      ? 'No check-in before shift end'
                      : `${recordTypeLabel(record)} · ${formatTime(record.check_in_at, timezone)} – ${formatTime(record.check_out_at, timezone)}`}
                  </Text>
                </View>
                <StatusBadge status={record.status} />
              </PressableScale>
            ))
          ) : (
            <View style={styles.recentEmpty}>
              <ScanLine size={22} color={colors.muted} strokeWidth={1.6} />
              <Text variant="small" color={colors.muted} align="center">
                No attendance records yet. Scan the office QR to start.
              </Text>
            </View>
          )}
        </Card>
      </Reveal>

      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function heroCopy({
  attendance,
  leave,
  wfh,
  timezone,
}: {
  attendance: ReturnType<typeof todayRecord>;
  leave: ReturnType<typeof todayApprovedLeave>;
  wfh: ReturnType<typeof todayApprovedWfh>;
  timezone: string;
}): {
  title: string;
  subtitle: string;
  badge: string;
  tone: Tone;
  secondaryBadge?: string;
  action: 'scan' | 'wfh' | 'view';
} {
  if (attendance) {
    if (attendance.status === 'absent') {
      return {
        title: 'Marked absent',
        subtitle:
          'No check-in was recorded before your shift ended. Ask HR or Admin to correct it if you were present.',
        badge: 'Absent',
        tone: 'danger',
        action: 'view',
      };
    }
    const checkIn = attendance.check_in_at ?? new Date().toISOString();
    const type = attendance.attendance_type === 'wfh' ? 'Working from home' : 'In the office';
    if (attendance.check_out_at) {
      return {
        title: 'Day complete',
        subtitle: `${type} · ${durationLabel(
          minutesBetween(checkIn, attendance.check_out_at),
        )} recorded today.`,
        badge: attendance.attendance_type === 'wfh' ? 'WFH' : 'Office',
        tone: recordTone(attendance),
        action: 'view',
      };
    }
    return {
      title: "You're checked in",
      subtitle: `${type} at ${formatTime(checkIn, timezone)}. ${
        attendance.attendance_type === 'wfh'
          ? 'Use your passcode again to check out.'
          : 'Scan the office QR again when you leave.'
      }`,
      badge: attendance.attendance_type === 'wfh' ? 'WFH' : 'Office',
      tone: recordTone(attendance),
      secondaryBadge: attendance.status === 'late' ? 'Late' : 'On time',
      action: attendance.attendance_type === 'wfh' ? 'wfh' : 'scan',
    };
  }

  if (leave) {
    return {
      title: 'On leave today',
      subtitle: 'Your leave is approved. No check-in is needed today.',
      badge: 'On leave',
      tone: 'leave',
      action: 'view',
    };
  }

  if (wfh) {
    return {
      title: 'Working from home',
      subtitle: 'Your WFH request is approved. Use the passcode to check in and out.',
      badge: 'WFH approved',
      tone: 'info',
      action: 'wfh',
    };
  }

  return {
    title: 'Not checked in yet',
    subtitle: 'Scan the office QR when you arrive, or check in from home with a passcode.',
    badge: 'Not started',
    tone: 'neutral',
    action: 'scan',
  };
}

function TimeCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeCell}>
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
      <Text variant="monoSmall" color={colors.text} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}


function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    right: -38,
    top: -46,
    opacity: 0.9,
  },
  heroCopy: {
    maxWidth: '88%',
    gap: 4,
  },
  heroTitle: {
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    maxWidth: 430,
    marginTop: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  timeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(184, 190, 255, 0.1)',
  },
  timeCell: {
    flex: 1,
    gap: 3,
  },
  timeDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(184, 190, 255, 0.1)',
    marginHorizontal: spacing.sm,
  },
  shiftStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(184, 190, 255, 0.1)',
  },
  shiftIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
  },
  shiftCopy: {
    flex: 1,
    gap: 1,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroButton: {
    flex: 1,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(18, 21, 36, 0.66)',
    marginTop: spacing.lg,
  },
  feedbackBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  feedbackBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(69, 214, 166, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(69, 214, 166, 0.25)',
  },
  feedbackBannerCopy: {
    flex: 1,
    gap: 2,
  },
  feedbackBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  shiftCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
  },
  shiftCardCopy: {
    flex: 1,
    gap: 1,
  },
  chartGrid: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  chartGridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chartCard: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  emptyChart: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  pendingIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCopy: {
    flex: 1,
    gap: 1,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCopy: {
    flex: 1,
    gap: 1,
  },
  recentEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  bottomSpace: {
    height: spacing.xl,
  },
});
