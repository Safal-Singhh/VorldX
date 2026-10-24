import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, gradients, radii, spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

type IconProp = ReactNode;

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconProp;
  rightIcon?: IconProp;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
}

const sizes: Record<ButtonSize, { height: number; padding: number; font: number; gap: number }> = {
  sm: { height: 38, padding: 13, font: 13, gap: 7 },
  md: { height: 48, padding: 17, font: 14, gap: 8 },
  lg: { height: 54, padding: 20, font: 15, gap: 9 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  haptic = true,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const spec = sizes[size];
  const foreground =
    variant === 'primary'
      ? colors.white
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? colors.textSecondary
          : colors.text;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        icon
      )}
      <Text
        variant="bodyMedium"
        color={foreground}
        numberOfLines={1}
        style={{ fontSize: spec.font, fontFamily: fonts.semibold, letterSpacing: 0.1 }}>
        {label}
      </Text>
      {!loading && rightIcon ? rightIcon : null}
    </View>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic={haptic ? 'selection' : false}
      onPress={onPress}
      style={[
        styles.base,
        {
          height: spec.height,
          paddingHorizontal: spec.padding,
          borderRadius: radiusFor(size),
          gap: spec.gap,
        },
        fullWidth ? styles.fullWidth : null,
        variant === 'primary' ? styles.primary : null,
        variant === 'secondary' ? styles.secondary : null,
        variant === 'ghost' ? styles.ghost : null,
        variant === 'danger' ? styles.danger : null,
        variant === 'soft' ? styles.soft : null,
        style,
      ]}>
      {variant === 'primary' ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

function radiusFor(size: ButtonSize) {
  return size === 'sm' ? radii.sm : size === 'lg' ? radii.md : radii.md;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: { width: '100%' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: {
    borderColor: 'rgba(156, 163, 255, 0.28)',
  },
  secondary: {
    backgroundColor: 'rgba(28, 32, 52, 0.72)',
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: 'rgba(255, 107, 131, 0.08)',
    borderColor: 'rgba(255, 107, 131, 0.28)',
  },
  soft: {
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
    borderColor: 'rgba(89, 101, 242, 0.28)',
  },
});
