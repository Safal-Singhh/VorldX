import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, fonts } from '@/constants/theme';
import { Text } from './Text';

export function ProgressBar({
  value,
  tone = colors.indigo,
  track = 'rgba(145, 148, 186, 0.14)',
  height = 7,
  style,
}: {
  value: number;
  tone?: string;
  track?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value)), { duration: 650 });
  }, [progress, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { height, borderRadius: height / 2, backgroundColor: tone },
          animatedStyle,
        ]}
      />
    </View>
  );
}

export function ProgressRing({
  progress,
  size = 92,
  stroke = 8,
  label,
  sublabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.ringSvg}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.indigo} />
            <Stop offset="1" stopColor={colors.indigoSoft} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(145, 148, 186, 0.14)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          originX={size / 2}
          originY={size / 2}
          rotation={-90}
        />
      </Svg>
      <View style={styles.ringCenter}>
        {label ? (
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: size * 0.22,
              lineHeight: size * 0.26,
              letterSpacing: -0.5,
            }}>
            {label}
          </Text>
        ) : null}
        {sublabel ? (
          <Text variant="caption" color={colors.muted} style={styles.sublabel}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  ringSvg: {
    transform: [{ rotate: '0deg' }],
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sublabel: {
    marginTop: 1,
    fontSize: 8.5,
  },
});
