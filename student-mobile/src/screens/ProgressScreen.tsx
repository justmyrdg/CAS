import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { OutlookCard, RecommendationsCard } from '../components/Insights';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme/colors';
import { widePage } from '../lib/responsive';
import { useStudentData } from '../lib/studentApi';
import type { Progress } from '../lib/studentApi';
import { usePageBg, AppHeader, Card, ErrorView, Loading, ProgressBar, SectionTitle, StatTile, Tag } from '../components/ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES = [
  { key: 'lessons', label: 'Lessons', color: colors.primary },
  { key: 'quizzes', label: 'Module quizzes', color: colors.amber },
  { key: 'assessments', label: 'Class quizzes & exams', color: colors.blue },
] as const;

function formatWhen(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function useWidth() {
  const [width, setWidth] = useState(0);
  return [width, (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))] as const;
}

export default function ProgressScreen() {
  const pageBg = usePageBg();
  const { data, error, loading, reload } = useStudentData<Progress>('/api/student/progress');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }} edges={['top']}>
        <AppHeader title="My Progress" subtitle="Across all your classes" />
        <View style={{ flex: 1, backgroundColor: pageBg }}>
          {loading ? (
            <Loading />
          ) : !data ? (
            <ErrorView message={error ?? 'Unable to load progress'} onRetry={() => void reload()} />
          ) : (
            <ScrollView contentContainerStyle={[styles.body, widePage]}>
              <View style={{ gap: 8 }}>
                <View style={styles.statRow}>
                  <StatTile label="Overall completion" value={`${data.completion}%`} />
                  <StatTile label="Items completed" value={`${data.itemsDone}/${data.itemsTotal}`} />
                </View>
                <View style={styles.statRow}>
                  <StatTile label="Lessons completed" value={`${data.lessonsDone}`} />
                  <StatTile label="Quizzes taken" value={`${data.quizzesTaken}/${data.quizzesTotal}`} />
                  <StatTile label="Quiz average" value={data.quizAverage === null ? '—' : `${data.quizAverage}%`} />
                </View>
              </View>

              <RecommendationsCard items={data.recommendations} onOpen={(classId) => navigation.navigate('ModuleChapter', { classId })} />
              <OutlookCard items={data.outlook} />

              <Card>
                <SectionTitle title="Weekly activity" right={<Text style={styles.muted}>Last 8 weeks</Text>} />
                <ActivityChart weeks={data.trend} />
                <View style={styles.legend}>
                  {SERIES.map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={styles.legendLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Card>
                <SectionTitle
                  title="Module quiz scores"
                  right={data.quizScores.length > 1 ? <Text style={styles.muted}>Last {data.quizScores.length} attempts</Text> : undefined}
                />
                {data.quizScores.length === 0 ? <Text style={styles.empty}>No quiz attempts yet.</Text> : <ScoreChart scores={data.quizScores} />}
              </Card>

              {data.classes.length > 0 && (
                <Card>
                  <SectionTitle title="Completion by class" />
                  <View style={{ gap: 14 }}>
                    {data.classes.map((c) => (
                      <View key={c.id}>
                        <View style={styles.classRow}>
                          <Text style={styles.classTitle} numberOfLines={1}>
                            {c.subjectCode} · {c.subjectName}
                          </Text>
                          <Text style={styles.classPct}>{c.completion}%</Text>
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          <ProgressBar pct={c.completion} />
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              )}

              <Card style={{ paddingBottom: 6 }}>
                <SectionTitle title="Recent activity" />
                {data.recent.length === 0 ? (
                  <Text style={[styles.empty, { marginBottom: 10 }]}>No activity yet.</Text>
                ) : (
                  data.recent.map((r, i) => {
                    const quiz = r.kind === 'QUIZ';
                    return (
                      <View key={i} style={[styles.recentRow, i > 0 && styles.recentBorder]}>
                        <Tag label={quiz ? 'Quiz' : 'Lesson'} tone={quiz ? 'warning' : 'success'} />
                        <Text style={styles.recentTitle} numberOfLines={1}>
                          {r.title}
                        </Text>
                        <Text style={styles.recentMeta}>
                          {quiz ? `${r.score}/${r.total} · ` : ''}
                          {formatWhen(r.at)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </Card>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// Stacked weekly columns.
function ActivityChart({ weeks }: { weeks: Progress['trend'] }) {
  const [width, onLayout] = useWidth();
  const height = 150;
  const pad = { top: 8, bottom: 22, left: 22 };
  const innerH = height - pad.top - pad.bottom;
  const totals = weeks.map((w) => w.lessons + w.quizzes + w.assessments);
  const max = Math.max(4, ...totals);
  const slot = (width - pad.left) / Math.max(weeks.length, 1);
  const barW = Math.min(20, slot * 0.5);
  const empty = totals.every((t) => t === 0);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((t) => (
            <Line key={t} x1={pad.left} x2={width} y1={pad.top + innerH * (1 - t)} y2={pad.top + innerH * (1 - t)} stroke={colors.borderLight} strokeDasharray={t ? '3 4' : undefined} />
          ))}
          <SvgText x={pad.left - 6} y={pad.top + 4} fontSize={9} fill={colors.textFaint} textAnchor="end" fontFamily={fonts.bodyMedium}>
            {max}
          </SvgText>
          <SvgText x={pad.left - 6} y={pad.top + innerH + 3} fontSize={9} fill={colors.textFaint} textAnchor="end" fontFamily={fonts.bodyMedium}>
            0
          </SvgText>
          {weeks.map((w, i) => {
            const x = pad.left + slot * i + (slot - barW) / 2;
            let y = pad.top + innerH;
            const [, m, d] = w.weekStart.split('-').map(Number);
            return (
              <G key={w.weekStart}>
                {SERIES.map((s) => {
                  const h = (w[s.key] / max) * innerH;
                  if (!h) return null;
                  y -= h;
                  return <Rect key={s.key} x={x} y={y} width={barW} height={h} rx={2} fill={s.color} />;
                })}
                <SvgText x={x + barW / 2} y={height - 6} fontSize={9} fill={colors.textFaint} fontFamily={fonts.bodyMedium} textAnchor="middle">
                  {`${MONTHS[m - 1]} ${d}`}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      {empty && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }]} pointerEvents="none">
          <Text style={styles.muted}>No activity in the last 8 weeks.</Text>
        </View>
      )}
    </View>
  );
}

// Recent module-quiz scores as a line, with the 75% line for reference.
function ScoreChart({ scores }: { scores: Progress['quizScores'] }) {
  const [width, onLayout] = useWidth();
  const height = 150;
  const pad = { top: 12, bottom: 12, left: 30, right: 12 };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (scores.length === 1 ? innerW / 2 : (i / (scores.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH * (1 - v / 100);
  const points = scores.map((s, i) => [x(i), y(s.pct)] as const);
  const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
  const latest = scores[scores.length - 1];

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0, 50, 100].map((v) => (
              <G key={v}>
                <Line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={colors.borderLight} strokeDasharray={v ? '3 4' : undefined} />
                <SvgText x={pad.left - 6} y={y(v) + 3} fontSize={9} fill={colors.textFaint} textAnchor="end" fontFamily={fonts.bodyMedium}>
                  {`${v}%`}
                </SvgText>
              </G>
            ))}
            <Line x1={pad.left} x2={width - pad.right} y1={y(75)} y2={y(75)} stroke={colors.mint} strokeWidth={1} strokeDasharray="5 4" />
            {scores.length > 1 && <Path d={line} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />}
            {points.map(([px, py], i) => (
              <Circle key={i} cx={px} cy={py} r={3.5} fill={colors.white} stroke={colors.primary} strokeWidth={2} />
            ))}
          </Svg>
        )}
      </View>
      <View style={styles.latestRow}>
        <Text style={styles.muted} numberOfLines={1}>
          Latest: {latest.title}
        </Text>
        <Text style={styles.latestScore}>{latest.pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14 },
  statRow: { flexDirection: 'row', gap: 8 },
  muted: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  latestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  latestScore: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  classTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  classPct: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.text },
  empty: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  recentBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  recentTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  recentMeta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
});
