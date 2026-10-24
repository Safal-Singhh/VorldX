import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Home,
  KeyRound,
  MapPin,
  ShieldCheck,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, Notice } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Input';
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radii, spacing, type Tone } from '@/constants/theme';
import { useRecentAttendance, useWfhPasscode, useWfhPasscodes, useWfhRequests } from '@/hooks/use-data';
import { markWfhAttendance } from '@/lib/api';
import {
  todayApprovedWfh,
  todayRecord,
  recordTypeLabel,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_TIMEZONE,
  durationLabel,
  formatDateLabel,
  formatTime,
  minutesBetween,
  minutesLabel,
  todayInZone,
} from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import type { WfhPasscode, WfhRequest } from '@/lib/types';

type Feedback = { tone: Tone; title: string; message: string };

export function WfhScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { company, policy } = useAuth();
  const timezone = company?.timezone ?? DEFAULT_TIMEZONE;
  const attendanceQuery = useRecentAttendance(90);
  const requestsQuery = useWfhRequests(40);
  const [refreshing, setRefreshing] = useState(false);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState<'auto' | 'manual' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [copied, setCopied] = useState(false);

  const today = todayInZone(timezone);
  const records = attendanceQuery.data ?? [];
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const todayAttendance = todayRecord(records, timezone);
  const approvedToday = todayApprovedWfh(requests, timezone);
  const todayRequest = requests.find((request) => request.request_date === today) ?? null;
  const passcodeQuery = useWfhPasscode(approvedToday?.id);
  const upcomingApproved = useMemo(
    () =>
      requests
        .filter((request) => request.status === 'approved' && request.request_date > today)
        .sort((a, b) => a.request_date.localeCompare(b.request_date))
        .slice(0, 4),
    [requests, today],
  );
  const upcomingPasscodes = useWfhPasscodes(upcomingApproved);
  const passcode = passcodeQuery.data as WfhPasscode | undefined;

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        attendanceQuery.refetch(),
        requestsQuery.refetch(),
        passcodeQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const mark = async (code: string, source: 'auto' | 'manual') => {
    if (!code.trim() || busy) return;
    setBusy(source);
    setFeedback(null);
    try {
      const result = await markWfhAttendance(code.trim());
      setFeedback({
        tone: 'success',
        title: result.action === 'checkin' ? 'Checked in' : 'Checked out',
        message:
          result.action === 'checkin'
            ? `WFH attendance started at ${formatTime(result.check_in_at, timezone)}. ${result.uses_left} use left for check-out.`
            : `WFH attendance completed at ${formatTime(result.check_out_at, timezone)}.`,
      });
      setManual('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance-recent'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-month'] }),
        queryClient.invalidateQueries({ queryKey: ['wfh-passcode'] }),
        queryClient.invalidateQueries({ queryKey: ['wfh-passcodes'] }),
      ]);
    } catch (error) {
      setFeedback({
        tone: 'danger',
        title: 'Could not mark WFH attendance',
        message: friendlyError(error),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
    } finally {
      setBusy(null);
    }
  };

  const copyPasscode = async () => {
    if (!passcode?.passcode) return;
    await Clipboard.setStringAsync(passcode.passcode);
    setCopied(true);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const alreadyOffice = todayAttendance?.attendance_type === 'office';
  const isAbsent = todayAttendance?.status === 'absent';
  const wfhCompleted = todayAttendance?.attendance_type === 'wfh' && Boolean(todayAttendance.check_out_at);
  const canCheckOut = todayAttendance?.attendance_type === 'wfh' && !todayAttendance.check_out_at;
  const actionLabel = canCheckOut ? 'Check out with passcode' : 'Check in with passcode';
  const passcodeUsable =
    Boolean(passcode?.passcode) &&
    !passcode?.used_up &&
    !passcode?.expired &&
    !alreadyOffice &&
    !isAbsent &&
    !wfhCompleted;

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
        eyebrow="Remote attendance"
        title="Work from home"
        subtitle="Your approved passcode works twice: once to check in, once to check out."
        right={
          isAbsent ? (
            <Badge label="Absent" tone="danger" dot />
          ) : todayAttendance?.attendance_type === 'wfh' ? (
            <Badge label={wfhCompleted ? 'Complete' : 'Active'} tone={wfhCompleted ? 'success' : 'info'} dot />
          ) : (
            <Badge label="Today" tone="neutral" />
          )
        }
      />

      {policy && !policy.wfh_enabled ? (
        <Notice
          message="WFH requests are disabled for your company. Existing approved passcodes can still be used today."
          title="WFH is paused"
          tone="warning"
        />
      ) : null}

      {feedback ? (
        <View style={styles.feedbackSpacing}>
          <Notice
            message={feedback.message}
            title={feedback.title}
            tone={feedback.tone}
            icon={
              feedback.tone === 'success' ? (
                <CheckCircle2 size={17} color={colors.success} strokeWidth={2} />
              ) : (
                <AlertCircle size={17} color={colors.danger} strokeWidth={2} />
              )
            }
          />
        </View>
      ) : null}

      {todayAttendance ? (
        <Card
          padding={16}
          style={styles.recapCard}
          tone={
            isAbsent
              ? 'danger'
              : todayAttendance.attendance_type === 'wfh'
                ? 'info'
                : 'success'
          }
          variant="tint">
          <View style={styles.recapIcon}>
            {isAbsent ? (
              <AlertCircle size={20} color={colors.danger} strokeWidth={1.9} />
            ) : todayAttendance.attendance_type === 'wfh' ? (
              <Home size={20} color={colors.info} strokeWidth={1.9} />
            ) : (
              <MapPin size={20} color={colors.success} strokeWidth={1.9} />
            )}
          </View>
          <View style={styles.recapCopy}>
            <Text variant="small" color={colors.textSecondary} weight="medium">
              {recordTypeLabel(todayAttendance)} ·{' '}
              {isAbsent ? 'No check-in' : todayAttendance.check_out_at ? 'Complete' : 'In progress'}
            </Text>
            <Text variant="small" color={colors.text}>
              {isAbsent
                ? 'No check-in was recorded before your shift ended.'
                : `${formatTime(todayAttendance.check_in_at, timezone)} – ${formatTime(todayAttendance.check_out_at, timezone)}${
                    todayAttendance.check_out_at && todayAttendance.check_in_at
                      ? ` · ${durationLabel(
                          minutesBetween(todayAttendance.check_in_at, todayAttendance.check_out_at),
                        )}`
                      : ''
                  }`}
            </Text>
          </View>
          <Badge
            label={
              isAbsent ? 'Absent' : todayAttendance.status === 'late' ? 'Late' : 'Present'
            }
            tone={
              isAbsent
                ? 'danger'
                : todayAttendance.status === 'late'
                  ? 'warning'
                  : 'success'
            }
          />
        </Card>
      ) : null}

      {alreadyOffice ? (
        <Card padding={18} style={styles.officeCard} tone="success" variant="tint">
          <MapPin size={24} color={colors.success} strokeWidth={1.8} />
          <Text variant="subheading" align="center">
            Office attendance is already recorded
          </Text>
          <Text variant="small" color={colors.textSecondary} align="center">
            Your day started in the office. Use the office QR when you leave to check out.
          </Text>
          <Button
            label="Open attendance"
            onPress={() => router.push('/attendance')}
            size="sm"
            variant="secondary"
            fullWidth={false}
            icon={<ChevronRight size={14} color={colors.text} strokeWidth={2} />}
          />
        </Card>
      ) : isAbsent ? (
        <Card padding={18} style={styles.officeCard} tone="danger" variant="tint">
          <AlertCircle size={24} color={colors.danger} strokeWidth={1.8} />
          <Text variant="subheading" align="center">
            Attendance closed for today
          </Text>
          <Text variant="small" color={colors.textSecondary} align="center">
            No check-in was recorded before your shift ended, so today is marked absent. Ask your HR
            or Admin to correct it if you were present.
          </Text>
          <Button
            label="Open attendance"
            onPress={() => router.push('/attendance')}
            size="sm"
            variant="secondary"
            fullWidth={false}
            icon={<ChevronRight size={14} color={colors.text} strokeWidth={2} />}
          />
        </Card>
      ) : approvedToday ? (
        <Card padding={20} style={styles.passcodeCard} variant="raised">
          <View style={styles.passcodeHeader}>
            <View style={styles.passcodeTitle}>
              <View style={styles.passcodeIcon}>
                <KeyRound size={18} color={colors.indigoSoft} strokeWidth={1.9} />
              </View>
              <View>
                <Text variant="subheading">Today&apos;s passcode</Text>
                <Text variant="small" color={colors.muted}>
                  {formatDateLabel(today, 'EEEE, dd MMM')}
                </Text>
              </View>
            </View>
            {passcode ? (
              <Badge
                dot
                label={
                  passcode.used_up
                    ? 'Used'
                    : passcode.expired
                      ? 'Expired'
                      : `${passcode.uses_left} left`
                }
                tone={passcode.used_up || passcode.expired ? 'danger' : 'success'}
              />
            ) : passcodeQuery.isLoading ? (
              <ActivityIndicator color={colors.indigoSoft} size="small" />
            ) : null}
          </View>

          {passcodeQuery.isError ? (
            <Notice
              message={friendlyError(passcodeQuery.error)}
              title="Passcode unavailable"
              tone="warning"
              actionLabel="Check again"
              onAction={() => void passcodeQuery.refetch()}
            />
          ) : (
            <>
              <PasscodeDigits passcode={passcode?.passcode ?? null} />
              <View style={styles.passcodeMeta}>
                <View style={styles.useDots}>
                  <View
                    style={[
                      styles.useDot,
                      {
                        backgroundColor:
                          passcode && passcode.uses_left >= 2 ? colors.success : colors.border,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.useDot,
                      {
                        backgroundColor:
                          passcode && passcode.uses_left >= 1 ? colors.success : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text variant="small" color={colors.muted}>
                  {passcode
                    ? passcode.used_up
                      ? 'This passcode has been fully used.'
                      : `${passcode.uses_left} of 2 uses available`
                    : passcodeQuery.isLoading
                      ? "Fetching today's passcode…"
                      : 'Waiting for your Admin to issue the passcode.'}
                </Text>
              </View>
              {passcode?.expires_at ? (
                <View style={styles.expiryRow}>
                  <Clock3 size={13} color={colors.muted} strokeWidth={1.9} />
                  <Text variant="small" color={colors.muted}>
                    Expires {formatExpiry(passcode.expires_at, timezone)}
                  </Text>
                </View>
              ) : null}

              {passcode?.passcode ? (
                <View style={styles.passcodeActions}>
                  <Button
                    disabled={!passcodeUsable}
                    label={
                      wfhCompleted
                        ? 'Day complete'
                        : passcode.expired
                          ? 'Passcode expired'
                          : passcode.used_up
                            ? 'Passcode fully used'
                            : actionLabel
                    }
                    loading={busy === 'auto'}
                    onPress={() => void mark(passcode.passcode as string, 'auto')}
                    style={styles.passcodeButton}
                    icon={
                      passcodeUsable ? (
                        canCheckOut ? (
                          <CheckCircle2 size={16} color={colors.white} strokeWidth={2} />
                        ) : (
                          <Home size={16} color={colors.white} strokeWidth={2} />
                        )
                      ) : undefined
                    }
                  />
                  <Button
                    label={copied ? 'Copied' : 'Copy'}
                    onPress={() => void copyPasscode()}
                    style={styles.copyButton}
                    variant="secondary"
                    icon={
                      <ClipboardCopy
                        size={16}
                        color={copied ? colors.success : colors.text}
                        strokeWidth={1.9}
                      />
                    }
                  />
                </View>
              ) : null}
            </>
          )}
        </Card>
      ) : (
        <Card padding={4} style={styles.emptyCard}>
          {todayRequest?.status === 'pending' ? (
            <EmptyState
              icon={<CalendarClock size={23} color={colors.warning} strokeWidth={1.7} />}
              message="You can check in as soon as your Admin approves it and the passcode appears here."
              title="WFH request pending"
            />
          ) : todayRequest?.status === 'rejected' ? (
            <EmptyState
              icon={<Ban size={23} color={colors.danger} strokeWidth={1.7} />}
              message={todayRequest.review_notes ?? 'You can submit a new request for a future date.'}
              title="WFH request rejected"
            />
          ) : (
            <EmptyState
              icon={<Home size={23} color={colors.indigoSoft} strokeWidth={1.7} />}
              message="Request WFH for today from the Requests tab. Once approved, your six-digit passcode appears here."
              title="No approved WFH for today"
              actionLabel="Open requests"
              onAction={() => router.navigate({ pathname: '/requests', params: { tab: 'wfh' } })}
            />
          )}
        </Card>
      )}

      {!alreadyOffice && !wfhCompleted && !isAbsent ? (
        <Card padding={16} style={styles.manualCard}>
          <View style={styles.manualHeader}>
            <ShieldCheck size={17} color={colors.indigoSoft} strokeWidth={1.9} />
            <View style={styles.manualCopy}>
              <Text variant="small" color={colors.textSecondary} weight="medium">
                Have a different passcode?
              </Text>
              <Text variant="small" color={colors.muted}>
                Enter the six digits your Admin shared with you.
              </Text>
            </View>
          </View>
          <View style={styles.manualRow}>
            <Input
              containerStyle={styles.manualInput}
              inputStyle={styles.monoInput}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setManual(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              value={manual}
              editable={!busy}
            />
            <Button
              disabled={manual.length !== 6}
              label="Mark"
              loading={busy === 'manual'}
              onPress={() => void mark(manual, 'manual')}
              size="md"
              fullWidth={false}
              style={styles.manualButton}
            />
          </View>
        </Card>
      ) : null}

      <View style={styles.note}>
        <Clock3 size={14} color={colors.muted} strokeWidth={1.9} />
        <Text variant="small" color={colors.muted}>
          Requests close {minutesLabel(policy?.request_cutoff_minutes ?? 120)} before shift start.
        </Text>
      </View>

      {upcomingApproved.length ? (
        <>
          <SectionHeader
            caption="Approved days ahead"
            title="Upcoming WFH"
            actionLabel="All requests"
            onAction={() => router.navigate({ pathname: '/requests', params: { tab: 'wfh' } })}
          />
          <Card padding={0}>
            {upcomingApproved.map((request, index) => (
              <UpcomingRow
                key={request.id}
                divider={index > 0}
                passcode={upcomingPasscodes.data?.[request.id] ?? null}
                request={request}
                timezone={timezone}
              />
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function PasscodeDigits({ passcode }: { passcode: string | null }) {
  const digits = passcode?.split('') ?? [];
  return (
    <View style={styles.digitsRow}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.digitCell,
            passcode ? styles.digitCellActive : null,
          ]}>
          <Text
            style={{
              fontFamily: fonts.monoBold,
              fontSize: 24,
              lineHeight: 30,
              letterSpacing: 0,
              color: passcode ? colors.text : colors.muted,
            }}>
            {digits[index] ?? '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function UpcomingRow({
  request,
  passcode,
  timezone,
  divider,
}: {
  request: WfhRequest;
  passcode: WfhPasscode | null;
  timezone: string;
  divider: boolean;
}) {
  return (
    <View style={[styles.upcomingRow, divider ? styles.rowDivider : null]}>
      <View style={styles.upcomingDate}>
        <Text variant="monoSmall" color={colors.text}>
          {formatDateLabel(request.request_date, 'EEE')}
        </Text>
        <Text variant="caption" color={colors.muted}>
          {formatDateLabel(request.request_date, 'dd MMM')}
        </Text>
      </View>
      <View style={styles.upcomingCopy}>
        <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
          {request.reason}
        </Text>
        <Text variant="small" color={colors.muted}>
          {passcode?.passcode
            ? `Passcode ${passcode.passcode.slice(0, 3)} ${passcode.passcode.slice(3)}`
            : 'Passcode not issued yet'}
        </Text>
      </View>
      <Badge
        label={passcode?.expired ? 'Expired' : passcode?.used_up ? 'Used' : 'Approved'}
        tone={passcode?.expired || passcode?.used_up ? 'neutral' : 'success'}
      />
    </View>
  );
}

function formatExpiry(iso: string, timezone: string): string {
  const day = formatInTimeZone(new Date(iso), timezone, 'yyyy-MM-dd');
  const today = todayInZone(timezone);
  if (day === today) return formatInTimeZone(new Date(iso), timezone, 'h:mm a');
  return formatInTimeZone(new Date(iso), timezone, 'dd MMM, h:mm a');
}

const styles = StyleSheet.create({
  feedbackSpacing: {
    marginBottom: spacing.md,
  },
  recapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recapIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 8, 14, 0.28)',
  },
  recapCopy: {
    flex: 1,
    gap: 2,
  },
  officeCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  passcodeCard: {
    gap: spacing.md,
  },
  passcodeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  passcodeTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  passcodeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.24)',
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: spacing.xs,
  },
  digitCell: {
    flex: 1,
    height: 56,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 8, 14, 0.62)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  digitCellActive: {
    borderColor: 'rgba(89, 101, 242, 0.34)',
    backgroundColor: 'rgba(89, 101, 242, 0.08)',
  },
  passcodeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  useDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  useDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  passcodeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  passcodeButton: {
    flex: 1.8,
    paddingHorizontal: 10,
  },
  copyButton: {
    flex: 0.75,
    paddingHorizontal: 8,
  },
  emptyCard: {
    padding: 0,
  },
  manualCard: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  manualCopy: {
    flex: 1,
    gap: 1,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manualInput: {
    flex: 1,
  },
  monoInput: {
    fontFamily: fonts.mono,
    letterSpacing: 5,
    fontSize: 16,
  },
  manualButton: {
    minWidth: 96,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  upcomingDate: {
    width: 38,
    alignItems: 'center',
    gap: 1,
  },
  upcomingCopy: {
    flex: 1,
    gap: 1,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
  },
  bottomSpace: {
    height: spacing.xl,
  },
});
