import { useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { apiRequest, errorText } from '../lib/api';
import { useStudentData } from '../lib/studentApi';
import type { Quiz, QuizResult } from '../lib/studentApi';
import { ErrorView, Loading, PrimaryButton, ProgressBar, SecondaryButton } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

const LETTERS = 'ABCDEF';

export default function QuizScreen({ navigation, route }: Props) {
  const { quizId, crumb } = route.params;
  const { data, error, loading, reload } = useStudentData<{ quiz: Quiz }>(`/api/student/quizzes/${quizId}`);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const quiz = data?.quiz;
  const best = quiz?.attempts.reduce<{ score: number; total: number } | null>(
    (b, a) => (!b || a.score / a.total > b.score / b.total ? a : b),
    null,
  );

  function retake() {
    setResult(null);
    setAnswers([]);
    setIndex(0);
    setSubmitError(null);
    void reload();
  }

  async function submit() {
    if (!quiz) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiRequest<QuizResult>(`/api/student/quizzes/${quizId}/attempts`, {
        method: 'POST',
        body: { answers: quiz.questions.map((_, i) => answers[i] ?? -1) },
      });
      setResult(res);
    } catch (err) {
      setSubmitError(errorText(err, 'Unable to submit'));
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{quiz?.title ?? 'Quiz'}</Text>
          <Text style={styles.subtitle}>{crumb}</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close quiz">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      {quiz && !result && (
        <>
          {best && (
            <View style={styles.attemptBadge}>
              <Text style={styles.attemptLabel}>
                Best so far {best.score}/{best.total} · {quiz.attempts.length} attempt{quiz.attempts.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}
          <View style={styles.progressRow}>
            <ProgressBar pct={((index + 1) / Math.max(quiz.questions.length, 1)) * 100} />
            <Text style={styles.progressLabel}>
              Q{index + 1} of {quiz.questions.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );

  if (loading || !quiz) {
    return (
      <Screen>
        {header}
        {loading ? <Loading /> : <ErrorView message={error ?? 'Unable to load quiz'} onRetry={() => void reload()} />}
      </Screen>
    );
  }

  if (quiz.questions.length === 0) {
    return (
      <Screen>
        {header}
        <ErrorView message="This quiz doesn't have any questions yet." />
      </Screen>
    );
  }

  // ---------- Results ----------
  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <Screen>
        {header}
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreBig}>
              {result.score}/{result.total}
            </Text>
            <Text style={styles.scorePct}>{pct}%</Text>
            <Text style={styles.scoreNote}>{pct === 100 ? 'Perfect score!' : pct >= 75 ? 'Nice work.' : 'Review the answers below and try again.'}</Text>
          </View>
          {quiz.questions.map((q, qi) => {
            const r = result.results[qi];
            return (
              <View key={q.id} style={styles.reviewCard}>
                <Text style={styles.reviewQ}>
                  {qi + 1}. {q.prompt}
                </Text>
                {q.choices.map((choice, ci) => {
                  const isCorrect = ci === r.correctChoice;
                  const isChosen = ci === r.chosen;
                  return (
                    <View
                      key={ci}
                      style={[styles.reviewChoice, isCorrect && styles.reviewCorrect, isChosen && !isCorrect && styles.reviewWrong]}
                    >
                      <Text style={styles.reviewLetter}>{LETTERS[ci]}</Text>
                      <Text style={styles.reviewText}>{choice}</Text>
                      {isCorrect && <Text style={styles.reviewTagOk}>Correct</Text>}
                      {isChosen && !isCorrect && <Text style={styles.reviewTagBad}>Your answer</Text>}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <SecondaryButton label="Retake quiz" onPress={retake} />
          <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  // ---------- Taking the quiz ----------
  const q = quiz.questions[index];
  const selected = answers[index] ?? null;
  const isLast = index === quiz.questions.length - 1;
  const allAnswered = quiz.questions.every((_, i) => answers[i] !== null && answers[i] !== undefined);

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.question}>{q.prompt}</Text>
        {q.choices.map((choice, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={i}
              onPress={() => setAnswers((prev) => {
                const next = [...prev];
                next[index] = i;
                return next;
              })}
              style={[styles.choice, active && styles.choiceActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <Text style={styles.choiceLabel}>{choice}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {submitError && <Text style={styles.error}>{submitError}</Text>}
        <View style={styles.navRow}>
          {index > 0 && (
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Back" onPress={() => setIndex(index - 1)} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {isLast ? (
              <PrimaryButton
                label={submitting ? 'Submitting…' : allAnswered ? 'Submit' : 'Answer every question'}
                onPress={() => void submit()}
                disabled={!allAnswered || submitting}
              />
            ) : (
              <PrimaryButton label="Next" onPress={() => setIndex(index + 1)} disabled={selected === null} />
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted },
  close: { fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.textMuted },
  attemptBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, borderRadius: 100, paddingVertical: 5, paddingHorizontal: 10 },
  attemptLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.primary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  body: { padding: 20, gap: 12 },
  question: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 24, color: colors.text, marginBottom: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  choiceActive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  navRow: { flexDirection: 'row', gap: 10 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, textAlign: 'center' },
  scoreCard: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 16, padding: 20, gap: 4, marginBottom: 6 },
  scoreBig: { fontFamily: fonts.bodyBold, fontSize: 36, color: colors.primary },
  scorePct: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  scoreNote: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  reviewCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 8 },
  reviewQ: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text, lineHeight: 20 },
  reviewChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  reviewCorrect: { backgroundColor: colors.primaryLight },
  reviewWrong: { backgroundColor: colors.dangerBg },
  reviewLetter: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted, width: 14 },
  reviewText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  reviewTagOk: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.primary },
  reviewTagBad: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.danger },
});
