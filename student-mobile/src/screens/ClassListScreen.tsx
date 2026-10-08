import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { widePage } from '../lib/responsive';
import { termLabel, useStudentData } from '../lib/studentApi';
import type { ClassSummary, Progress } from '../lib/studentApi';
import { AppHeader, ErrorView, Grid, HeaderButton, Loading, PrimaryButton, ProgressBar, StatTile, Tabs, Tag } from '../components/ui';
import { RecommendationsCard } from '../components/Insights';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'ClassList'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ClassListScreen({ navigation }: Props) {
  const { data, error, loading, reload } = useStudentData<{ classes: ClassSummary[] }>('/api/student/classes');
  const { data: progress, reload: reloadProgress } = useStudentData<Progress>('/api/student/progress');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [refreshing, setRefreshing] = useState(false);

  const all = data?.classes ?? [];
  const classes = all.filter((c) => c.isArchived === (tab === 'archived'));
  const archivedCount = all.filter((c) => c.isArchived).length;
  const openJoin = () => navigation.navigate('JoinClass');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }} edges={['top']}>
        <AppHeader title="My Classes" right={<HeaderButton label="+ Join class" onPress={openJoin} />} />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { key: 'active', label: 'Active' },
              { key: 'archived', label: archivedCount ? `Archived (${archivedCount})` : 'Archived' },
            ]}
          />
          {loading ? (
            <Loading />
          ) : error && !data ? (
            <ErrorView message={error} onRetry={() => void reload()} />
          ) : (
            <ScrollView
              contentContainerStyle={[styles.list, widePage]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void Promise.all([reload(), reloadProgress()]).finally(() => setRefreshing(false));
                  }}
                />
              }
            >
              {tab === 'active' && progress && all.length > 0 && (
                <View style={styles.stats}>
                  <StatTile label="Overall completion" value={`${progress.completion}%`} />
                  <StatTile label="Items completed" value={`${progress.itemsDone}/${progress.itemsTotal}`} />
                  <StatTile label="Quiz average" value={progress.quizAverage === null ? '—' : `${progress.quizAverage}%`} />
                </View>
              )}

              {tab === 'active' && progress && progress.recommendations.length > 0 && (
                <RecommendationsCard
                  items={progress.recommendations}
                  limit={2}
                  onOpen={(classId) => navigation.navigate('ModuleChapter', { classId })}
                />
              )}

              {classes.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>{tab === 'active' ? 'No classes yet' : 'No archived classes'}</Text>
                  {tab === 'active' && (
                    <>
                      <Text style={styles.emptyText}>Ask your instructor for the class join code, then join here.</Text>
                      <PrimaryButton label="Join a class" onPress={openJoin} />
                    </>
                  )}
                </View>
              )}

              <Grid>
              {classes.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => navigation.navigate('ModuleChapter', { classId: c.id })}
                  style={({ pressed }) => [styles.card, c.isArchived && { opacity: 0.65 }, pressed && { backgroundColor: colors.tableHeaderBg }]}
                  accessibilityRole="button"
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.code}>{c.subjectCode}</Text>
                    <Tag label={c.isArchived ? 'Archived' : `Section ${c.section}`} tone={c.isArchived ? 'neutral' : 'success'} />
                    <Text style={styles.term}>{termLabel(c.term, c.schoolYear)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{c.subjectName}</Text>
                  <Text style={styles.cardSubtitle}>{c.instructorName}</Text>
                  <View style={styles.progressRow}>
                    <ProgressBar pct={c.completion} />
                    <Text style={styles.progressPct}>{c.completion}%</Text>
                  </View>
                  <Text style={styles.meta}>
                    {c.itemsTotal === 0
                      ? 'No lessons published yet'
                      : `${c.itemsDone} of ${c.itemsTotal} lessons & quizzes completed · ${c.moduleCount} module${c.moduleCount === 1 ? '' : 's'}`}
                  </Text>
                </Pressable>
              ))}
              </Grid>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, flexGrow: 1 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  empty: { alignItems: 'stretch', gap: 10, paddingTop: 40 },
  emptyTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text, textAlign: 'center' },
  emptyText: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  code: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
  term: { flex: 1, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  cardTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text, marginBottom: 2 },
  cardSubtitle: { fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  progressPct: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.text, width: 36, textAlign: 'right' },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
});
