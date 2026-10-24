import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/constants/theme';
import type { OrbProps } from './types';

export function Orb({
  size = 280,
  animated = true,
  style,
  intensity = 'normal',
  variant = 'hero',
}: OrbProps) {
  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    spin.value = withRepeat(withTiming(1, { duration: 40_000, easing: Easing.linear }), -1, false);
  }, [animated, pulse, spin]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + pulse.value * 0.06 }],
    opacity: 0.7 + pulse.value * 0.3,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const scale = size / 280;
  const alpha = intensity === 'soft' ? 0.7 : 1;

  return (
    <View pointerEvents="none" style={[styles.wrapper, { width: size, height: size }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, pulseStyle]}>
        <LinearGradient
          colors={['rgba(8,16,36,0.35)', 'rgba(14,165,233,0.7)', 'rgba(34,197,94,0.6)', 'rgba(8,16,36,0.3)']}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.85, y: 0.9 }}
          style={{
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
            opacity: alpha,
          }}
        />
        <View
          style={[
            styles.inner,
            {
              width: size * 0.42,
              height: size * 0.42,
              borderRadius: size * 0.21,
              opacity: alpha * 0.8,
            },
          ]}
        />
      </Animated.View>
      <Animated.View style={[styles.ring, { width: size * 0.88, height: size * 0.88, borderRadius: size * 0.44 }, ringStyle]} />
      <View
        style={[
          styles.outerRing,
          {
            width: size * 0.98,
            height: size * 0.98,
            borderRadius: size * 0.49,
            borderColor: `rgba(140,149,255,${0.18 * alpha})`,
          },
        ]}
      />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: size / 2 + Math.cos(angle) * size * 0.42 - 1.5,
              top: size / 2 + Math.sin(angle) * size * 0.42 - 1.5,
              width: index % 2 === 0 ? 3 : 2,
              height: index % 2 === 0 ? 3 : 2,
              borderRadius: 2,
              backgroundColor: colors.indigoSoft,
              opacity: 0.65 * alpha,
            }}
          />
        );
      })}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size * 0.3,
          backgroundColor: 'rgba(89,101,242,0.1)',
          transform: [{ scale: 1.35 * scale }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    backgroundColor: 'rgba(244,245,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(140,149,255,0.26)',
    borderTopColor: 'rgba(255,255,255,0.58)',
    borderLeftColor: 'rgba(69,214,166,0.32)',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 1,
  },
});
