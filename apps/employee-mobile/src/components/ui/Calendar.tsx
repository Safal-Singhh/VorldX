import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns';

import { colors, fonts, radii, spacing, tones, type Tone } from '@/constants/theme';
import { calendarDays, formatMonth, nextMonth, previousMonth } from '@/lib/dates';
import { useResponsive } from '@/lib/responsive';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface CalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  marks?: Record<string, Tone>;
  markedDates?: Record<string, { tone: Tone; label?: string }>;
  minDate?: string;
  maxDate?: string;
  showOutsideDays?: boolean;
}

export function Calendar({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  marks,
  markedDates,
  minDate,
  maxDate,
  showOutsideDays = true,
}: CalendarProps) {
  const { isWide } = useResponsive();
  const days = calendarDays(month);
  const circleSize = isWide ? 42 : 36;
  const min = minDate ? parseISO(minDate) : null;
  const max = maxDate ? parseISO(maxDate) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          haptic="selection"
          onPress={() => onMonthChange(previousMonth(month))}
          style={styles.navButton}>
          <ChevronLeft size={19} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>
        <Text variant="subheading" style={styles.monthLabel}>
          {formatMonth(month)}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Next month"
          haptic="selection"
          onPress={() => onMonthChange(nextMonth(month))}
          style={styles.navButton}>
          <ChevronRight size={19} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday) => (
          <View key={weekday} style={styles.weekCell}>
            <Text variant="caption" color={colors.muted} style={styles.weekday}>
              {weekday}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, month);
          const outsideDisabled = !showOutsideDays && !inMonth;
          const beforeMin = min ? isBefore(day, min) && !isSameDay(day, min) : false;
          const afterMax = max ? isAfter(day, max) && !isSameDay(day, max) : false;
          const disabled = outsideDisabled || beforeMin || afterMax;
          const selected = selectedDate === key;
          const today = isSameDay(day, new Date());
          const mark = markedDates?.[key]?.tone ?? marks?.[key];

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${format(day, 'EEEE, dd MMMM yyyy')}${
                mark ? `, ${markedDates?.[key]?.label ?? mark}` : ''
              }`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelectDate?.(key)}
              style={styles.dayCell}>
              <View
                style={[
                  styles.dayCircle,
                  {
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                  },
                  selected ? styles.daySelected : null,
                  today && !selected ? styles.dayToday : null,
                ]}>
                <Text
                  style={{
                    fontFamily: selected ? fonts.semibold : fonts.medium,
                    fontSize: 13,
                    lineHeight: 17,
                    color: selected
                      ? colors.white
                      : !inMonth
                        ? 'rgba(126, 132, 158, 0.42)'
                        : disabled
                          ? colors.muted
                          : today
                            ? colors.indigoSoft
                            : colors.text,
                  }}>
                  {format(day, 'd')}
                </Text>
                {mark ? (
                  <View
                    style={[
                      styles.mark,
                      {
                        backgroundColor: selected ? 'rgba(255,255,255,0.88)' : tones[mark].fg,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  monthLabel: {
    letterSpacing: -0.2,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(145, 148, 186, 0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  weekCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  weekday: {
    fontSize: 8.5,
    letterSpacing: 0.7,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  daySelected: {
    backgroundColor: colors.indigo,
    borderColor: 'rgba(156, 163, 255, 0.55)',
  },
  dayToday: {
    borderColor: 'rgba(140, 149, 255, 0.55)',
    backgroundColor: 'rgba(89, 101, 242, 0.07)',
  },
  mark: {
    position: 'absolute',
    bottom: 4,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
});
