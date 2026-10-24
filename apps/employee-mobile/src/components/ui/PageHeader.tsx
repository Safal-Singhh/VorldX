import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  compact?: boolean;
}

export function PageHeader({ eyebrow, title, subtitle, right, compact = false }: PageHeaderProps) {
  return (
    <View style={[styles.header, compact && styles.compact]}>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text variant="caption" color={colors.indigoSoft} style={styles.eyebrow}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant={compact ? 'title' : 'display'} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color={colors.textSecondary} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

export interface SectionHeaderProps {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
}

export function SectionHeader({ title, caption, actionLabel, onAction, right }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text variant="heading" style={styles.sectionTitle}>
          {title}
        </Text>
        {caption ? (
          <Text variant="small" color={colors.muted} style={styles.sectionCaption}>
            {caption}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PressableScale haptic="selection" onPress={onAction} style={styles.action}>
          <Text variant="small" color={colors.indigoSoft} weight="semibold">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : (
        right
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  compact: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    marginBottom: 2,
  },
  subtitle: {
    marginTop: 3,
    maxWidth: 560,
  },
  right: {
    paddingTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    letterSpacing: -0.3,
  },
  sectionCaption: {
    marginTop: 1,
  },
  action: {
    paddingVertical: 4,
    paddingLeft: spacing.sm,
  },
});
