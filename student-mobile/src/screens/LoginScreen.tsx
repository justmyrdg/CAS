import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { errorText } from '../lib/api';

const SR_CODE = /^\d{2}-\d{5}$/;

// Signing in swaps the navigator to the app (see RootNavigator), so there's no navigate() here.
export default function LoginScreen() {
  const { login } = useAuth();
  const [srCode, setSrCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!SR_CODE.test(srCode.trim())) {
      setError('Enter your SR code in the format YY-XXXXX, e.g. 23-01452.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(srCode, password);
    } catch (err) {
      setError(errorText(err, 'Unable to sign in'));
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.hero}>
            <Text style={styles.wordmark}>CogniView AR</Text>
            <Text style={styles.heroLabel}>Student</Text>
          </View>
          <View style={styles.sheet}>
            <Text style={styles.label}>SR Code</Text>
            <TextInput
              value={srCode}
              onChangeText={setSrCode}
              placeholder="23-01452"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
              accessibilityLabel="SR code"
              style={[styles.input, styles.srInput]}
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.hint}>Format: YY-XXXXX — your enrollment year plus student ID</Text>

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Password"
              onSubmitEditing={() => void submit()}
              style={styles.input}
              placeholderTextColor={colors.textFaint}
            />

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <Pressable
              style={[styles.continueBtn, submitting && { opacity: 0.7 }]}
              onPress={() => void submit()}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.continueLabel}>{submitting ? 'Signing in…' : 'Sign In'}</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerLabel}>OR</Text>
              <View style={styles.divider} />
            </View>

            {/* Needs a Google OAuth client configured for the school before it can work. */}
            <View style={[styles.googleBtn, { opacity: 0.5 }]} accessibilityState={{ disabled: true }}>
              <GoogleIcon />
              <Text style={styles.googleLabel}>Continue with Google (coming soon)</Text>
            </View>

            <Text style={styles.footer}>Trouble signing in? Contact your Dean's Office</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9a8.7 8.7 0 002.7-6.62z"
        fill="#4285F4"
      />
      <Path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.87-3.06.87-2.36 0-4.36-1.6-5.07-3.75H.9v2.33A9 9 0 009 18z"
        fill="#34A853"
      />
      <Path d="M3.93 10.68a5.4 5.4 0 010-3.36V5H.9a9 9 0 000 8l3.03-2.32z" fill="#FBBC05" />
      <Path
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.64 8.64 0 009 0 9 9 0 00.9 5l3.03 2.32C4.64 5.17 6.64 3.58 9 3.58z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  wordmark: { fontFamily: fonts.serif, fontSize: 26, color: '#fff' },
  heroLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 24,
    paddingBottom: 28,
  },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  srInput: { borderWidth: 1.5, borderColor: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 18, letterSpacing: 1, marginBottom: 6 },
  hint: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted, marginBottom: 18 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, marginTop: -6, marginBottom: 14 },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  continueLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textFaint },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 100,
    paddingVertical: 13,
    marginBottom: 16,
  },
  googleLabel: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  footer: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
