import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, gradients, radii, shadows, spacing, type Tone, tones } from '@/constants/theme';
import { PressableScale } from './PressableScale';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  variant?: 'glass' | 'raised' | 'soft' | 'tint';
  tone?: Tone;
  onPress?: () => void;
  highlight?: boolean;
  accessibilityLabel?: string;
}

export function Card({
  children,
  style,
  padding = spacing.lg,
  variant = 'glass',
  tone,
  onPress,
  highlight = true,
  accessibilityLabel,
}: CardProps) {
  const toneStyle = tone ? tones[tone] : null;
  const content = (
    <>
      {highlight ? <View pointerEvents="none" style={styles.highlight} /> : null}
      {variant === 'glass' ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradients.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {toneStyle ? (
        <LinearGradient
          pointerEvents="none"
          colors={[
            toneStyle.bg,
            variant === 'tint' ? 'rgba(7, 8, 14, 0.15)' : 'rgba(7, 8, 14, 0.02)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </>
  );

  const cardStyle = [
    styles.card,
    padding ? { padding } : null,
    variant === 'raised' ? styles.raised : null,
    variant === 'soft' ? styles.soft : null,
    variant === 'tint' ? styles.tint : null,
    toneStyle ? { borderColor: toneStyle.border } : null,
    style,
  ];

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        haptic="selection"
        onPress={onPress}
        style={cardStyle}>
        {content}
      </PressableScale>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  raised: {
    backgroundColor: colors.surfaceStrong,
    borderColor: 'rgba(184, 190, 255, 0.18)',
  },
  soft: {
    backgroundColor: colors.surfaceSoft,
    borderColor: 'rgba(184, 190, 255, 0.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  tint: {
    backgroundColor: colors.bgRaised,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
  },
});
