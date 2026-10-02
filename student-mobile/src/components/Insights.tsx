import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import type { ClassOutlook, StudentRecommendation } from '../lib/studentApi';
import { Card, SectionTitle, Tag } from './ui';

// Predictive (outlook per class) and prescriptive (recommended next steps) analytics for the student — computed by
// the backend (utils/predictive.ts and utils/prescriptive.ts) and returned with GET /api/student/progress.

const PRIORITY = {
  1: { label: 'Do now', tone: 'danger' },
  2: { label: 'This week', tone: 'warning' },
  3: { label: 'Suggested', tone: 'success' },
} as const;

const STATUS = {
  ON_TRACK: { label: 'On track', tone: 'success' },
  NEEDS_ATTENTION: { label: 'Needs attention', tone: 'warning' },
  AT_RISK: { label: 'At risk', tone: 'danger' },
} as const;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function RecommendationsCard({
  items,
  onOpen,
  limit,
}: {
  items: StudentRecommendation[];
  onOpen?: (classId: string) => void;
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <Card style={{ paddingBottom: 4 }}>
      <SectionTitle title="Recommended for you" />
      {shown.length === 0 && <Text style={[styles.muted, { marginBottom: 12 }]}>No recommendations right now.</Text>}
      {shown.map((r, i) => (
        <Pressable
          key={`${r.classId}-${i}`}
          disabled={!onOpen}
          onPress={() => onOpen?.(r.classId)}
          style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.6 }]}
          accessibilityRole={onOpen ? 'button' : undefined}
        >
          <View style={styles.rowTop}>
            <Tag label={PRIORITY[r.priority].label} tone={PRIORITY[r.priority].tone} />
            <Text style={styles.code}>{r.subjectCode}</Text>
          </View>
          <Text style={styles.title}>{r.title}</Text>
          <Text style={styles.detail}>{r.detail}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

export function OutlookCard({ items }: { items: ClassOutlook[] }) {
  if (!items.length) return null;
  return (
    <Card style={{ paddingBottom: 4 }}>
      <SectionTitle title="Outlook" right={<Text style={styles.muted}>By end of term</Text>} />
      {items.map((o, i) => (
        <View key={o.classId} style={[styles.row, i > 0 && styles.rowBorder]}>
          <View style={styles.rowTop}>
            <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
              {o.subjectCode} · {o.subjectName}
            </Text>
            <Tag label={STATUS[o.status].label} tone={STATUS[o.status].tone} />
          </View>
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{o.predictedScore === null ? '—' : `${o.predictedScore}%`}</Text>
              <Text style={styles.figureLabel}>{o.scoreLow !== null ? `Predicted final (${o.scoreLow}–${o.scoreHigh}%)` : 'Predicted final'}</Text>
            </View>
            <View style={styles.figure}>
              <Text style={[styles.figureValue, !o.onTrack && { color: colors.danger }]}>{o.projectedCompletion}%</Text>
              <Text style={styles.figureLabel}>Completed by {shortDate(o.termEnd)}</Text>
            </View>
          </View>
          <Text style={styles.detail}>
            {o.onTrack
              ? o.projectedCompletion >= 100 && o.projectedFinish
                ? `At your pace you will finish around ${shortDate(o.projectedFinish)}.`
                : 'You have finished every lesson and quiz.'
              : `At ${o.pacePerWeek} lessons or quizzes a week you will not finish by ${shortDate(o.termEnd)}.`}
            {o.factors.length ? ` Based on: ${o.factors.join('; ').toLowerCase()}.` : ''}
          </Text>
          {o.confidence === 'LOW' && <Text style={styles.note}>Early estimate — it becomes more reliable as you take more quizzes.</Text>}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMuted },
  row: { paddingVertical: 12, gap: 5 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.textMuted },
  title: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
  detail: { fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  note: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.warningText },
  figures: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  figure: { flex: 1, backgroundColor: colors.tableHeaderBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  figureValue: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  figureLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.textMuted, marginTop: 1 },
});
