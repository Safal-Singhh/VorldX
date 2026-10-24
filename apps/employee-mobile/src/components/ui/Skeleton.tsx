import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '@/constants/theme';

export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.stack}>
      <SkeletonBlock width="42%" height={12} />
      <SkeletonBlock width="72%" height={34} />
      <SkeletonBlock height={178} radius={radii.lg} style={styles.gap} />
      <View style={styles.row}>
        <SkeletonBlock height={96} radius={radii.md} style={styles.flex} />
        <SkeletonBlock height={96} radius={radii.md} style={styles.flex} />
      </View>
      <View style={styles.row}>
        <SkeletonBlock height={96} radius={radii.md} style={styles.flex} />
        <SkeletonBlock height={96} radius={radii.md} style={styles.flex} />
      </View>
      <SkeletonBlock height={190} radius={radii.lg} style={styles.gap} />
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={index} height={74} radius={radii.md} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(145, 148, 186, 0.14)',
  },
  stack: {
    gap: 10,
  },
  gap: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flex: {
    flex: 1,
  },
});
