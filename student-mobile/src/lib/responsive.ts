import { useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';

// Phone < 600, tablet 600-1023, desktop >= 1024 (the width of the window, so it also follows a resized browser).
export const TABLET_MIN = 600;
export const DESKTOP_MIN = 1024;

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, isTablet: width >= TABLET_MIN, isDesktop: width >= DESKTOP_MIN };
}

// Content columns: dashboards and lists use the wide one, forms and profile the narrow one.
// They are centred on large screens and are the full width on a phone.
export const widePage: ViewStyle = { width: '100%', maxWidth: 1040, alignSelf: 'center' };
export const narrowPage: ViewStyle = { width: '100%', maxWidth: 720, alignSelf: 'center' };
export const READING_WIDTH = 760;
