import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            haptic="selection"
            onPress={() => onChange(option.value)}
            style={[styles.segment, active ? styles.segmentActive : null]}>
            <Text
              variant="bodyMedium"
              color={active ? colors.text : colors.muted}
              style={styles.label}>
              {option.label}
            </Text>
            {option.count != null && option.count > 0 ? (
              <View style={[styles.count, active ? styles.countActive : null]}>
                <Text
                  variant="caption"
                  color={active ? colors.white : colors.muted}
                  style={styles.countText}>
                  {option.count}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.md,
    backgroundColor: 'rgba(12, 15, 27, 0.65)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: 'rgba(89, 101, 242, 0.16)',
    borderColor: 'rgba(89, 101, 242, 0.28)',
  },
  label: {
    fontSize: 14,
  },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(145, 148, 186, 0.14)',
  },
  countActive: {
    backgroundColor: colors.indigo,
  },
  countText: {
    fontSize: 9,
    letterSpacing: 0,
  },
});
