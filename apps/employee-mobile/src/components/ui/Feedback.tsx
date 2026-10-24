import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing, tones, type Tone } from '@/constants/theme';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Notice({
  title,
  message,
  tone = 'info',
  icon,
  actionLabel,
  onAction,
}: {
  title?: string;
  message: string;
  tone?: Tone;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const palette = tones[tone];
  const Fallback =
    tone === 'danger' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}>
      <View style={styles.noticeRow}>
        {icon ?? <Fallback size={17} color={palette.fg} strokeWidth={1.9} />}
        <View style={styles.noticeCopy}>
          {title ? (
            <Text variant="bodyMedium" color={palette.fg}>
              {title}
            </Text>
          ) : null}
          <Text variant="small" color={title ? colors.textSecondary : palette.fg}>
            {message}
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          accessibilityRole="button"
          onPress={onAction}
          style={styles.noticeAction}>
          <Text variant="small" color={palette.fg} weight="semibold">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text variant="subheading" align="center">
        {title}
      </Text>
      <Text variant="small" color={colors.muted} align="center" style={styles.emptyMessage}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="sm"
          variant="soft"
          fullWidth={false}
          style={styles.emptyButton}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Could not load this screen',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.error}>
      <View style={styles.errorIcon}>
        <AlertCircle size={24} color={colors.danger} strokeWidth={1.8} />
      </View>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      <Text variant="small" color={colors.muted} align="center" style={styles.emptyMessage}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          onPress={onRetry}
          size="sm"
          variant="secondary"
          fullWidth={false}
          icon={<RefreshCw size={14} color={colors.text} strokeWidth={2} />}
          style={styles.emptyButton}
        />
      ) : null}
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.inlineError}>
      <AlertCircle size={14} color={colors.danger} strokeWidth={2} />
      <Text variant="small" color={colors.danger} style={styles.inlineErrorText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeAction: {
    alignSelf: 'flex-start',
    paddingLeft: 25,
    paddingVertical: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.2)',
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    maxWidth: 360,
  },
  emptyButton: {
    marginTop: spacing.sm,
  },
  error: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 131, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 131, 0.22)',
    marginBottom: spacing.xs,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  inlineErrorText: {
    flex: 1,
  },
});
