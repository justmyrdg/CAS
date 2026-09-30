import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { AppHeader, Card } from '../components/ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

function LinkRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.6 }]} onPress={onPress} accessibilityRole="button">
      <Text style={styles.linkLabel}>{label}</Text>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Path d="M5 2l6 5-6 5" stroke={colors.textFaint} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user) return null;

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  // SR codes start with the two-digit enrollment year, e.g. 23-01452 -> batch 2023.
  const batch = user.srCode ? `20${user.srCode.slice(0, 2)}` : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }} edges={['top']}>
        <AppHeader title="Profile" />
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.body}>
          <Card style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user.fullName}</Text>
              <Text style={styles.role}>Student</Text>
            </View>
          </Card>

          <View>
            <Text style={styles.sectionLabel}>Account details</Text>
            <Card style={styles.listCard}>
              <InfoRow label="SR Code" value={user.srCode ?? '—'} />
              {batch && <InfoRow label="Batch" value={batch} />}
              <InfoRow label="Email" value={user.email} last />
            </Card>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Settings</Text>
            <Card style={styles.listCard}>
              <LinkRow label="My progress" onPress={() => navigation.navigate('Progress')} />
              <LinkRow label="Change password" onPress={() => navigation.navigate('ChangePassword')} last />
            </Card>
          </View>

          <Pressable
            disabled={loggingOut}
            onPress={() => {
              setLoggingOut(true);
              // Clearing the session swaps the navigator back to Login.
              void logout();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.logoutLabel}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: fonts.bodyBold, fontSize: 20, color: '#fff' },
  name: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  role: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sectionLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted },
  infoValue: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  linkLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  logout: { borderWidth: 1, borderColor: colors.dangerBg, backgroundColor: colors.white, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutLabel: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.danger },
});
