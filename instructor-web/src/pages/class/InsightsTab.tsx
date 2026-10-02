import { Table, TableRow, Tag } from '../../components/ui';
import {
  CHART_COLORS,
  ChartCard,
  ChartGrid,
  ColumnChart,
  Donut,
  ForecastChart,
  KpiCard,
  KpiGrid,
  KpiIcons,
  RISK_COLORS,
  SCORE_BAND_COLORS,
  SCORE_BAND_LABELS,
} from '../../components/charts';
import { RecommendationList } from '../../components/Recommendations';
import { useAuth } from '../../state/AuthContext';
import { useClassAnalytics } from '../../data/classAnalytics';
import type { Prediction } from '../../data/classAnalytics';

// Predictive + prescriptive analytics for one class: where each student and the class are heading by the end of
// term, and what to do about it. The model is in backend utils/predictive.ts, the rules in utils/prescriptive.ts.

const COLS = '1.4fr 150px 120px 130px 100px 2fr';
const RISK_TAG = { HIGH: { tone: 'danger', label: 'Likely to fail' }, MODERATE: { tone: 'warning', label: 'Borderline' }, LOW: { tone: 'success', label: 'Likely to pass' } } as const;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function scoreText(p: Prediction) {
  return p.predictedScore === null ? '—' : `${p.predictedScore}%`;
}

export default function InsightsTab({ classId }: { classId: string }) {
  const { accessToken } = useAuth();
  const { data, error } = useClassAnalytics(classId, accessToken);

  if (error) return <div style={{ color: 'var(--danger-text)' }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>;
  if (data.studentCount === 0) {
    return (
      <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        No students yet. Forecasts appear once students join and start working.
      </div>
    );
  }

  const f = data.forecast;
  const end = date(f.termEnd);
  const students = [...data.students].sort((a, b) => b.prediction.failProbability - a.prediction.failProbability || a.name.localeCompare(b.name));
  const predictedCount = f.scoreBands.reduce((a, b) => a + b, 0);

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6, maxWidth: 900 }}>
        <b style={{ color: 'var(--text)' }}>Predictive</b> — where each student is heading by the end of term ({end}), from their pace, quiz and exam
        scores, score trend and missed work. <b style={{ color: 'var(--text)' }}>Prescriptive</b> — the actions most likely to help, ranked by urgency.
      </div>

      <KpiGrid>
        <KpiCard icon={KpiIcons.score} label="Predicted class average" value={f.predictedAverage === null ? '—' : `${f.predictedAverage}%`} hint="Expected final score" />
        <KpiCard icon={KpiIcons.progress} label={`Projected completion by ${end}`} value={f.projectedCompletion === null ? '—' : `${f.projectedCompletion}%`} hint={`Now ${data.completionRate ?? 0}%`} />
        <KpiCard icon={KpiIcons.check} label="On track to finish" value={`${f.onTrack} of ${data.studentCount}`} />
        <KpiCard icon={KpiIcons.alert} label="Predicted to fail" value={`${f.riskCounts.HIGH}`} tone={f.riskCounts.HIGH ? 'danger' : 'default'} hint="50%+ chance of scoring under 60%" />
      </KpiGrid>

      <ChartGrid columns="minmax(0, 1.4fr) minmax(0, 1fr)">
        <ChartCard title="Recommended actions" subtitle="What to do next for this class, most urgent first">
          <RecommendationList items={data.recommendations} empty="No actions needed right now." />
        </ChartCard>
        <ChartCard title="Class completion forecast" subtitle={`Share of the subject completed, projected to ${end} at each student's current pace`}>
          <ForecastChart weeks={f.completion} targetLabel={`End of term · ${f.projectedCompletion ?? 0}%`} height={220} />
        </ChartCard>
      </ChartGrid>

      <ChartGrid columns="minmax(0, 1fr) minmax(0, 1fr)">
        <ChartCard title="Predicted final scores" subtitle={`${predictedCount} of ${data.studentCount} students have enough scores to predict`}>
          <ColumnChart
            groups={SCORE_BAND_LABELS.map((label, i) => ({ label, values: [f.scoreBands[i]] }))}
            series={[{ label: 'Students', color: CHART_COLORS.green }]}
            colorFor={(gi) => SCORE_BAND_COLORS[gi]}
            height={200}
            emptyText="No scores yet"
          />
        </ChartCard>
        <ChartCard title="Predicted outcome" subtitle="Chance of scoring under 60% on the final">
          <Donut
            segments={[
              { label: 'Likely to fail (50%+)', value: f.riskCounts.HIGH, color: RISK_COLORS.HIGH },
              { label: 'Borderline (25–49%)', value: f.riskCounts.MODERATE, color: RISK_COLORS.MODERATE },
              { label: 'Likely to pass (<25%)', value: f.riskCounts.LOW, color: RISK_COLORS.LOW },
            ]}
            centerLabel="students"
          />
        </ChartCard>
      </ChartGrid>

      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', margin: '10px 0 12px' }}>Forecast per student</div>
      <Table columns={['Student', 'Predicted final', 'Chance of failing', `Done by ${end}`, 'Confidence', 'Suggested action']} gridTemplateColumns={COLS}>
        {students.map((s) => {
          const p = s.prediction;
          return (
            <TableRow
              key={s.studentId}
              gridTemplateColumns={COLS}
              columns={[
                <div key="n" title={p.factors.join(' · ')}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.factors.join(' · ') || '—'}</div>
                </div>,
                <div key="s">
                  <div style={{ fontWeight: 600 }}>{scoreText(p)}</div>
                  {p.scoreLow !== null && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      likely {p.scoreLow}–{p.scoreHigh}%
                    </div>
                  )}
                </div>,
                <div key="f" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600 }}>{p.failProbability}%</span>
                  <Tag tone={RISK_TAG[p.predictedRisk].tone}>{RISK_TAG[p.predictedRisk].label}</Tag>
                </div>,
                <div key="c">
                  <div style={{ fontWeight: 600, color: p.onTrack ? 'var(--text)' : 'var(--danger-text)' }}>{p.projectedCompletion}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.onTrack ? (p.projectedFinish && s.completion < 100 ? `done ~${date(p.projectedFinish)}` : 'finished') : `${p.pacePerWeek} items/week`}
                  </div>
                </div>,
                <Tag key="k" tone={p.confidence === 'HIGH' ? 'success' : p.confidence === 'MEDIUM' ? 'neutral' : 'warning'}>
                  {p.confidence === 'HIGH' ? 'High' : p.confidence === 'MEDIUM' ? 'Medium' : 'Low'}
                </Tag>,
                s.actions.length ? (
                  <ul key="a" style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
                    {s.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <span key="a" style={{ color: 'var(--text-faint)' }}>
                    No action needed
                  </span>
                ),
              ]}
            />
          );
        })}
      </Table>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6, maxWidth: 900 }}>
        How the forecast works: pace = items finished per week (last 4 weeks weighted 60%); expected final = 60% your quizzes &amp; exams + 40% chapter
        quizzes, adjusted for the recent score trend, unfinished work and missed exams; the range is an 80% interval that narrows as more scores come
        in. Confidence: High = 6+ scores, Medium = 3–5, Low = fewer.
      </div>
    </>
  );
}
