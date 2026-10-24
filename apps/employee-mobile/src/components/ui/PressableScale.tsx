import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean | 'selection';
}

export function PressableScale({
  style,
  scaleTo = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design.
      scale.value = withSpring(disabled ? 1 : scaleTo, { damping: 18, stiffness: 300 });
      if (haptic) {
        const promise =
          haptic === 'selection'
            ? Haptics.selectionAsync()
            : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void promise.catch(() => undefined);
      }
      onPressIn?.(event);
    },
    [disabled, haptic, onPressIn, scaleTo, scale],
  );

  const handlePressOut = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design.
      scale.value = withSpring(1, { damping: 18, stiffness: 260 });
      onPressOut?.(event);
    },
    [onPressOut, scale],
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle, disabled ? { opacity: 0.48 } : null]}>
      {children}
    </AnimatedPressable>
  );
}
