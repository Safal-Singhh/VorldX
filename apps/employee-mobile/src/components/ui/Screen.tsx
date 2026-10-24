import { LinearGradient } from 'expo-linear-gradient';
import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { colors, gradients, layout, spacing } from '@/constants/theme';
import { useResponsive } from '@/lib/responsive';

export function AppBackground({ subtle = false }: { subtle?: boolean }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.background]}>
      <LinearGradient
        colors={gradients.screen}
        locations={[0, 0.52, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.glow,
          {
            top: -180,
            right: -150,
            backgroundColor: subtle ? 'rgba(89,101,242,0.10)' : 'rgba(89,101,242,0.17)',
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            top: 320,
            left: -210,
            backgroundColor: subtle ? 'rgba(118,184,255,0.03)' : 'rgba(118,184,255,0.055)',
          },
        ]}
      />
      <View style={styles.grain} />
    </View>
  );
}

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  bottomInset?: boolean;
  maxWidth?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshControl,
  contentContainerStyle,
  style,
  edges = ['top', 'left', 'right'],
  bottomInset = false,
  maxWidth = layout.maxWidth,
  keyboardShouldPersistTaps = 'handled',
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const horizontalPadding = padded ? gutter : 0;

  const inner = (
    <View
      style={[
        styles.inner,
        { maxWidth, paddingHorizontal: horizontalPadding },
        !scroll ? styles.innerFlex : null,
        contentContainerStyle,
      ]}>
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View style={[styles.root, style]}>
        <AppBackground />
        <SafeAreaView edges={edges} style={styles.root}>
          {inner}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <AppBackground />
      <SafeAreaView edges={edges} style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: (bottomInset ? insets.bottom : 0) + spacing.xxxl },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}>
          {inner}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  background: {
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 430,
    height: 430,
    borderRadius: 215,
  },
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 8, 14, 0.08)',
  },
  scrollContent: {
    paddingTop: spacing.sm,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
  },
  innerFlex: {
    flex: 1,
  },
});
