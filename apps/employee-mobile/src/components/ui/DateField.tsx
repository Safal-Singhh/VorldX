import { CalendarDays, ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO, startOfMonth } from 'date-fns';

import { colors, radii, spacing } from '@/constants/theme';
import { formatDateLabel } from '@/lib/dates';
import { Button } from './Button';
import { Calendar } from './Calendar';
import { Field } from './Input';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface DateFieldProps {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}

export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Choose a date',
  hint,
  error,
  required,
  disabled,
}: DateFieldProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [sheet, setSheet] = useState<{ draft: string; month: Date } | null>(null);

  const openSheet = () => {
    const initial = value ?? minDate ?? format(new Date(), 'yyyy-MM-dd');
    setSheet({ draft: initial, month: startOfMonth(parseISO(initial)) });
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAvailable = useMemo(() => {
    if (minDate && today < minDate) return false;
    if (maxDate && today > maxDate) return false;
    return true;
  }, [today, minDate, maxDate]);

  const confirm = () => {
    if (!sheet) return;
    onChange(sheet.draft);
    setSheet(null);
  };

  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value ?? placeholder}` : placeholder}
        disabled={disabled}
        haptic="selection"
        onPress={openSheet}
        style={styles.trigger}>
        <CalendarDays size={18} color={colors.muted} strokeWidth={1.8} />
        <Text
          variant="bodyMedium"
          color={value ? colors.text : colors.muted}
          style={styles.triggerText}>
          {value ? formatDateLabel(value) : placeholder}
        </Text>
        <ChevronDown size={17} color={colors.muted} strokeWidth={1.9} />
      </PressableScale>

      <Modal
        animationType="fade"
        onRequestClose={() => setSheet(null)}
        presentationStyle="overFullScreen"
        transparent
        visible={sheet !== null}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} />
          <View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                maxHeight: height * 0.9,
              },
            ]}>
            <View style={styles.handle} />
            <Text variant="heading" style={styles.sheetTitle}>
              {label ?? 'Select a date'}
            </Text>
            <Calendar
              markedDates={
                todayAvailable ? { [today]: { tone: 'indigo', label: 'today' } } : undefined
              }
              maxDate={maxDate}
              minDate={minDate}
              month={sheet?.month ?? startOfMonth(new Date())}
              onMonthChange={(next) => setSheet((current) => (current ? { ...current, month: next } : current))}
              onSelectDate={(next) => setSheet((current) => (current ? { ...current, draft: next } : current))}
              selectedDate={sheet?.draft ?? null}
            />
            <View style={styles.actions}>
              <Button
                label="Cancel"
                onPress={() => setSheet(null)}
                size="sm"
                variant="secondary"
                fullWidth={false}
                style={styles.cancel}
              />
              <Button
                disabled={!sheet?.draft}
                label="Use date"
                onPress={confirm}
                size="sm"
                style={styles.confirm}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Field>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(12, 15, 27, 0.78)',
  },
  triggerText: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 4, 9, 0.72)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.bgRaised,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(145, 148, 186, 0.3)',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancel: {
    flex: 0.8,
  },
  confirm: {
    flex: 1.2,
  },
});
