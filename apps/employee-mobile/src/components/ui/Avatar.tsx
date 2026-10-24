import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, gradients } from '@/constants/theme';
import { initials } from '@/lib/format';
import { Text } from './Text';

export function Avatar({
  name,
  size = 44,
  showRing = false,
}: {
  name: string;
  size?: number;
  showRing?: boolean;
}) {
  const borderRadius = size / 2;
  return (
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius,
          padding: showRing ? 2 : 0,
        },
      ]}>
      <View
        style={[
          styles.inner,
          {
            borderRadius,
            backgroundColor: showRing ? colors.bgRaised : 'transparent',
            borderWidth: showRing ? 2 : 0,
            borderColor: 'rgba(7, 8, 14, 0.75)',
          },
        ]}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: size * 0.34,
            lineHeight: size * 0.42,
            letterSpacing: 0.2,
          }}>
          {initials(name)}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
