import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, radii, spacing, tones, type Tone } from '@/constants/theme';
import { Text } from './Text';

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'indigo',
  style,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = tones[tone];
  return (
    <View style={[styles.tile, { borderColor: palette.border }, style]}>
      <View style={styles.top}>
        <Text variant="caption" color={colors.muted} numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        {Icon ? (
          <View style={[styles.icon, { backgroundColor: palette.bg }]}>
            <Icon size={13} color={palette.fg} strokeWidth={1.9} />
          </View>
        ) : null}
      </View>
      <Text variant="numberSmall" numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      {hint ? (
        <Text variant="small" color={colors.muted} numberOfLines={1} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 116,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 21, 36, 0.66)',
    gap: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: {
    flex: 1,
    letterSpacing: 0.9,
    fontSize: 9.5,
  },
  icon: {
    width: 23,
    height: 23,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    marginTop: 3,
  },
  hint: {
    marginTop: 0,
    fontSize: 11.5,
    lineHeight: 16,
  },
});
