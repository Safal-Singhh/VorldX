import { useWindowDimensions } from 'react-native';
import { layout } from '@/constants/theme';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  const gutter = isWide ? 32 : layout.phoneGutter;
  const contentWidth = Math.min(width - gutter * 2, layout.maxWidth);

  return {
    width,
    height,
    isWide,
    isTablet,
    isLandscape,
    columns,
    gutter,
    contentWidth,
  };
}
