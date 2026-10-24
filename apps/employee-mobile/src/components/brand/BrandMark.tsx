import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, fonts, spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8C95FF" />
          <Stop offset="0.55" stopColor="#5965F2" />
          <Stop offset="1" stopColor="#3A43B5" />
        </LinearGradient>
      </Defs>
      <Rect x="1" y="1" width="62" height="62" rx="19" fill="url(#brandGradient)" />
      <Path
        d="M18 20.5 29.5 44.5H34.5L46 20.5"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M39.5 20.5H46"
        stroke="rgba(255,255,255,0.48)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BrandLockup({
  compact = false,
  subtitle = 'Attendance',
  centered = false,
}: {
  compact?: boolean;
  subtitle?: string;
  centered?: boolean;
}) {
  return (
    <View style={[styles.lockup, centered && styles.centered]}>
      <BrandMark size={compact ? 32 : 42} />
      <View style={styles.copy}>
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: compact ? 20 : 25,
            lineHeight: compact ? 24 : 30,
            letterSpacing: -0.8,
            color: colors.text,
          }}>
          VorldX
        </Text>
        <Text variant="caption" color={colors.muted} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  centered: {
    justifyContent: 'center',
  },
  copy: {
    gap: 0,
  },
  subtitle: {
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 2.2,
    marginTop: -1,
  },
});
