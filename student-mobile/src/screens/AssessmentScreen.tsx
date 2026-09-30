import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { apiRequest, errorText } from '../lib/api';
import { useStudentData } from '../lib/studentApi';
import { fmtDate, fmtScore, kindLabel } from '../lib/assessmentApi';
import type { AssessmentSummary, AttemptReview, ReviewQuestion, StartedAttempt, StudentQuestion } from '../lib/assessmentApi';
import { ErrorView, Loading, PrimaryButton, ProgressBar, SecondaryButton } from '../components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Assessment'>;
type Answers = Record<string, unknown>;

const LETTERS = 'ABCDEFGH';

function isAnswered(a: unknown) {
  if (a === undefined || a === null) return false;
  if (typeof a === 'string') return a.trim().length > 0;
  if (Array.isArray(a)) return a.some((x) => (typeof x === 'string' ? x.trim().length > 0 : x !== null && x !== undefined));
  return true;
}

// An instructor-made quiz or exam: details → take it (one question at a time, timed if it has a limit) → result.
export default function AssessmentScreen({ navigation, route }: Props) {
  const { assessmentId } = route.params;
  const { data, error, loading, reload } = useStudentData<{ assessment: AssessmentSummary }>(`/api/student/assessments/${assessmentId}`);
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Server clock minus this device's clock, so the countdown matches the server's deadline.
  const [clockOffset, setClockOffset] = useState(0);
  const submitting = useRef(false);

  const a = data?.assessment;
  const deadline = attempt?.deadline ? new Date(attempt.deadline).getTime() : null;
  const remaining = deadline ? Math.max(0, deadline - (now + clockOffset)) : null;

  async function start() {
    setBusy(true);
    setActionError(null);
    try {
      const started = await apiRequest<StartedAttempt>(`/api/student/assessments/${assessmentId}/attempts`, { method: 'POST' });
      setClockOffset(new Date(started.serverTime).getTime() - Date.now());
      setNow(Date.now());
      setAttempt(started);
      setAnswers({});
      setIndex(0);
      submitting.current = false;
    } catch (err) {
      setActionError(errorText(err, 'Unable to start'));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!attempt || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const { review: result } = await apiRequest<{ review: AttemptReview }>(`/api/student/attempts/${attempt.attemptId}/submit`, {
        method: 'POST',
        body: { answers },
      });
      setReview(result);
      setAttempt(null);
    } catch (err) {
      setActionError(errorText(err, 'Unable to submit'));
      setAttempt(null);
    } finally {
      setBusy(false);
      void reload();
    }
  }

  async function openAttempt(id: string) {
    setBusy(true);
    setActionError(null);
    try {
      const { review: result } = await apiRequest<{ review: AttemptReview }>(`/api/student/attempts/${id}`);
      setReview(result);
    } catch (err) {
      setActionError(errorText(err, 'Unable to open that attempt'));
    } finally {
      setBusy(false);
    }
  }

  // The countdown; time running out submits whatever has been answered.
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    if (attempt && remaining === 0) void submit();
  }, [remaining === 0, attempt]); // only when time first reaches 0

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kind}>{a ? kindLabel(a.kind).toUpperCase() : ''}</Text>
          <Text style={styles.title}>{attempt?.title ?? review?.title ?? a?.title ?? route.params.title}</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      {attempt && (
        <View style={styles.progressRow}>
          <ProgressBar pct={((index + 1) / attempt.questions.length) * 100} />
          <Text style={styles.progressLabel}>
            {index + 1} of {attempt.questions.length}
          </Text>
          {remaining !== null && (
            <Text style={[styles.timer, remaining < 60_000 && { color: colors.danger }]} accessibilityLabel="Time left">
              ⏱ {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (loading && !a) return <Screen>{header}<Loading /></Screen>;
  if (!a) return <Screen>{header}<ErrorView message={error ?? 'Unable to load'} onRetry={() => void reload()} /></Screen>;

  // ---------- Result / review ----------
  if (review) {
    return (
      <Screen>
        {header}
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreBig}>
              {fmtScore(review.score)}/{review.maxScore}
            </Text>
            <Text style={styles.scoreNote}>
              {review.needsGrading
                ? 'Your written answers are waiting for your instructor to grade them — this score may go up.'
                : `Submitted ${fmtDate(review.submittedAt)}`}
            </Text>
          </View>
          {!review.showAnswers && <Text style={styles.muted}>Your instructor will share the correct answers later.</Text>}
          {review.questions.map((q, i) => (
            <ReviewCard key={q.id} q={q} n={i + 1} />
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Done" onPress={() => setReview(null)} />
        </View>
      </Screen>
    );
  }

  // ---------- Taking it ----------
  if (attempt) {
    const q = attempt.questions[index];
    const isLast = index === attempt.questions.length - 1;
    const unanswered = attempt.questions.filter((x) => !isAnswered(answers[x.id])).length;
    const set = (value: unknown) => setAnswers((prev) => ({ ...prev, [q.id]: value }));
    return (
      <Screen>
        {header}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.points}>
            {q.points} point{q.points === 1 ? '' : 's'}
          </Text>
          <Text style={styles.question}>{q.prompt}</Text>
          <QuestionInput q={q} value={answers[q.id]} onChange={set} />
        </ScrollView>
        <View style={styles.footer}>
          {actionError && <Text style={styles.error}>{actionError}</Text>}
          {isLast && unanswered > 0 && (
            <Text style={styles.muted}>
              {unanswered} question{unanswered === 1 ? '' : 's'} not answered yet
            </Text>
          )}
          <View style={styles.navRow}>
            {index > 0 && (
              <View style={{ flex: 1 }}>
                <SecondaryButton label="Back" onPress={() => setIndex(index - 1)} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {isLast ? (
                <PrimaryButton label={busy ? 'Submitting…' : 'Submit'} onPress={() => void submit()} disabled={busy} />
              ) : (
                <PrimaryButton label="Next" onPress={() => setIndex(index + 1)} />
              )}
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  // ---------- Details ----------
  const attemptsLeft = a.maxAttempts === null ? null : Math.max(0, a.maxAttempts - a.attemptsUsed);
  const canStart = a.status === 'OPEN' || a.status === 'IN_PROGRESS';
  const blocked =
    a.status === 'NOT_OPEN'
      ? a.opensAt
        ? `Opens ${fmtDate(a.opensAt)}`
        : 'Not open yet'
      : a.status === 'CLOSED'
        ? 'This is closed.'
        : a.status === 'NO_ATTEMPTS_LEFT'
          ? "You've used all your attempts."
          : null;
  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.facts}>
          <Fact label="Questions" value={String(a.questionCount)} />
          <Fact label="Points" value={String(a.totalPoints)} />
          <Fact label="Time" value={a.timeLimitMinutes ? `${a.timeLimitMinutes} min` : 'No limit'} />
          <Fact label="Attempts" value={attemptsLeft === null ? 'Unlimited' : `${attemptsLeft} left`} />
        </View>
        {a.closesAt && <Text style={styles.muted}>Closes {fmtDate(a.closesAt)}</Text>}
        {a.instructions ? <Text style={styles.instructions}>{a.instructions}</Text> : null}
        {a.timeLimitMinutes ? (
          <Text style={styles.muted}>The timer starts when you begin and keeps running if you leave. When it reaches 0:00 your answers are submitted.</Text>
        ) : null}
        {a.attempts.length > 0 && (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Text style={styles.sectionLabel}>YOUR ATTEMPTS</Text>
            {a.attempts.map((t, i) => (
              <Pressable key={t.id} onPress={() => void openAttempt(t.id)} style={styles.attemptRow} accessibilityRole="button">
                <Text style={styles.attemptText}>
                  #{i + 1} · {fmtDate(t.submittedAt)}
                </Text>
                <Text style={styles.attemptScore}>{t.needsGrading ? 'Grading…' : `${fmtScore(t.score)}/${t.maxScore}`}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {actionError && <Text style={styles.error}>{actionError}</Text>}
        {blocked && <Text style={styles.muted}>{blocked}</Text>}
        {canStart && (
          <PrimaryButton
            label={busy ? 'Starting…' : a.status === 'IN_PROGRESS' ? 'Continue' : a.attemptsUsed ? 'Try again' : `Start ${kindLabel(a.kind).toLowerCase()}`}
            onPress={() => void start()}
            disabled={busy}
          />
        )}
      </View>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

function Option({ selected, onPress, square, children }: { selected: boolean; onPress: () => void; square?: boolean; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceActive]}
      accessibilityRole={square ? 'checkbox' : 'radio'}
      accessibilityState={square ? { checked: selected } : { selected }}
    >
      <View style={[styles.mark, square ? styles.markSquare : null, selected && styles.markActive]} />
      <Text style={styles.choiceLabel}>{children}</Text>
    </Pressable>
  );
}

function QuestionInput({ q, value, onChange }: { q: StudentQuestion; value: unknown; onChange: (v: unknown) => void }) {
  switch (q.type) {
    case 'MULTIPLE_CHOICE':
      return (
        <View style={{ gap: 10 }}>
          {q.choices.map((c, i) => (
            <Option key={i} selected={value === i} onPress={() => onChange(i)}>
              {LETTERS[i]}. {c}
            </Option>
          ))}
        </View>
      );
    case 'MULTIPLE_SELECT': {
      const picked = Array.isArray(value) ? (value as number[]) : [];
      return (
        <View style={{ gap: 10 }}>
          <Text style={styles.muted}>Select {q.selectCount} answer{q.selectCount === 1 ? '' : 's'}</Text>
          {q.choices.map((c, i) => (
            <Option key={i} square selected={picked.includes(i)} onPress={() => onChange(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])}>
              {LETTERS[i]}. {c}
            </Option>
          ))}
        </View>
      );
    }
    case 'TRUE_FALSE':
      return (
        <View style={{ gap: 10 }}>
          {[true, false].map((v) => (
            <Option key={String(v)} selected={value === v} onPress={() => onChange(v)}>
              {v ? 'True' : 'False'}
            </Option>
          ))}
        </View>
      );
    case 'SHORT_ANSWER':
      return (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="Type your answer"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          style={styles.input}
          accessibilityLabel="Your answer"
        />
      );
    case 'ENUMERATION': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={{ gap: 8 }}>
          <Text style={styles.muted}>Give {q.count} answers{q.ordered ? ', in order' : ' (any order)'}</Text>
          {Array.from({ length: q.count }, (_, i) => (
            <TextInput
              key={i}
              value={list[i] ?? ''}
              onChangeText={(t) => {
                const next = Array.from({ length: q.count }, (_, j) => list[j] ?? '');
                next[i] = t;
                onChange(next);
              }}
              placeholder={`${i + 1}.`}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              accessibilityLabel={`Answer ${i + 1}`}
            />
          ))}
        </View>
      );
    }
    case 'MATCHING': {
      const picks = Array.isArray(value) ? (value as (string | null)[]) : [];
      return (
        <View style={{ gap: 14 }}>
          <Text style={styles.muted}>Pick the match for each item</Text>
          {q.left.map((item, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text style={styles.matchItem}>
                {i + 1}. {item}
              </Text>
              <View style={styles.chips}>
                {q.options.map((opt) => {
                  const on = picks[i] === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        const next = Array.from({ length: q.left.length }, (_, j) => picks[j] ?? null);
                        next[i] = on ? null : opt;
                        onChange(next);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case 'ESSAY':
      return (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="Write your answer"
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
          style={[styles.input, { minHeight: 180 }]}
          accessibilityLabel="Your answer"
        />
      );
  }
}

// The student's answer (and the key, when shared) as text.
function answerText(q: ReviewQuestion, a: unknown): string {
  if (a === null || a === undefined || a === '') return '—';
  switch (q.type) {
    case 'MULTIPLE_CHOICE':
      return typeof a === 'number' ? `${LETTERS[a]}. ${q.choices?.[a] ?? ''}` : '—';
    case 'MULTIPLE_SELECT':
      return Array.isArray(a) && a.length ? (a as number[]).map((i) => `${LETTERS[i]}. ${q.choices?.[i] ?? ''}`).join('\n') : '—';
    case 'TRUE_FALSE':
      return a ? 'True' : 'False';
    case 'ENUMERATION':
      return Array.isArray(a) ? (a as string[]).filter((x) => x.trim()).join(', ') || '—' : '—';
    case 'MATCHING':
      return (q.left ?? []).map((l, i) => `${l} → ${(a as (string | null)[])[i] ?? '—'}`).join('\n');
    default:
      return String(a);
  }
}

function keyText(q: ReviewQuestion): string | null {
  const k = q.key;
  if (!k) return null;
  if (q.type === 'MULTIPLE_CHOICE' && typeof k.correct === 'number') return `${LETTERS[k.correct]}. ${q.choices?.[k.correct] ?? ''}`;
  if (q.type === 'MULTIPLE_SELECT' && Array.isArray(k.correct)) return k.correct.map((i) => `${LETTERS[i]}. ${q.choices?.[i] ?? ''}`).join('\n');
  if (q.type === 'TRUE_FALSE' && typeof k.correct === 'boolean') return k.correct ? 'True' : 'False';
  if (k.accepted) return k.accepted.join(' / ');
  if (k.answers) return k.answers.join(', ');
  if (k.matches) return (q.left ?? []).map((l, i) => `${l} → ${k.matches?.[i]}`).join('\n');
  return null;
}

function ReviewCard({ q, n }: { q: ReviewQuestion; n: number }) {
  const full = q.graded && q.earned >= q.points;
  const zero = q.graded && q.earned === 0;
  const key = keyText(q);
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <Text style={styles.reviewQ}>
          {n}. {q.prompt}
        </Text>
        <Text style={[styles.reviewPts, { color: !q.graded ? colors.warningText : full ? colors.primary : zero ? colors.danger : colors.text }]}>
          {q.graded ? `${fmtScore(q.earned)}/${q.points}` : 'Grading…'}
        </Text>
      </View>
      <Text style={styles.reviewLabel}>Your answer</Text>
      <Text style={styles.reviewText}>{answerText(q, q.answer)}</Text>
      {key && !full && (
        <>
          <Text style={styles.reviewLabel}>Correct answer</Text>
          <Text style={[styles.reviewText, { color: colors.primary }]}>{key}</Text>
        </>
      )}
      {q.feedback ? (
        <>
          <Text style={styles.reviewLabel}>Feedback</Text>
          <Text style={styles.reviewText}>{q.feedback}</Text>
        </>
      ) : null}
    </View>
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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kind: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: colors.primary },
  title: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.text, marginTop: 2 },
  close: { fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  timer: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  body: { padding: 20, gap: 12 },
  points: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
  question: { fontFamily: fonts.bodySemibold, fontSize: 17, lineHeight: 25, color: colors.text, marginBottom: 6 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  choiceActive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  mark: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  markSquare: { borderRadius: 4 },
  markActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.text,
  },
  matchItem: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 100, paddingVertical: 7, paddingHorizontal: 12 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  chipTextOn: { color: '#fff' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  navRow: { flexDirection: 'row', gap: 10 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, textAlign: 'center' },
  muted: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  instructions: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 23, color: colors.text },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, backgroundColor: colors.primaryLight, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 2 },
  factValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
  factLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: colors.textMuted },
  attemptRow: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  attemptText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  attemptScore: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.primary },
  scoreCard: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 16, padding: 20, gap: 6 },
  scoreBig: { fontFamily: fonts.bodyBold, fontSize: 36, color: colors.primary },
  scoreNote: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  reviewCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 4 },
  reviewTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  reviewQ: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 20, color: colors.text },
  reviewPts: { fontFamily: fonts.bodyBold, fontSize: 13 },
  reviewLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6, color: colors.textMuted, marginTop: 6 },
  reviewText: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20, color: colors.text },
});
