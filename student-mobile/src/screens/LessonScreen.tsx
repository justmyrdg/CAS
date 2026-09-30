import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { apiRequest, errorText } from '../lib/api';
import { useStudentData } from '../lib/studentApi';
import type { Lesson, LessonBlock } from '../lib/studentApi';
import { BackHeader, ErrorView, Loading, PrimaryButton } from '../components/ui';
import { HeadingBlock, TextBlock } from '../components/lessonBlocks/TextBlocks';
import ImageBlock from '../components/lessonBlocks/ImageBlock';
import VideoBlock from '../components/lessonBlocks/VideoBlock';
import CheckBlock from '../components/lessonBlocks/CheckBlock';
import ActivityCard from '../components/lessonBlocks/ActivityCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;

export default function LessonScreen({ navigation, route }: Props) {
  const { lessonId, crumb } = route.params;
  const { data, error, loading, reload } = useStudentData<{ lesson: Lesson }>(`/api/student/lessons/${lessonId}`);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Indexes of the check blocks answered during this visit (answers are never stored).
  const [answered, setAnswered] = useState<ReadonlySet<number>>(new Set());

  const lesson = data?.lesson;
  const checkCount = lesson ? lesson.blocks.filter((b) => b.type === 'check').length : 0;
  // Every check must be answered before completing — unless the lesson is already complete.
  const locked = !!lesson && !lesson.completedAt && answered.size < checkCount;

  function markAnswered(index: number) {
    setAnswered((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }

  async function finish() {
    if (!lesson) return;
    if (lesson.completedAt) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiRequest(`/api/student/lessons/${lessonId}/complete`, { method: 'POST' });
      navigation.goBack();
    } catch (err) {
      setSaveError(errorText(err, 'Unable to save your progress'));
      setSaving(false);
    }
  }

  function renderBlock(block: LessonBlock, index: number) {
    switch (block.type) {
      case 'heading':
        return <HeadingBlock key={index} text={block.text} />;
      case 'text':
        return <TextBlock key={index} text={block.text} />;
      case 'image':
        return <ImageBlock key={index} block={block} />;
      case 'video':
        return <VideoBlock key={index} block={block} />;
      case 'check':
        return <CheckBlock key={index} block={block} onAnswered={() => markAnswered(index)} />;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <BackHeader crumb={crumb} title={lesson?.title ?? 'Lesson'} onBack={() => navigation.goBack()}>
          {lesson?.completedAt && <Text style={styles.doneNote}>✓ You've completed this lesson</Text>}
        </BackHeader>
        {loading ? (
          <Loading />
        ) : !lesson ? (
          <ErrorView message={error ?? 'Unable to load lesson'} onRetry={() => void reload()} />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              {lesson.blocks.length === 0 ? <Text style={styles.empty}>This lesson has no content yet.</Text> : lesson.blocks.map(renderBlock)}
              {lesson.arModel && (
                <ActivityCard
                  name={lesson.arModel.name}
                  onOpen={() => navigation.navigate('ArViewer', { modelId: lesson.arModel!.id, modelName: lesson.arModel!.name })}
                />
              )}
            </ScrollView>
            <View style={styles.footer}>
              {saveError && <Text style={styles.error}>{saveError}</Text>}
              {locked && (
                <Text style={styles.lockNote}>
                  Answer all {checkCount} {checkCount === 1 ? 'check' : 'checks'} to finish ({answered.size}/{checkCount})
                </Text>
              )}
              <PrimaryButton
                label={lesson.completedAt ? 'Back to chapter' : saving ? 'Saving…' : 'Mark as complete'}
                onPress={() => void finish()}
                disabled={saving || locked}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  doneNote: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary, marginTop: 6 },
  body: { padding: 20, paddingBottom: 32, gap: 18 },
  empty: { fontFamily: fonts.bodyRegular, fontSize: 16, lineHeight: 26, color: colors.textMuted },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, textAlign: 'center' },
  lockNote: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
