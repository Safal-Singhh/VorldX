import { useId, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { colors, fonts } from '@/constants/theme';
import { Text as AppText } from '@/components/ui/Text';

export interface LinePoint {
  label: string;
  value: number;
  absent?: boolean;
}

export function LineChart({
  data,
  height = 160,
  color = colors.indigoSoft,
  suffix = 'h',
  style,
}: {
  data: LinePoint[];
  height?: number;
  color?: string;
  suffix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const gradientId = `line-fill-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const padding = { top: 14, right: 8, bottom: 22, left: 8 };
  const chartWidth = Math.max(0, width - padding.left - padding.right);
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((point) => point.value));
  const roundedMax = Math.ceil(max / 2) * 2;

  const points = data.map((point, index) => ({
    x: padding.left + (data.length <= 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth),
    y: padding.top + chartHeight - (point.value / roundedMax) * chartHeight,
    value: point.value,
    label: point.label,
    absent: point.absent ?? false,
  }));

  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${
        points[0].x
      } ${padding.top + chartHeight} Z`
    : '';

  const gridLines = [0, 0.5, 1];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Chart: ${data
        .map((point) => `${point.label} ${point.value}${suffix}${point.absent ? ' absent' : ''}`)
        .join(', ')}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ height, width: '100%' }, style]}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.25} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {gridLines.map((fraction) => {
            const y = padding.top + chartHeight * fraction;
            return (
              <Line
                key={fraction}
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="rgba(145, 148, 186, 0.1)"
                strokeWidth={1}
                strokeDasharray="3 6"
              />
            );
          })}

          {points.length > 1 ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          {points.length > 1 ? (
            <Path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {points.map((point, index) => (
            <Circle
              key={`${point.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r={point.absent ? 3.7 : index === points.length - 1 ? 3.7 : 2.4}
              fill={
                point.absent
                  ? colors.danger
                  : index === points.length - 1
                    ? colors.text
                    : color
              }
              stroke={colors.bgRaised}
              strokeWidth={1.4}
            />
          ))}

          {points.map((point, index) => (
            <SvgText
              key={`label-${point.label}-${index}`}
              x={point.x}
              y={height - 4}
              fill={
                point.absent
                  ? colors.danger
                  : index === points.length - 1
                    ? colors.textSecondary
                    : colors.muted
              }
              fontFamily={fonts.medium}
              fontSize={9}
              textAnchor="middle">
              {point.label}
            </SvgText>
          ))}

          {points.length ? (
            <SvgText
              x={points[points.length - 1].x}
              y={Math.max(10, points[points.length - 1].y - 10)}
              fill={colors.textSecondary}
              fontFamily={fonts.semibold}
              fontSize={9}
              textAnchor="middle">
              {`${points[points.length - 1].value}${suffix}`}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;

    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (after.x - current.x) / 6;
    const control2Y = next.y - (after.y - current.y) / 6;

    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function ChartLegend({
  items,
  style,
}: {
  items: { label: string; value: string; color: string }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.legend, style]}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <View style={styles.legendCopy}>
            <AppText variant="small" color={colors.textSecondary} style={styles.legendLabel}>
              {item.label}
            </AppText>
            <AppText variant="small" color={colors.text} weight="semibold">
              {item.value}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    gap: 9,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendLabel: {
    flex: 1,
  },
});
