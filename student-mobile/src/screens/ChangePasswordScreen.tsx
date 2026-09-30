import { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { apiRequest, errorText } from '../lib/api';
import type { StudentUser } from '../lib/api';
import { BackHeader, PrimaryButton, SecondaryButton } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

// Forced on first sign-in with a temporary password (then it's the only screen), and reachable from Profile.
export default function ChangePasswordScreen({ navigation }: Props) {
  const { user, setUser, logout } = useAuth();
  const forced = Boolean(user?.mustChangePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setError(null);
    if (next !== confirm) {
      setError('The new passwords don’t match.');
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ user: StudentUser }>('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      // Clearing mustChangePassword swaps the navigator to the app when this was the forced screen.
      setUser(data.user);
      if (!forced) setDone(true);
    } catch (err) {
      setError(errorText(err, 'Unable to change password'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {forced ? (
          <View style={styles.forcedHeader}>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>You signed in with a temporary password. Choose your own to continue.</Text>
          </View>
        ) : (
          <BackHeader crumb="Profile" title="Change password" onBack={() => navigation.goBack()} />
        )}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {done ? (
            <>
              <Text style={styles.success}>Your password has been changed.</Text>
              <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
            </>
          ) : (
            <>
              <Field label={forced ? 'Temporary password' : 'Current password'} value={current} onChange={setCurrent} />
              <Field label="New password" value={next} onChange={setNext} />
              <Field label="Confirm new password" value={confirm} onChange={setConfirm} />
              <Text style={styles.hint}>At least 8 characters, with an uppercase letter and a number.</Text>
              {error && (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              )}
              <PrimaryButton label={saving ? 'Saving…' : 'Save password'} onPress={() => void save()} disabled={saving} />
              {forced && <SecondaryButton label="Sign out" onPress={() => void logout()} />}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} secureTextEntry autoCapitalize="none" accessibilityLabel={label} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  forcedHeader: { padding: 20, paddingTop: 28, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 },
  title: { fontFamily: fonts.bodyBold, fontSize: 21, color: colors.text },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  body: { padding: 20, gap: 14 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  hint: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger },
  success: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.primary },
});
