import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { colors, fonts } from '../theme/colors';
import { useLayout } from '../lib/responsive';
import { useAuth } from '../state/AuthContext';

// The sidebar sits outside the navigator so it stays on screen while a class, lesson or quiz is open,
// like the sidebar in the admin and instructor portals. It drives the navigator through this ref.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const listeners = new Set<() => void>();
export function emitNavigationChange() {
  listeners.forEach((l) => l());
}

type NavKey = 'classes' | 'progress' | 'scan' | 'profile';

const NAV_ITEMS: { key: NavKey; label: string }[] = [
  { key: 'classes', label: 'My Classes' },
  { key: 'progress', label: 'Progress' },
  { key: 'scan', label: 'Scan AR card' },
  { key: 'profile', label: 'Profile' },
];

// Screens opened from a section keep that section highlighted.
const SECTION_OF: Record<string, NavKey> = {
  ClassList: 'classes',
  JoinClass: 'classes',
  ModuleChapter: 'classes',
  Lesson: 'classes',
  Quiz: 'classes',
  Assessment: 'classes',
  Progress: 'progress',
  ArViewer: 'scan',
  Profile: 'profile',
  ChangePassword: 'profile',
};

function go(key: NavKey) {
  if (!navigationRef.isReady()) return;
  if (key === 'scan') navigationRef.navigate('ArViewer');
  else navigationRef.navigate('Main', { screen: key === 'classes' ? 'ClassList' : key === 'progress' ? 'Progress' : 'Profile' });
}

function Sidebar() {
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState<string | undefined>();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const update = () => setCurrent(navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const active = current ? SECTION_OF[current] : undefined;

  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>CogniView AR</Text>
      <Text style={styles.role}>Student</Text>
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => go(item.key)}
            accessibilityRole="link"
            accessibilityState={{ selected: isActive }}
            style={[styles.item, isActive && styles.itemActive]}
          >
            <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}

      <View style={styles.footer}>
        {user && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.userName}>{user.fullName}</Text>
            <Text style={styles.userMeta}>Student{user.srCode ? ` · ${user.srCode}` : ''}</Text>
          </View>
        )}
        <Pressable
          onPress={() => navigationRef.isReady() && navigationRef.navigate('ChangePassword')}
          accessibilityRole="button"
          style={{ marginBottom: 10 }}
        >
          <Text style={styles.footerLink}>Change password</Text>
        </Pressable>
        <Pressable
          disabled={loggingOut}
          onPress={() => {
            setLoggingOut(true);
            // Clearing the session swaps the navigator back to Login, which also removes this sidebar.
            void logout();
          }}
          accessibilityRole="button"
          style={[styles.logout, loggingOut && { opacity: 0.6 }]}
        >
          <Text style={styles.logoutLabel}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// On desktop: sidebar on the left, the app on the right. Phone and tablet render the app as it is.
// The tree is the same either way so resizing the window doesn't remount the navigator.
export default function DesktopShell({ children }: { children: ReactNode }) {
  const { isDesktop } = useLayout();
  const { user } = useAuth();
  const showSidebar = isDesktop && !!user && !user.mustChangePassword;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: showSidebar ? colors.white : undefined }}>
      {showSidebar && <Sidebar />}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 200, backgroundColor: colors.primaryDark, paddingVertical: 20, gap: 2 },
  brand: { fontFamily: fonts.serif, fontSize: 19, color: '#fff', paddingHorizontal: 20, marginBottom: 4 },
  role: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.66,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  item: { paddingVertical: 11, paddingHorizontal: 20, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.12)', borderLeftColor: colors.accent },
  itemLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  itemLabelActive: { fontFamily: fonts.bodySemibold, color: '#fff' },
  footer: { marginTop: 'auto', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  userName: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#fff' },
  userMeta: { fontFamily: fonts.bodyRegular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  footerLink: { fontFamily: fonts.bodyRegular, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  logout: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' },
  logoutLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, color: '#fff' },
});
