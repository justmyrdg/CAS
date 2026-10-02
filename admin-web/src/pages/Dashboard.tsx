import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { PrimaryButton, SecondaryButton, Table, TableRow, Tag } from '../components/ui';
import {
  CHART_COLORS,
  ChartCard,
  ChartGrid,
  ColumnChart,
  Donut,
  KpiCard,
  KpiGrid,
  KpiIcons,
  RISK_COLORS,
  SCORE_BAND_COLORS,
  SCORE_BAND_LABELS,
  TrendChart,
} from '../components/charts';
import type { TrendWeek } from '../components/charts';
import { RecommendationList } from '../components/Recommendations';
import type { RecommendationItem } from '../components/Recommendations';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';

// The admin home: catalog and account counts, plus the institution overview across every active class
// (GET /api/admin/dashboard + GET /api/admin/reports — this page used to be two, Dashboard and Reports).

interface DashboardData {
  counts: {
    subjects: number;
    modules: number;
    lessons: number;
    quizzes: number;
    activeClasses: number;
    instructors: number;
    students: number;
  };
  activity: { text: string; at: string }[];
  trend: TrendWeek[];
  scoreBands: number[];
}

interface ReportsData {
  stats: {
    activeClasses: number;
    enrolledStudents: number;
    averageCompletion: number | null;
    averageScore: number | null;
    atRiskStudents: number;
  };
  riskCounts: { HIGH: number; MODERATE: number; LOW: number };
  completionBands: number[];
  classes: {
    id: string;
    label: string;
    instructorName: string;
    students: number;
    completion: number | null;
    averageScore: number | null;
    predictedAverage: number | null;
    projectedCompletion: number | null;
    predictedToFail: number;
  }[];
  // Predictive: where the active classes are heading by the end of term. Prescriptive: what to do about it.
  forecast: { predictedAverage: number | null; projectedCompletion: number | null; riskCounts: { HIGH: number; MODERATE: number; LOW: number } };
  recommendations: (RecommendationItem & { classId: string })[];
  subjects: { code: string; name: string; classes: number; students: number; averageCompletion: number | null; averageScore: number | null }[];
  flagged: { kind: 'STUDENT' | 'QUIZ'; title: string; detail: string; tag: string }[];
}

