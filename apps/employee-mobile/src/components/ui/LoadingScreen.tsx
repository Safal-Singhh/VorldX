import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { AppBackground } from './Screen';
import { BrandMark } from '@/components/brand/BrandMark';
import { Text } from './Text';

export function LoadingScreen({ label = 'Opening VorldX' }: { label?: string }) {
  return (
    <View style={styles.root}>
      <AppBackground />
      <View style={styles.content}>
        <BrandMark size={60} />
        <Text variant="subheading" color={colors.textSecondary} style={styles.label}>
          {label}
        </Text>
        <ActivityIndicator color={colors.indigoSoft} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    marginTop: spacing.sm,
  },
});
