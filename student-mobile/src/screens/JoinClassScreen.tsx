import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { apiRequest, errorText } from '../lib/api';
import { BackHeader, PrimaryButton } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinClass'>;

export default function JoinClassScreen({ navigation }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function join() {
    setError(null);
    if (!code.trim()) {
      setError('Enter the join code from your instructor.');
      return;
    }
    setJoining(true);
    try {
      const data = await apiRequest<{ class: { id: string } }>('/api/student/classes/join', {
        method: 'POST',
        body: { joinCode: code },
      });
      // Straight into the class; going back lands on the (refreshed) class list.
      navigation.replace('ModuleChapter', { classId: data.class.id });
    } catch (err) {
      setError(errorText(err, 'Unable to join'));
      setJoining(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <BackHeader crumb="My Classes" title="Join a class" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <Text style={styles.text}>Enter the join code your instructor shared, for example CS101-8XQ2.</Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="CS101-8XQ2"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            accessibilityLabel="Join code"
            onSubmitEditing={() => void join()}
            style={styles.input}
            placeholderTextColor={colors.textFaint}
          />
          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <PrimaryButton label={joining ? 'Joining…' : 'Join class'} onPress={() => void join()} disabled={joining} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14 },
  text: { fontFamily: fonts.bodyRegular, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.text,
    textAlign: 'center',
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger },
});
