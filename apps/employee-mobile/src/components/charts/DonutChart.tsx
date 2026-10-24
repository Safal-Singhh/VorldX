import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, fonts } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  size = 132,
  stroke = 13,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.value, 0),
  );
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcs = (() => {
    const items: { segment: DonutSegment; length: number; offset: number }[] = [];
    let running = 0;
    for (const segment of segments) {
      const fraction = segment.value / total;
      items.push({
        segment,
        length: Math.max(0, fraction * circumference - 3),
        offset: running * circumference,
      });
      running += fraction;
    }
    return items;
  })();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="donutShine" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(145, 148, 186, 0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        {arcs.map(({ segment, length, offset }) => {
          if (length <= 0) return null;
          return (
            <Circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              fill="none"
              rotation={-90}
              originX={size / 2}
              originY={size / 2}
            />
          );
        })}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - stroke / 2 - 0.5}
          stroke="url(#donutShine)"
          strokeWidth={1}
          fill="none"
        />
      </Svg>
      <View style={styles.center}>
        {centerValue ? (
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: size * 0.24,
              lineHeight: size * 0.28,
              letterSpacing: -1,
            }}>
            {centerValue}
          </Text>
        ) : null}
        {centerLabel ? (
          <Text variant="caption" color={colors.muted} style={styles.centerLabel}>
            {centerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.value, 0),
  );
  return (
    <View style={styles.legend}>
      {segments.map((segment) => (
        <View key={segment.label} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: segment.color }]} />
          <Text variant="small" color={colors.textSecondary} style={styles.legendLabel}>
            {segment.label}
          </Text>
          <Text variant="small" color={colors.text} weight="semibold">
            {segment.value}
          </Text>
          <Text variant="small" color={colors.muted} style={styles.percent}>
            {Math.round((segment.value / total) * 100)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 8,
    letterSpacing: 0.9,
    marginTop: 2,
  },
  legend: {
    flex: 1,
    gap: 9,
    minWidth: 120,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
  },
  percent: {
    width: 32,
    textAlign: 'right',
  },
});
