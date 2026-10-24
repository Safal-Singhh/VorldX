import {
  Building2,
  CalendarClock,
  Clock3,
  Fingerprint,
  Home,
  KeyRound,
  Lock,
  QrCode,
  ShieldCheck,
  Umbrella,
  UserCog,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { minutesLabel, timeLabelFromDb, workingDaysLabel } from '@/lib/dates';

export function PoliciesScreen() {
  const { company, policy, shift, refresh } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

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
      <ScreenHeader subtitle="Set by your Admin" title="Policies" />

      <Notice
        message="These rules are read-only in the app. Only an Admin can change the company settings."
        title="Company rules"
        tone="indigo"
      />

      <PolicySection icon={<Home size={18} color={colors.info} strokeWidth={1.9} />} title="Work from home">
        <View style={styles.row}>
          <Text variant="small" color={colors.textSecondary}>
            Requests
          </Text>
          <Badge
            dot
            label={policy?.wfh_enabled ? 'Enabled' : 'Disabled'}
            tone={policy?.wfh_enabled ? 'success' : 'danger'}
          />
        </View>
        <View style={styles.row}>
          <Text variant="small" color={colors.textSecondary}>
            Request cutoff
          </Text>
          <Text variant="monoSmall" color={colors.text}>
            {minutesLabel(policy?.request_cutoff_minutes ?? 120)} before shift
          </Text>
        </View>
        <View style={styles.ruleBlock}>
          <Text variant="caption" color={colors.muted}>
            Eligibility
          </Text>
          <Text variant="small" color={colors.textSecondary}>
            {policy?.wfh_eligibility_rules || 'No additional eligibility rules.'}
          </Text>
        </View>
      </PolicySection>

      <PolicySection icon={<Clock3 size={18} color={colors.indigoSoft} strokeWidth={1.9} />} title="Shift and attendance">
        {shift ? (
          <>
            <View style={styles.row}>
              <Text variant="small" color={colors.textSecondary}>
                Assigned shift
              </Text>
              <Text variant="small" color={colors.text} weight="medium">
                {shift.name}
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="small" color={colors.textSecondary}>
                Working hours
              </Text>
              <Text variant="monoSmall" color={colors.text}>
                {timeLabelFromDb(shift.start_time)} – {timeLabelFromDb(shift.end_time)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="small" color={colors.textSecondary}>
                Grace period
              </Text>
              <Text variant="monoSmall" color={colors.text}>
                {shift.grace_period_minutes} minutes
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="small" color={colors.textSecondary}>
                Working days
              </Text>
              <Text variant="monoSmall" color={colors.text}>
                {workingDaysLabel(shift.working_days)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="small" color={colors.textSecondary}>
                Auto-absence
              </Text>
              <Badge
                dot
                label={policy?.auto_absent_enabled ? 'Enabled' : 'Disabled'}
                tone={policy?.auto_absent_enabled ? 'success' : 'danger'}
              />
            </View>
          </>
        ) : (
          <Text variant="small" color={colors.muted}>
            No shift is assigned yet. Contact your Admin or HR.
          </Text>
        )}
        <Text variant="small" color={colors.muted} style={styles.paragraph}>
          Office attendance opens when you scan the live QR display. The code rotates every 18
          seconds, and the scan marks your own record only.
        </Text>
        <Text variant="small" color={colors.muted} style={styles.paragraph}>
          If no check-in is recorded by shift end on a working day, the day is marked Absent
          automatically. Approved leave is never marked absent, and past days are not backfilled.
        </Text>
      </PolicySection>

      <PolicySection icon={<Umbrella size={18} color={colors.leave} strokeWidth={1.9} />} title="Leave">
        <View style={styles.row}>
          <Text variant="small" color={colors.textSecondary}>
            Request format
          </Text>
          <Text variant="monoSmall" color={colors.text}>
            One date per request
          </Text>
        </View>
        <View style={styles.row}>
          <Text variant="small" color={colors.textSecondary}>
            Monthly limit
          </Text>
          <Text variant="monoSmall" color={colors.text}>
            3 pending or approved requests
          </Text>
        </View>
        <Text variant="small" color={colors.muted} style={styles.paragraph}>
          Each request needs a short reason. Your Admin reviews it, and approved leave appears on
          your attendance calendar. Approved leave does not require a check-in.
        </Text>
      </PolicySection>

      <PolicySection icon={<QrCode size={18} color={colors.success} strokeWidth={1.9} />} title="Check-in methods">
        <PolicyRow
          icon={<QrCode size={15} color={colors.success} strokeWidth={1.9} />}
          text="Office: scan the VorldX QR display when you arrive and again when you leave."
        />
        <PolicyRow
          icon={<Home size={15} color={colors.info} strokeWidth={1.9} />}
          text="Work from home: use the six-digit passcode from an approved request. It works exactly twice, once for check-in and once for check-out."
        />
        <PolicyRow
          icon={<KeyRound size={15} color={colors.warning} strokeWidth={1.9} />}
          text="If a passcode expires before you check out, contact your Admin or HR."
        />
      </PolicySection>

      <PolicySection icon={<ShieldCheck size={18} color={colors.success} strokeWidth={1.9} />} title="Records and privacy">
        <PolicyRow
          icon={<Lock size={15} color={colors.textSecondary} strokeWidth={1.9} />}
          text="Attendance, WFH and leave records are stored in your company workspace and shown read-only in the app."
        />
        <PolicyRow
          icon={<Fingerprint size={15} color={colors.textSecondary} strokeWidth={1.9} />}
          text="Only you can read your own records. Admin and HR can review requests and corrections."
        />
        <PolicyRow
          icon={<UserCog size={15} color={colors.textSecondary} strokeWidth={1.9} />}
          text="Corrections and profile changes are handled by your Admin or HR."
        />
        <PolicyRow
          icon={<CalendarClock size={15} color={colors.textSecondary} strokeWidth={1.9} />}
          text="The app keeps a short offline copy of attendance and requests for reading when you lose connection."
        />
      </PolicySection>

      <PolicySection icon={<Building2 size={18} color={colors.indigoSoft} strokeWidth={1.9} />} title="Company">
        <View style={styles.row}>
          <Text variant="small" color={colors.textSecondary}>
            Company
          </Text>
          <Text variant="small" color={colors.text} weight="medium">
            {company?.name ?? '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text variant="small" color={colors.textSecondary}>
            Timezone
          </Text>
          <Text variant="monoSmall" color={colors.text}>
            {company?.timezone ?? '—'}
          </Text>
        </View>
      </PolicySection>

      <Text variant="small" color={colors.muted} align="center" style={styles.footer}>
        Need a change? Contact your Admin or HR from the web dashboard.
      </Text>
    </Screen>
  );
}

function PolicySection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <Text variant="subheading">{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

function PolicyRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.policyRow}>
      <View style={styles.policyIcon}>{icon}</View>
      <Text variant="small" color={colors.textSecondary} style={styles.policyText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.2)',
  },
  sectionBody: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  ruleBlock: {
    gap: 3,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  paragraph: {
    marginTop: spacing.xs,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  policyIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  policyText: {
    flex: 1,
    paddingTop: 3,
  },
  footer: {
    marginTop: spacing.xxl,
    maxWidth: 420,
    alignSelf: 'center',
  },
});
