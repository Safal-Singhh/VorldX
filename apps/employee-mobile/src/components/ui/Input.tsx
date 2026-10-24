import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radii, spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Field({ label, hint, error, required, children, style }: FieldProps) {
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="small" color={colors.textSecondary} weight="medium">
            {label}
            {required ? <Text color={colors.danger}> *</Text> : null}
          </Text>
        </View>
      ) : null}
      {children}
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.muted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface InputProps extends Omit<TextInputProps, 'style'> {
  leftIcon?: LucideIcon;
  right?: ReactNode;
  secure?: boolean;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
}

export function Input({
  leftIcon: LeftIcon,
  right,
  secure = false,
  error = false,
  containerStyle,
  inputStyle,
  multiline,
  onFocus,
  onBlur,
  editable = true,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View
      style={[
        styles.inputShell,
        multiline ? styles.multilineShell : null,
        focused ? styles.focused : null,
        error ? styles.errored : null,
        !editable ? styles.disabled : null,
        containerStyle,
      ]}>
      {LeftIcon ? (
        <LeftIcon
          size={18}
          color={focused ? colors.indigoSoft : colors.muted}
          strokeWidth={1.8}
        />
      ) : null}
      <TextInput
        {...props}
        editable={editable}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.muted}
        secureTextEntry={secure && !revealed}
        selectionColor={colors.indigoSoft}
        style={[
          styles.input,
          multiline ? styles.multilineInput : null,
          inputStyle,
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {secure ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          haptic={false}
          onPress={() => setRevealed((value) => !value)}
          style={styles.sideButton}>
          {revealed ? (
            <EyeOff size={18} color={colors.muted} strokeWidth={1.8} />
          ) : (
            <Eye size={18} color={colors.muted} strokeWidth={1.8} />
          )}
        </PressableScale>
      ) : (
        right
      )}
    </View>
  );
}

export function PasswordInput(props: Omit<InputProps, 'secure'>) {
  return <Input {...props} secure />;
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputShell: {
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
  multilineShell: {
    minHeight: 112,
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  focused: {
    borderColor: colors.borderActive,
    backgroundColor: 'rgba(15, 18, 32, 0.94)',
  },
  errored: {
    borderColor: 'rgba(255, 107, 131, 0.45)',
  },
  disabled: {
    opacity: 0.55,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 0,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 86,
    paddingTop: 0,
    lineHeight: 22,
  },
  sideButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
});
