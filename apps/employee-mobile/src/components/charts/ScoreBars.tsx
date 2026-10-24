import { StyleSheet, View } from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';
import { ProgressBar } from '@/components/ui/Progress';
import { Text } from '@/components/ui/Text';

export interface ScoreItem {
  label: string;
  score: number;
}

export function ScoreBars({ items }: { items: ScoreItem[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => {
        const ratio = Math.min(1, Math.max(0, item.score / 5));
        return (
          <View key={item.label} style={styles.row}>
            <View style={styles.copy}>
              <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
                {item.label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 13,
                  color: colors.text,
                }}>
                {item.score.toFixed(1)}
              </Text>
            </View>
            <ProgressBar
              value={ratio}
              tone={ratio >= 0.8 ? colors.success : ratio >= 0.6 ? colors.indigoSoft : colors.warning}
              height={6}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    gap: 7,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