const SUBJECT_COLS = '100px 1.6fr 90px 90px 1.2fr 110px';
const COMPLETION_BANDS = ['0–24%', '25–49%', '50–74%', '75–99%', 'Done'];
const COMPLETION_COLORS = ['#C9DCD1', '#9FC7B2', CHART_COLORS.mint, '#3E8E6D', CHART_COLORS.green];
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [report, setReport] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fail = (err: unknown) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load the dashboard');
    };
    apiRequest<DashboardData>('/api/admin/dashboard', { token: accessToken })
      .then((result) => !cancelled && setData(result))
      .catch(fail);
    // The overview reads every class's analytics, so it can arrive a moment later.
    apiRequest<ReportsData>('/api/admin/reports', { token: accessToken })
      .then((result) => !cancelled && setReport(result))
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const c = data?.counts;
  const value = (n: number | undefined) => (n === undefined ? '—' : String(n));
  const weekTotal = (w: TrendWeek | undefined) => (w ? w.lessons + w.quizzes + w.assessments : 0);
  const attempts = data?.scoreBands.reduce((a, b) => a + b, 0) ?? 0;
  const enrollments = report ? report.riskCounts.HIGH + report.riskCounts.MODERATE + report.riskCounts.LOW : 0;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>Welcome back{user ? `, ${user.firstName}` : ''}</div>
          <div style={{ fontWeight: 700, fontSize: 24, color: 'var(--text)' }}>Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Across all active classes · quiz scores use each student's best attempt</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PrimaryButton onClick={() => navigate('/subjects?new=1')}>+ New Subject</PrimaryButton>
          <SecondaryButton onClick={() => navigate('/ar-library?new=1')}>+ Upload AR Model</SecondaryButton>
          <SecondaryButton onClick={() => navigate('/instructors')}>+ Add Instructor</SecondaryButton>
          <SecondaryButton onClick={() => navigate('/students')}>+ Add Student</SecondaryButton>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{error}</div>}

      <KpiGrid>
        <KpiCard icon={KpiIcons.book} value={value(c?.subjects)} label="Subjects" hint={c ? `${c.modules} modules · ${c.lessons} lessons · ${c.quizzes} quizzes` : undefined} />
        <KpiCard icon={KpiIcons.classes} value={value(c?.activeClasses)} label="Active classes" />
        <KpiCard icon={KpiIcons.teacher} value={value(c?.instructors)} label="Instructors" />
        <KpiCard icon={KpiIcons.students} value={value(c?.students)} label="Students" hint={report ? `${report.stats.enrolledStudents} enrolled in active classes` : undefined} />
        <KpiCard icon={KpiIcons.progress} value={report ? pct(report.stats.averageCompletion) : '—'} label="Avg. completion" />
        <KpiCard icon={KpiIcons.score} value={report ? pct(report.stats.averageScore) : '—'} label="Avg. module quiz score" />
        <KpiCard
          icon={KpiIcons.check}
          value={report ? String(report.forecast.riskCounts.HIGH) : '—'}
          label="Predicted to fail"
          hint={report ? `Forecast final avg. ${pct(report.forecast.predictedAverage)}` : undefined}
          tone={report && report.forecast.riskCounts.HIGH > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          icon={KpiIcons.alert}
          value={report ? String(report.stats.atRiskStudents) : '—'}
          label="High-risk students"
          tone={report && report.stats.atRiskStudents > 0 ? 'danger' : 'default'}
        />
      </KpiGrid>

      {data && (
        <ChartGrid columns="minmax(0, 2fr) minmax(0, 1fr)">
          <ChartCard
            title="Learning activity"
            subtitle="Across every class, per week, for the last 12 weeks"
            right={
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{weekTotal(data.trend.at(-1))}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>this week · {weekTotal(data.trend.at(-2))} last week</div>
              </div>
            }
          >
            <TrendChart weeks={data.trend} />
          </ChartCard>
          <ChartCard title="Students at risk" subtitle={report ? `${enrollments} class enrollment${enrollments === 1 ? '' : 's'}` : 'Loading…'}>
            {report && (
              <Donut
                segments={[
                  { label: 'High risk', value: report.riskCounts.HIGH, color: RISK_COLORS.HIGH },
                  { label: 'Moderate', value: report.riskCounts.MODERATE, color: RISK_COLORS.MODERATE },
                  { label: 'Low risk', value: report.riskCounts.LOW, color: RISK_COLORS.LOW },
                ]}
                centerLabel="students"
                emptyText="No students yet"
              />
            )}
          </ChartCard>
        </ChartGrid>
      )}

      {report && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Forecast &amp; recommended actions</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Predicted from each student's pace, scores, score trend and missed work, to the end of term
            </div>
          </div>
          <ChartGrid columns="minmax(0, 2fr) minmax(0, 1fr)">
            <ChartCard title="Classes: now vs. end of term" subtitle="Current completion, projected completion and predicted final score">
              <ColumnChart
                groups={report.classes.map((cl) => ({
                  label: cl.label,
                  hint: `${cl.instructorName} · ${cl.predictedToFail} predicted to fail`,
                  values: [cl.completion, cl.projectedCompletion, cl.predictedAverage],
                }))}
                series={[
                  { label: 'Completion now', color: CHART_COLORS.mint },
                  { label: 'Projected completion', color: CHART_COLORS.green },
                  { label: 'Predicted final score', color: CHART_COLORS.blue },
                ]}
                max={100}
                unit="%"
                emptyText="No active classes yet"
              />
            </ChartCard>
            <ChartCard title="Predicted outcome" subtitle="Chance of scoring under 60% on the final">
              <Donut
                segments={[
                  { label: 'Likely to fail (50%+)', value: report.forecast.riskCounts.HIGH, color: RISK_COLORS.HIGH },
                  { label: 'Borderline (25–49%)', value: report.forecast.riskCounts.MODERATE, color: RISK_COLORS.MODERATE },
                  { label: 'Likely to pass', value: report.forecast.riskCounts.LOW, color: RISK_COLORS.LOW },
                ]}
                centerValue={pct(report.forecast.projectedCompletion)}
                centerLabel="projected done"
                emptyText="No students yet"
              />
            </ChartCard>
          </ChartGrid>
          <ChartGrid columns="minmax(0, 1fr)">
            <ChartCard title="Recommended actions" subtitle="The most urgent across all classes">
              <RecommendationList items={report.recommendations} empty="No actions needed right now." />
            </ChartCard>
          </ChartGrid>
        </>
      )}

      {report && data && (
        <>
          <ChartGrid columns="minmax(0, 2fr) minmax(0, 1fr)">
            <ChartCard title="Subjects compared" subtitle="Average completion and module-quiz score per subject">
              <ColumnChart
                groups={report.subjects.map((s) => ({ label: s.code, hint: `${s.name} · ${s.students} students`, values: [s.averageCompletion, s.averageScore] }))}
                series={[
                  { label: 'Avg. completion', color: CHART_COLORS.green },
                  { label: 'Avg. quiz score', color: CHART_COLORS.amber },
                ]}
                max={100}
                unit="%"
                emptyText="No active classes yet"
              />
            </ChartCard>
            <ChartCard title="Module quiz results" subtitle="Every attempt, by score">
              <Donut
                segments={SCORE_BAND_LABELS.map((label, i) => ({ label, value: data.scoreBands[i], color: SCORE_BAND_COLORS[i] }))}
                centerValue={String(attempts)}
                centerLabel={attempts === 1 ? 'attempt' : 'attempts'}
                emptyText="No attempts yet"
              />
            </ChartCard>
          </ChartGrid>

          <ChartGrid columns="minmax(0, 1fr) minmax(0, 2fr)">
            <ChartCard title="How far students are" subtitle="Share of their subject completed">
              <ColumnChart
                groups={COMPLETION_BANDS.map((label, i) => ({ label, values: [report.completionBands[i]] }))}
                series={[{ label: 'Students', color: CHART_COLORS.green }]}
                colorFor={(gi) => COMPLETION_COLORS[gi]}
                emptyText="No students yet"
              />
            </ChartCard>
            <ChartCard title="Classes compared" subtitle="Average completion and module-quiz score per class">
              <ColumnChart
                groups={report.classes.map((cl) => ({ label: cl.label, hint: `${cl.instructorName} · ${cl.students} students`, values: [cl.completion, cl.averageScore] }))}
                series={[
                  { label: 'Avg. completion', color: CHART_COLORS.green },
                  { label: 'Avg. quiz score', color: CHART_COLORS.amber },
                ]}
                max={100}
                unit="%"
                emptyText="No active classes yet"
              />
            </ChartCard>
          </ChartGrid>

          <ChartGrid columns="minmax(0, 1fr) minmax(0, 1fr)">
            <ChartCard title="Flagged for review" subtitle="High-risk students and unusually hard quizzes">
              {report.flagged.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing flagged — no high-risk students or unusually hard quizzes.</div>
              ) : (
                <List>
                  {report.flagged.map((item, i) => (
                    <ListRow key={i} first={i === 0}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.detail}</div>
                      </div>
                      <Tag tone={item.kind === 'STUDENT' ? 'danger' : 'warning'}>{item.tag}</Tag>
                    </ListRow>
                  ))}
                </List>
              )}
            </ChartCard>
            <ChartCard title="Recent activity">
              {data.activity.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing yet.</div>
              ) : (
                <List>
                  {data.activity.map((a, i) => (
                    <ListRow key={i} first={i === 0}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{a.text}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(a.at)}</div>
                    </ListRow>
                  ))}
                </List>
              )}
            </ChartCard>
          </ChartGrid>

          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', margin: '10px 0 12px' }}>By subject</div>
          <Table columns={['Subject', 'Name', 'Classes', 'Students', 'Avg. completion', 'Avg. score']} gridTemplateColumns={SUBJECT_COLS}>
            {report.subjects.map((s) => (
              <TableRow
                key={s.code}
                gridTemplateColumns={SUBJECT_COLS}
                columns={[
                  <span key="c" style={{ fontWeight: 600 }}>{s.code}</span>,
                  s.name,
                  s.classes,
                  s.students,
                  <div key="bar" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--primary-light)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.averageCompletion ?? 0}%`, background: 'var(--primary)' }} />
                    </div>
                    <span style={{ width: 36, textAlign: 'right' }}>{pct(s.averageCompletion)}</span>
                  </div>,
                  pct(s.averageScore),
                ]}
              />
            ))}
            {report.subjects.length === 0 && (
              <div style={{ padding: '20px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>No active classes yet.</div>
            )}
          </Table>
        </>
      )}
    </Layout>
  );
}

function List({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>{children}</div>;
}

function ListRow({ children, first }: { children: ReactNode; first: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: first ? 'none' : '1px solid var(--border-light)' }}>{children}</div>
  );
}
