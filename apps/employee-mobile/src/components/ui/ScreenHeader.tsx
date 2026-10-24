import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function ScreenHeader({ title, subtitle, right, onBack, backLabel = 'Back' }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
  };

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        haptic="selection"
        onPress={goBack}
        style={styles.back}>
        <ArrowLeft size={19} color={colors.text} strokeWidth={1.9} />
      </PressableScale>
      <View style={styles.copy}>
        <Text variant="subheading" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color={colors.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 28, 46, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
});
