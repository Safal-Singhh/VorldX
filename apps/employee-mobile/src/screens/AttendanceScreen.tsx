import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  RefreshCw,
  Umbrella,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { format, parseISO, startOfMonth } from 'date-fns';

import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { SectionHeader } from '@/components/ui/PageHeader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { colors, spacing, tones, type Tone } from '@/constants/theme';
import { useAttendanceForMonth, useLeaveRequests } from '@/hooks/use-data';
import {
  attendanceMarks,
  monthStats,
  recordTone,
  recordTypeLabel,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_TIMEZONE,
  durationLabel,
  formatDateLabel,
  formatMonth,
  formatTime,
  minutesBetween,
  timeLabelFromDb,
  todayInZone,
  workingDaysLabel,
} from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import type { AttendanceRecord, LeaveRequest } from '@/lib/types';

export function AttendanceScreen() {
  const router = useRouter();
  const { company, shift } = useAuth();
  const timezone = company?.timezone ?? DEFAULT_TIMEZONE;
  const today = todayInZone(timezone);
  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)));
  const [selectedDate, setSelectedDate] = useState(today);
  const [refreshing, setRefreshing] = useState(false);

  const attendanceQuery = useAttendanceForMonth(month);
  const leaveQuery = useLeaveRequests(100);
  const records = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);
  const leaves = useMemo(() => leaveQuery.data ?? [], [leaveQuery.data]);
  const monthKey = format(month, 'yyyy-MM');

  const monthLeaves = useMemo(
    () => leaves.filter((leave) => leave.leave_date.startsWith(monthKey)),
    [leaves, monthKey],
  );
  const stats = useMemo(() => monthStats(records, monthLeaves), [records, monthLeaves]);
  const marks = useMemo(() => attendanceMarks(records, leaves), [records, leaves]);
  const selectedRecord = records.find((record) => record.work_date === selectedDate) ?? null;
  const selectedLeave =
    leaves.find((leave) => leave.leave_date === selectedDate && leave.status === 'approved') ?? null;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([attendanceQuery.refetch(), leaveQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const goToToday = () => {
    setMonth(startOfMonth(parseISO(today)));
    setSelectedDate(today);
  };

  const showInitialSkeleton = attendanceQuery.isLoading && !attendanceQuery.data;

  return (
    <Screen
      edges={['top', 'left', 'right']}
      refreshControl={
        <RefreshControl
          colors={[colors.indigoSoft]}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          tintColor={colors.indigoSoft}
        />
      }>
      <ScreenHeader
        right={
          <Button
            label="Today"
            onPress={goToToday}
            size="sm"
            variant="secondary"
            fullWidth={false}
            icon={<RefreshCw size={13} color={colors.text} strokeWidth={2} />}
          />
        }
        subtitle={formatMonth(month)}
        title="My attendance"
      />

      {attendanceQuery.isError && !attendanceQuery.data ? (
        <Card padding={4}>
          <ErrorState
            message={friendlyError(attendanceQuery.error)}
            onRetry={() => void attendanceQuery.refetch()}
          />
        </Card>
      ) : showInitialSkeleton ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          <View style={styles.statGrid}>
            <StatTile hint="office" icon={MapPin} label="Present" tone="success" value={stats.present} />
            <StatTile hint="office" icon={Clock3} label="Late" tone="warning" value={stats.late} />
            <StatTile hint="auto" icon={AlertCircle} label="Absent" tone="danger" value={stats.absent} />
            <StatTile hint="remote" icon={Home} label="WFH" tone="info" value={stats.wfh} />
            <StatTile
              hint="approved"
              icon={Umbrella}
              label="Leave"
              tone="leave"
              value={stats.approvedLeave}
            />
          </View>

          <Card style={styles.calendarCard}>
            <Calendar
              markedDates={marks}
              month={month}
              onMonthChange={(next) => {
                setMonth(next);
                const key = format(next, 'yyyy-MM');
                setSelectedDate(key === today.slice(0, 7) ? today : `${key}-01`);
              }}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
            />
            <View style={styles.legend}>
              <LegendItem label="Present" tone="success" />
              <LegendItem label="Late" tone="warning" />
              <LegendItem label="Absent" tone="danger" />
              <LegendItem label="WFH" tone="info" />
              <LegendItem label="Leave" tone="leave" />
            </View>
          </Card>

          <SectionHeader
            caption={formatDateLabel(selectedDate, 'EEEE, dd MMMM yyyy')}
            title="Day details"
            right={
              attendanceQuery.isFetching ? (
                <Text variant="small" color={colors.muted}>
                  Refreshing
                </Text>
              ) : undefined
            }
          />
          <DayDetails
            leave={selectedLeave}
            record={selectedRecord}
            shift={shift}
            timezone={timezone}
            selectedDate={selectedDate}
            today={today}
          />

          <SectionHeader
            caption={`${records.length} record${records.length === 1 ? '' : 's'} this month`}
            title="Month log"
          />

          {records.length ? (
            <Card padding={0}>
              {records.map((record, index) => (
                <PressableScale
                  key={record.id}
                  accessibilityRole="button"
                  haptic="selection"
                  onPress={() => setSelectedDate(record.work_date)}
                  style={[styles.logRow, index > 0 ? styles.rowDivider : null]}>
                  <View
                    style={[
                      styles.logIcon,
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
                  <View style={styles.logCopy}>
                    <Text variant="small" color={colors.text} weight="medium">
                      {formatDateLabel(record.work_date, 'EEE, dd MMM')}
                    </Text>
                    <Text variant="small" color={colors.muted} numberOfLines={1}>
                      {record.status === 'absent'
                        ? 'No check-in before shift end'
                        : `${recordTypeLabel(record)} · ${formatTime(record.check_in_at, timezone)} – ${formatTime(record.check_out_at, timezone)}`}
                    </Text>
                  </View>
                  <StatusBadge status={record.status} />
                  <ChevronRight size={15} color={colors.muted} strokeWidth={1.9} />
                </PressableScale>
              ))}
            </Card>
          ) : (
            <Card padding={4}>
              <EmptyState
                icon={<CalendarDays size={23} color={colors.indigoSoft} strokeWidth={1.7} />}
                message="Attendance appears here after your first office scan or WFH check-in."
                title="No records this month"
                actionLabel="Open scan"
                onAction={() => router.navigate('/scan')}
              />
            </Card>
          )}
        </>
      )}

      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function DayDetails({
  record,
  leave,
  shift,
  timezone,
  selectedDate,
  today,
}: {
  record: AttendanceRecord | null;
  leave: LeaveRequest | null;
  shift: ReturnType<typeof useAuth>['shift'];
  timezone: string;
  selectedDate: string;
  today: string;
}) {
  if (record) {
    if (record.status === 'absent') {
      return (
        <Card padding={18} tone="danger" variant="tint">
          <View style={styles.detailHeader}>
            <Badge dot label="Absent" tone="danger" />
            <StatusBadge status={record.status} />
          </View>
          <Text variant="small" color={colors.textSecondary}>
            No check-in was recorded before your shift ended, so this day is marked absent. If you
            were present, ask your HR or Admin to correct it.
          </Text>
          {shift ? (
            <View style={styles.shiftLine}>
              <Clock3 size={14} color={colors.muted} strokeWidth={1.9} />
              <Text variant="small" color={colors.muted}>
                {shift.name} · {timeLabelFromDb(shift.start_time)} – {timeLabelFromDb(shift.end_time)} ·{' '}
                {workingDaysLabel(shift.working_days)}
              </Text>
            </View>
          ) : null}
        </Card>
      );
    }
    const checkIn = record.check_in_at ?? new Date().toISOString();
    const total = record.check_out_at
      ? durationLabel(minutesBetween(checkIn, record.check_out_at))
      : durationLabel(minutesBetween(checkIn, new Date().toISOString()));
    return (
      <Card padding={18} tone={recordTone(record)} variant="tint">
        <View style={styles.detailHeader}>
          <Badge
            dot
            label={record.attendance_type === 'wfh' ? 'WFH' : 'Office'}
            tone={record.attendance_type === 'wfh' ? 'info' : 'success'}
          />
          <StatusBadge status={record.status} />
        </View>
        <View style={styles.detailTimes}>
          <DetailCell label="Check in" value={formatTime(record.check_in_at, timezone)} />
          <View style={styles.detailDivider} />
          <DetailCell label="Check out" value={formatTime(record.check_out_at, timezone)} />
          <View style={styles.detailDivider} />
          <DetailCell label="Duration" value={total} />
        </View>
        <Text variant="small" color={colors.textSecondary}>
          {record.attendance_type === 'wfh'
            ? 'Remote attendance was recorded with your WFH passcode.'
            : 'Office attendance was recorded by scanning the VorldX QR display.'}
        </Text>
      </Card>
    );
  }

  if (leave) {
    return (
      <Card padding={18} tone="leave" variant="tint">
        <View style={styles.detailHeader}>
          <Badge dot label="Approved leave" tone="leave" />
        </View>
        <Text variant="small" color={colors.textSecondary}>
          {leave.reason}
        </Text>
        {leave.review_notes ? (
          <Text variant="small" color={colors.muted}>
            Admin note: {leave.review_notes}
          </Text>
        ) : null}
      </Card>
    );
  }

  return (
    <Card padding={18} variant="soft">
      <View style={styles.detailHeader}>
        <Badge label={selectedDate > today ? 'Upcoming' : 'No record'} tone="neutral" dot />
      </View>
      <Text variant="small" color={colors.textSecondary}>
        {selectedDate > today
          ? 'This day is still ahead. Your shift schedule is shown below.'
          : 'No attendance or approved leave was recorded for this date.'}
      </Text>
      {shift ? (
        <View style={styles.shiftLine}>
          <Clock3 size={14} color={colors.muted} strokeWidth={1.9} />
          <Text variant="small" color={colors.muted}>
            {shift.name} · {timeLabelFromDb(shift.start_time)} – {timeLabelFromDb(shift.end_time)} ·{' '}
            {workingDaysLabel(shift.working_days)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
      <Text variant="monoSmall" color={colors.text}>
        {value}
      </Text>
    </View>
  );
}

function LegendItem({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: tones[tone].fg }]} />
      <Text variant="caption" color={colors.muted} style={styles.legendLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  calendarCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 8.5,
    letterSpacing: 0.7,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(184, 190, 255, 0.1)',
  },
  detailCell: {
    flex: 1,
    gap: 2,
  },
  detailDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(184, 190, 255, 0.1)',
    marginHorizontal: spacing.sm,
  },
  shiftLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCopy: {
    flex: 1,
    gap: 1,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
  },
  bottomSpace: {
    height: spacing.xxl,
  },
});
