import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic))
      }
      style={style}>
      {children}
    </Animated.View>
  );
}
