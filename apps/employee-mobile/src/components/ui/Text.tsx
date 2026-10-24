import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyMedium'
  | 'small'
  | 'caption'
  | 'mono'
  | 'monoSmall'
  | 'number'
  | 'numberSmall';

type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'mono' | 'monoBold';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
}

const variantStyles: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fonts.mono, fontSize: 13.5, lineHeight: 19 },
  monoSmall: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16 },
  number: { fontFamily: fonts.bold, fontSize: 27, lineHeight: 31, letterSpacing: -0.8 },
  numberSmall: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
};

export function Text({
  variant = 'body',
  color = colors.text,
  weight,
  align,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        variantStyles[variant],
        weight ? { fontFamily: fonts[weight] } : null,
        { color },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export const textStyles = StyleSheet.create({
  link: { color: colors.indigoSoft, fontFamily: fonts.semibold },
  tabular: { fontVariant: ['tabular-nums'] },
});
