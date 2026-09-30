import { useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { termLabel, useStudentData } from '../lib/studentApi';
import type { ClassDetail, OutlineItem } from '../lib/studentApi';
import { BackHeader, ErrorView, Loading, ProgressBar, Tabs, Tag } from '../components/ui';
import { kindLabel, statusLine } from '../lib/assessmentApi';
import type { AssessmentSummary } from '../lib/assessmentApi';

type Props = NativeStackScreenProps<RootStackParamList, 'ModuleChapter'>;
type Tab = 'lessons' | 'quizzes' | 'exams';

// A class's content: modules -> chapters -> lessons & quizzes, with what's done and what's still locked.
export default function ModuleChapterScreen({ navigation, route }: Props) {
  const { classId } = route.params;
  const { data, error, loading, reload } = useStudentData<ClassDetail>(`/api/student/classes/${classId}`);
  // The instructor's own quizzes & exams for this class (refreshes when returning from one).
  const { data: assessmentData } = useStudentData<{ assessments: AssessmentSummary[] }>(`/api/student/classes/${classId}/assessments`);
  const assessments = assessmentData?.assessments ?? [];
  const [tab, setTab] = useState<Tab>('lessons');
  const quizzes = assessments.filter((a) => a.kind === 'QUIZ');
  const exams = assessments.filter((a) => a.kind === 'EXAM');

  if (loading) return <Shell onBack={() => navigation.goBack()} title="…" crumb="My Classes"><Loading /></Shell>;
  if (!data) {
    return (
      <Shell onBack={() => navigation.goBack()} title="Class" crumb="My Classes">
        <ErrorView message={error ?? 'Unable to load class'} onRetry={() => void reload()} />
      </Shell>
    );
  }

  const cls = data.class;

  function open(item: OutlineItem, chapterTitle: string) {
    if (item.type === 'LESSON') navigation.navigate('Lesson', { lessonId: item.id, crumb: chapterTitle });
    else navigation.navigate('Quiz', { quizId: item.id, crumb: chapterTitle });
  }

  return (
    <Shell
      onBack={() => navigation.goBack()}
      crumb={`${cls.subjectCode} · Section ${cls.section} · ${termLabel(cls.term, cls.schoolYear)}`}
      title={cls.subjectName}
      header={
        <>
          <Text style={styles.instructor}>{cls.instructorName}</Text>
          <View style={styles.progressRow}>
            <ProgressBar pct={data.completion} />
            <Text style={styles.progressLabel}>
              {data.completion}% · {data.itemsDone} of {data.itemsTotal} completed
            </Text>
          </View>
        </>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { key: 'lessons', label: 'Lessons' },
          { key: 'quizzes', label: quizzes.length ? `Quizzes (${quizzes.length})` : 'Quizzes' },
          { key: 'exams', label: exams.length ? `Exams (${exams.length})` : 'Exams' },
        ]}
      />
      {tab !== 'lessons' ? (
        <ScrollView contentContainerStyle={styles.list}>
          <AssessmentList
            items={tab === 'exams' ? exams : quizzes}
            empty={tab === 'exams' ? "Your instructor hasn't posted any exams yet." : "Your instructor hasn't posted any quizzes yet. Chapter quizzes are under Lessons."}
            onOpen={(a) => navigation.navigate('Assessment', { assessmentId: a.id, title: a.title })}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {data.modules.length === 0 && <Text style={styles.empty}>Your instructor hasn't published any lessons for this subject yet.</Text>}
          {data.modules.map((mod, mi) => (
            <View key={mod.id} style={{ gap: 10 }}>
              <View style={styles.moduleHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moduleLabel}>Module {mi + 1}</Text>
                  <Text style={styles.moduleTitle}>{mod.title}</Text>
                </View>
                {mod.itemsTotal > 0 && (
                  <Text style={styles.moduleMeta}>
                    {mod.completion}% · {mod.itemsDone}/{mod.itemsTotal}
                  </Text>
                )}
              </View>

              {mod.chapters.map((ch, ci) => (
                <View key={ch.id} style={[styles.chapterCard, ch.locked && styles.chapterLocked]}>
                  <View style={styles.chapterTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chapterTitle}>
                        {mi + 1}.{ci + 1} {ch.title}
                      </Text>
                      {ch.locked ? (
                        <Text style={styles.chapterNote}>Complete the previous chapters to unlock.</Text>
                      ) : ch.description ? (
                        <Text style={styles.chapterNote}>{ch.description}</Text>
                      ) : null}
                    </View>
                    {/* An empty chapter counts as complete, but a locked one shouldn't say so. */}
                    {ch.locked ? (
                      <View style={styles.lockedTag}>
                        <Svg width={11} height={11} viewBox="0 0 24 24">
                          <Rect x={5} y={11} width={14} height={10} rx={2} stroke={colors.textMuted} strokeWidth={2.4} fill="none" />
                          <Path d="M8 11V8a4 4 0 018 0v3" stroke={colors.textMuted} strokeWidth={2.4} fill="none" />
                        </Svg>
                        <Text style={styles.lockedTagLabel}>Locked</Text>
                      </View>
                    ) : ch.complete ? (
                      <Tag label="Completed" tone="success" />
                    ) : (
                      <Tag label="In progress" tone="warning" />
                    )}
                  </View>

                  {!ch.locked && ch.items.length > 0 && (
                    <View style={styles.items}>
                      {ch.items.map((item, ii) => {
                        const quiz = item.type === 'QUIZ';
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => open(item, `${mi + 1}.${ci + 1} ${ch.title}`)}
                            style={({ pressed }) => [styles.itemRow, ii > 0 && styles.itemBorder, pressed && { backgroundColor: colors.tableHeaderBg }]}
                            accessibilityRole="button"
                            accessibilityLabel={`${quiz ? 'Quiz' : 'Lesson'}: ${item.title}`}
                          >
                            <Tag label={quiz ? 'Quiz' : 'Lesson'} tone={quiz ? 'warning' : 'success'} />
                            <Text style={styles.itemTitle} numberOfLines={2}>
                              {item.title}
                            </Text>
                            <Text style={item.done ? styles.itemDone : styles.itemTodo}>
                              {quiz && item.bestScore !== null ? `${item.bestScore}/${item.bestTotal}` : item.done ? 'Completed' : 'Open'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {!ch.locked && ch.items.length === 0 && <Text style={styles.noItems}>No lessons in this chapter yet.</Text>}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Shell>
  );
}

// The instructor's quizzes or exams for the class, with their status (open, in progress, score, …).
function AssessmentList({ items, empty, onOpen }: { items: AssessmentSummary[]; empty: string; onOpen: (a: AssessmentSummary) => void }) {
  if (items.length === 0) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={styles.items}>
      {items.map((a, i) => {
        const action = a.status === 'IN_PROGRESS' ? 'Continue' : a.status === 'OPEN' && !a.attemptsUsed ? 'Start' : 'View';
        return (
          <Pressable
            key={a.id}
            onPress={() => onOpen(a)}
            style={({ pressed }) => [styles.assessmentRow, i > 0 && styles.itemBorder, pressed && { backgroundColor: colors.tableHeaderBg }]}
            accessibilityRole="button"
            accessibilityLabel={`${kindLabel(a.kind)}: ${a.title}`}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.assessmentTitle} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={styles.assessmentMeta}>
                {a.questionCount} question{a.questionCount === 1 ? '' : 's'} · {a.totalPoints} pts
                {a.timeLimitMinutes ? ` · ${a.timeLimitMinutes} min` : ''}
              </Text>
              <Text style={styles.assessmentStatus}>{statusLine(a)}</Text>
            </View>
            <Text style={action === 'View' ? styles.itemTodo : styles.itemDone}>{action}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shell({
  onBack,
  crumb,
  title,
  header,
  children,
}: {
  onBack: () => void;
  crumb: string;
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <BackHeader crumb={crumb} title={title} onBack={onBack}>
          {header}
        </BackHeader>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  instructor: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  list: { padding: 20, gap: 22 },
  empty: { fontFamily: fonts.bodyRegular, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 30 },
  moduleHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  moduleLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
  moduleTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  moduleMeta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  chapterCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 12 },
  chapterLocked: { backgroundColor: colors.tableHeaderBg },
  chapterTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chapterTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  chapterNote: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lockedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.borderLight, borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8 },
  lockedTagLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.textMuted },
  items: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  itemTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  itemDone: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary },
  itemTodo: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textMuted },
  noItems: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textFaint },
  assessmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  assessmentTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  assessmentMeta: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted },
  assessmentStatus: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary },
});
