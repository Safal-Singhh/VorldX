import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChevronRight,
  Globe2,
  Hash,
  Home,
  Info,
  KeyRound,
  LogOut,
  Mail,
  MessageSquare,
  ShieldCheck,
  Trash2,
  Umbrella,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing, tones } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDateLabel, timeLabelFromDb, workingDaysLabel } from '@/lib/dates';
import { queryClient, queryPersister } from '@/lib/query-client';
import { openWebLogin } from '@/lib/web';

export function ProfileScreen() {
  const router = useRouter();
  const { employee, company, shift, refresh, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out of VorldX?', 'You will need your work email and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
            () => undefined,
          );
          void signOut();
        },
      },
    ]);
  };

  const confirmClearCache = () => {
    Alert.alert(
      'Clear offline data?',
      'Cached attendance and requests on this device will be removed. Your records stay safe on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            queryClient.clear();
            void queryPersister.removeClient();
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

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
        subtitle={employee?.designation || 'Employee'}
        title={employee?.full_name ?? 'Your profile'}
        right={<Avatar name={employee?.full_name ?? 'VX'} showRing size={48} />}
      />

      <Card style={styles.identityCard} variant="raised">
        <View style={styles.identityRow}>
          <Avatar name={employee?.full_name ?? 'VX'} size={72} />
          <View style={styles.identityCopy}>
            <Text variant="subheading" numberOfLines={1}>
              {employee?.full_name ?? '—'}
            </Text>
            <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
              {employee?.designation || 'Employee'}
            </Text>
            <View style={styles.badgeRow}>
              <Badge dot label="Employee" tone="indigo" />
              {employee?.work_type ? <Badge label={employee.work_type} tone="neutral" /> : null}
            </View>
          </View>
        </View>
      </Card>

      <SectionHeader caption="Read-only in the app" title="Profile details" />
      <Card padding={0}>
        <InfoRow icon={Hash} label="Employee code" value={employee?.employee_code ?? '—'} />
        <InfoRow icon={Mail} label="Work email" value={employee?.email ?? '—'} />
        <InfoRow icon={Briefcase} label="Department" value={employee?.department || '—'} />
        <InfoRow
          icon={CalendarDays}
          label="Joining date"
          value={employee?.joining_date ? formatDateLabel(employee.joining_date, 'dd MMM yyyy') : '—'}
        />
        <InfoRow icon={Building2} label="Company" value={company?.name ?? '—'} />
        <InfoRow icon={Globe2} label="Timezone" value={company?.timezone ?? '—'} last />
      </Card>

      <SectionHeader caption={shift?.name ?? 'Not assigned'} title="Shift" />
      <Card variant="soft">
        {shift ? (
          <>
            <View style={styles.shiftRow}>
              <Text variant="small" color={colors.textSecondary}>
                Working hours
              </Text>
              <Text variant="monoSmall" color={colors.text}>
                {timeLabelFromDb(shift.start_time)} – {timeLabelFromDb(shift.end_time)}
              </Text>
            </View>
            <View style={styles.shiftRow}>
              <Text variant="small" color={colors.textSecondary}>
                Grace period
              </Text>
              <Text variant="monoSmall" color={colors.text}>
                {shift.grace_period_minutes} minutes
              </Text>
            </View>
            <View style={styles.shiftRow}>
              <Text variant="small" color={colors.textSecondary}>
                Working days
              </Text>
              <Text variant="monoSmall" color={colors.text}>
                {workingDaysLabel(shift.working_days)}
              </Text>
            </View>
          </>
        ) : (
          <Text variant="small" color={colors.muted}>
            No shift is assigned yet.
          </Text>
        )}
      </Card>

      <SectionHeader title="Shortcuts" />
      <Card padding={0}>
        <LinkRow
          icon={CalendarDays}
          label="My attendance"
          onPress={() => router.push('/attendance')}
          tone="success"
        />
        <LinkRow
          icon={Home}
          label="My WFH requests"
          onPress={() => router.navigate({ pathname: '/requests', params: { tab: 'wfh' } })}
          tone="info"
        />
        <LinkRow
          icon={Umbrella}
          label="My leave requests"
          onPress={() => router.navigate({ pathname: '/requests', params: { tab: 'leave' } })}
          tone="leave"
        />
        <LinkRow
          icon={MessageSquare}
          label="My feedback"
          onPress={() => router.push('/feedback')}
          tone="indigo"
        />
        <LinkRow
          icon={ShieldCheck}
          label="Policies"
          onPress={() => router.push('/policies')}
          tone="neutral"
        />
        <LinkRow
          icon={KeyRound}
          label="Change password"
          onPress={() => router.push('/change-password')}
          tone="warning"
          last
        />
      </Card>

      <SectionHeader title="Account" />
      <Card style={styles.accountCard}>
        <View style={styles.accountRow}>
          <View style={styles.accountIcon}>
            <Globe2 size={16} color={colors.indigoSoft} strokeWidth={1.9} />
          </View>
          <View style={styles.accountCopy}>
            <Text variant="small" color={colors.text} weight="medium">
              VorldX web app
            </Text>
            <Text variant="small" color={colors.muted}>
              Password setup and recovery happen on the web.
            </Text>
          </View>
          <Button
            label="Open"
            onPress={() => void openWebLogin()}
            size="sm"
            variant="secondary"
            fullWidth={false}
          />
        </View>
        <View style={styles.accountDivider} />
        <View style={styles.accountRow}>
          <View style={[styles.accountIcon, { backgroundColor: tones.danger.bg }]}>
            <Trash2 size={16} color={colors.danger} strokeWidth={1.9} />
          </View>
          <View style={styles.accountCopy}>
            <Text variant="small" color={colors.text} weight="medium">
              Clear offline data
            </Text>
            <Text variant="small" color={colors.muted}>
              Removes the cached copy stored on this device.
            </Text>
          </View>
          <Button
            label="Clear"
            onPress={confirmClearCache}
            size="sm"
            variant="secondary"
            fullWidth={false}
          />
        </View>
      </Card>

      <Button
        icon={<LogOut size={17} color={colors.danger} strokeWidth={1.9} />}
        label="Sign out"
        onPress={confirmSignOut}
        style={styles.signOut}
        variant="danger"
      />

      <Card style={styles.aboutCard} variant="soft">
        <View style={styles.aboutHeader}>
          <View style={styles.aboutIcon}>
            <Info size={15} color={colors.muted} strokeWidth={1.9} />
          </View>
          <Text variant="small" color={colors.textSecondary} weight="medium">
            VorldX Attendance · v{version}
          </Text>
        </View>
        <Text variant="small" color={colors.muted}>
          Employee app for attendance, WFH, leave and feedback. Admin and HR tools stay on the web
          dashboard. Signed in as {employee?.email ?? '—'}.
        </Text>
        <View style={styles.aboutBadge}>
          <Badge dot label="Employee access only" tone="neutral" />
        </View>
      </Card>

      <View style={styles.bottomSpace} />
    </Screen>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last ? styles.rowDivider : null]}>
      <View style={styles.infoIcon}>
        <Icon size={15} color={colors.muted} strokeWidth={1.9} />
      </View>
      <Text variant="small" color={colors.muted}>
        {label}
      </Text>
      <Text variant="small" color={colors.text} numberOfLines={1} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({
  icon: Icon,
  label,
  onPress,
  tone,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone: keyof typeof tones;
  last?: boolean;
}) {
  const palette = tones[tone];
  return (
    <PressableScale
      accessibilityRole="button"
      haptic="selection"
      onPress={onPress}
      style={[styles.linkRow, !last ? styles.rowDivider : null]}>
      <View style={[styles.linkIcon, { backgroundColor: palette.bg }]}>
        <Icon size={16} color={palette.fg} strokeWidth={1.9} />
      </View>
      <Text variant="bodyMedium" style={styles.linkLabel}>
        {label}
      </Text>
      <ChevronRight size={16} color={colors.muted} strokeWidth={1.9} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    marginTop: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(184, 190, 255, 0.08)',
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 5,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    flex: 1,
  },
  accountCard: {
    gap: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
  },
  accountCopy: {
    flex: 1,
    gap: 1,
  },
  accountDivider: {
    height: 1,
    backgroundColor: 'rgba(184, 190, 255, 0.08)',
  },
  signOut: {
    marginTop: spacing.xl,
  },
  aboutCard: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aboutIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  aboutBadge: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  bottomSpace: {
    height: spacing.xxl,
  },
});
