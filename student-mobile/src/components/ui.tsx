import { Children, isValidElement, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme/colors';
import { narrowPage, READING_WIDTH, useLayout, widePage } from '../lib/responsive';

// Shared building blocks. The look follows the admin and instructor portals: a flat green bar at the top,
// white cards with a thin border, small rectangular tags and underline tabs.

// Header for screens pushed on top of the tabs: a back arrow with a small breadcrumb, then the title.
export function BackHeader({
  crumb,
  title,
  onBack,
  children,
}: {
  crumb: string;
  title: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.headerInner, widePage]}>
        <Pressable onPress={onBack} style={styles.backRow} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Svg width={18} height={18} viewBox="0 0 18 18">
            <Path d="M11 3l-6 6 6 6" stroke={colors.text} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.crumb} numberOfLines={1}>
            {crumb}
          </Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

// The flat green bar at the top of each tab screen.
// The bar is full width; its content lines up with the page column below it (`narrow` for the profile page).
export function AppHeader({ title, subtitle, right, narrow }: { title: string; subtitle?: string; right?: ReactNode; narrow?: boolean }) {
  return (
    <View style={styles.appHeader}>
      <View style={[styles.appHeaderInner, narrow ? narrowPage : widePage]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appHeaderTitle}>{title}</Text>
          {subtitle && (
            <Text style={styles.appHeaderSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

// A screen laid out as one centred column on large windows (lessons, quizzes, forms); the sides show the page background.
// On a phone the column is simply the whole screen.
export function Column({ children }: { children: ReactNode }) {
  const { width } = useLayout();
  const bordered = width > READING_WIDTH;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: READING_WIDTH,
          alignSelf: 'center',
          backgroundColor: colors.white,
          borderLeftWidth: bordered ? 1 : 0,
          borderRightWidth: bordered ? 1 : 0,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// Lays children out in as many equal columns as fit at `minItem` wide (one on a phone, two on a tablet or desktop).
export function Grid({ children, minItem = 340, gap = 12 }: { children: ReactNode; minItem?: number; gap?: number }) {
  const [width, setWidth] = useState(0);
  const cols = width > 0 ? Math.max(1, Math.floor((width + gap) / (minItem + gap))) : 1;
  const itemWidth = cols === 1 ? '100%' : (width - gap * (cols - 1)) / cols;
  return (
    <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Children.toArray(children).map((child, i) => (
        <View key={isValidElement(child) && child.key !== null ? child.key : i} style={{ width: itemWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}

// A small outlined button for the green header (e.g. "+ Join class").
export function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
      <Text style={styles.headerBtnLabel}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

// A labelled figure, like the web portals' stat cards.
export function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, tone === 'danger' && { color: colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type TagTone = 'success' | 'warning' | 'danger' | 'neutral';
const TAG_TONES: Record<TagTone, { bg: string; fg: string }> = {
  success: { bg: colors.primaryLight, fg: colors.primary },
  warning: { bg: colors.warningBg, fg: colors.warningText },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  neutral: { bg: colors.borderLight, fg: colors.textMuted },
};

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: TagTone }) {
  return (
    <View style={[styles.tag, { backgroundColor: TAG_TONES[tone].bg }]}>
      <Text style={[styles.tagLabel, { color: TAG_TONES[tone].fg }]}>{label}</Text>
    </View>
  );
}

// Underline tabs (like the class page tabs in the instructor portal).
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: readonly { key: T; label: string }[]; onChange: (key: T) => void }) {
  return (
    <View style={styles.tabsBar}>
      <View style={[styles.tabs, widePage]} accessibilityRole="tablist">
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProgressBar({ pct, height = 6 }: { pct: number; height?: number }) {
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primaryBtn, disabled && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  crumb: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  title: { fontFamily: fonts.bodyBold, fontSize: 21, color: colors.text },
  appHeader: { backgroundColor: colors.primary },
  appHeaderInner: { minHeight: 60, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  appHeaderTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: '#fff' },
  appHeaderSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  headerBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  headerBtnLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#fff' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  statTile: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  statValue: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.text },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tag: { borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'flex-start' },
  tagLabel: { fontFamily: fonts.bodyBold, fontSize: 10 },
  tabsBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs: { flexDirection: 'row', paddingHorizontal: 12 },
  tab: { paddingVertical: 12, paddingHorizontal: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.textMuted },
  tabLabelActive: { color: colors.primary },
  track: { flex: 1, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18 },
  retryLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  primaryLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: '#fff' },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 100, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.white },
  secondaryLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
});
