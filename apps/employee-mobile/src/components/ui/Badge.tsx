import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { radii, tones, type Tone } from '@/constants/theme';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: ReactNode;
  dot?: boolean;
  size?: 'sm' | 'md';
}

const statusToTone: Record<string, Tone> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  cancelled: 'neutral',
  office: 'indigo',
  wfh: 'info',
  active: 'success',
  inactive: 'neutral',
};

export function toneForStatus(status: string): Tone {
  return statusToTone[status.toLowerCase()] ?? 'neutral';
}

export function Badge({ label, tone = 'neutral', icon, dot = false, size = 'sm' }: BadgeProps) {
  const palette = tones[tone];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          paddingVertical: isSmall ? 4 : 6,
          paddingHorizontal: isSmall ? 8 : 10,
          gap: isSmall ? 5 : 6,
        },
      ]}>
      {icon}
      {dot ? (
        <View style={[styles.dot, { backgroundColor: palette.fg }]} />
      ) : null}
      <Text
        variant="caption"
        color={palette.fg}
        style={{
          fontSize: isSmall ? 9 : 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  return <Badge label={status.replace(/_/g, ' ')} tone={toneForStatus(status)} dot size={size} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
