import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { PrimaryButton, SecondaryButton, Table, TableRow } from '../components/ui';
import { CHART_COLORS, ChartCard, ChartGrid, ColumnChart, Donut, KpiCard, KpiGrid, KpiIcons, RISK_COLORS, TrendChart } from '../components/charts';
import type { TrendWeek } from '../components/charts';
import { RecommendationList } from '../components/Recommendations';
import type { RecommendationItem } from '../components/Recommendations';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { schoolYearLabel, termLabel } from '../data/classOptions';
import type { ClassRecord } from '../data/classOptions';

const RECENT_LIMIT = 5;

interface Summary {
  activeClasses: number;
  totalStudents: number;
  averageScore: number | null;
  atRiskStudents: number;
  trend: TrendWeek[];
  riskCounts: { HIGH: number; MODERATE: number; LOW: number };
  classes: { id: string; label: string; students: number; completion: number | null; averageScore: number | null; assessmentAverage: number | null }[];
  predictedToFail: number;
  recommendations: (RecommendationItem & { classId: string })[];
}
const CLASS_COLS = '110px 1.6fr 90px 1.3fr 90px 120px';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [recent, setRecent] = useState<ClassRecord[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeTotal = summary?.activeClasses ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest<{ classes: ClassRecord[] }>(`/api/instructor/classes?status=active&pageSize=${RECENT_LIMIT}`, {
        token: accessToken,
      }),
      apiRequest<Summary>('/api/instructor/classes/summary', { token: accessToken }),
    ])
      .then(([list, counts]) => {
        if (cancelled) return;
        setRecent(list.classes);
        setSummary(counts);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load classes');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
  const weekTotal = (w: TrendWeek | undefined) => (w ? w.lessons + w.quizzes + w.assessments : 0);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Welcome back</div>
          <div style={{ fontWeight: 700, fontSize: 24, color: 'var(--text)' }}>{user?.fullName}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <PrimaryButton onClick={() => navigate('/classes?new=1')}>+ Create Class</PrimaryButton>
          <SecondaryButton onClick={() => navigate('/classes')}>View All Classes</SecondaryButton>
        </div>
      </div>

      <KpiGrid columns={5}>
        <KpiCard icon={KpiIcons.classes} label="Active classes" value={summary ? String(summary.activeClasses) : '—'} />
        <KpiCard icon={KpiIcons.students} label="Total students" value={summary ? String(summary.totalStudents) : '—'} />
        <KpiCard icon={KpiIcons.score} label="Avg. module quiz score" value={pct(summary?.averageScore)} />
        <KpiCard
          icon={KpiIcons.alert}
          label="At-risk students"
          value={summary ? String(summary.atRiskStudents) : '—'}
          hint="High or moderate risk"
          tone={summary?.atRiskStudents ? 'danger' : 'default'}
        />
        <KpiCard
          icon={KpiIcons.progress}
          label="Predicted to fail"
          value={summary ? String(summary.predictedToFail) : '—'}
          hint="Forecast to end of term"
          tone={summary?.predictedToFail ? 'danger' : 'default'}
        />
      </KpiGrid>

      {summary && (
        <>
          <ChartGrid columns="minmax(0, 2fr) minmax(0, 1fr)">
            <ChartCard
              title="Student activity"
              subtitle="Across your active classes, per week"
              right={
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{weekTotal(summary.trend.at(-1))}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>this week · {weekTotal(summary.trend.at(-2))} last week</div>
                </div>
              }
            >
              <TrendChart weeks={summary.trend} />
            </ChartCard>
            <ChartCard title="Risk overview" subtitle="Your students, per class they're in">
              <Donut
                segments={[
                  { label: 'High risk', value: summary.riskCounts.HIGH, color: RISK_COLORS.HIGH },
                  { label: 'Moderate', value: summary.riskCounts.MODERATE, color: RISK_COLORS.MODERATE },
                  { label: 'Low risk', value: summary.riskCounts.LOW, color: RISK_COLORS.LOW },
                ]}
                centerLabel="students"
                emptyText="No students yet"
              />
            </ChartCard>
          </ChartGrid>
          <ChartGrid columns="minmax(0, 1fr) minmax(0, 1fr)" style={{ marginBottom: 28 }}>
            <ChartCard title="Recommended actions" subtitle="The most urgent across your classes — open a class's Insights tab for more">
              <RecommendationList
                items={summary.recommendations}
                empty="No actions needed right now."
                action={(r) => (
                  <SecondaryButton
                    onClick={() => navigate(`/classes/${(r as RecommendationItem & { classId: string }).classId}/insights`)}
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  >
                    Open
                  </SecondaryButton>
                )}
              />
            </ChartCard>
            <ChartCard title="Your classes compared" subtitle="Average completion, module-quiz score and score on your own quizzes & exams">
              <ColumnChart
                groups={summary.classes.map((c) => ({
                  label: c.label,
                  hint: `${c.students} student${c.students === 1 ? '' : 's'}`,
                  values: [c.completion, c.averageScore, c.assessmentAverage],
                }))}
                series={[
                  { label: 'Avg. completion', color: CHART_COLORS.green },
                  { label: 'Module quiz avg.', color: CHART_COLORS.amber },
                  { label: 'Your quizzes & exams avg.', color: CHART_COLORS.blue },
                ]}
                max={100}
                unit="%"
                emptyText="No active classes yet"
              />
            </ChartCard>
          </ChartGrid>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Your classes</div>
        {activeTotal !== null && activeTotal > RECENT_LIMIT && (
          <button
            type="button"
            onClick={() => navigate('/classes')}
            style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            View all {activeTotal}
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{error}</div>}

      <Table columns={['Subject', 'Subject name', 'Section', 'Term', 'Students', '']} gridTemplateColumns={CLASS_COLS}>
        {recent?.map((c) => (
          <TableRow
            key={c.id}
            gridTemplateColumns={CLASS_COLS}
            columns={[
              <span key="code" style={{ fontWeight: 600 }}>{c.subjectCode}</span>,
              c.subjectName,
              c.section,
              `${termLabel(c.term)} · ${schoolYearLabel(c.schoolYear)}`,
              c.studentCount,
              <SecondaryButton key="view" onClick={() => navigate(`/classes/${c.id}`)} style={{ padding: '6px 12px' }}>
                View
              </SecondaryButton>,
            ]}
          />
        ))}
        {recent?.length === 0 && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            You have no active classes yet. Use “+ Create Class” to add one.
          </div>
        )}
      </Table>
    </Layout>
  );
}
