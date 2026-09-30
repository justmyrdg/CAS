import { Link } from 'react-router-dom';
import { Table, TableRow, Tag } from '../../components/ui';
import {
  BarList,
  CHART_COLORS,
  ChartCard,
  ChartGrid,
  ColumnChart,
  KpiCard,
  KpiGrid,
  KpiIcons,
  Legend,
  SCORE_BAND_COLORS,
  SCORE_BAND_LABELS,
  TrendChart,
} from '../../components/charts';
import { useAuth } from '../../state/AuthContext';
import { formatLastActive, useClassAnalytics } from '../../data/classAnalytics';

const STUDENT_COLS = '1.5fr 100px 1.3fr 100px 80px 120px 110px';
const ASSESSMENT_COLS = '1.8fr 80px 130px 110px 110px';
const bandCounts = (values: number[]) =>
  [
    [0, 59],
    [60, 74],
    [75, 89],
    [90, 100],
  ].map(([from, to]) => values.filter((v) => v >= from && v <= to).length);

export default function PerformanceTab({ classId }: { classId: string }) {
  const { accessToken } = useAuth();
  const { data, error } = useClassAnalytics(classId, accessToken);

  if (error) return <div style={{ color: 'var(--danger-text)' }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>;
  if (data.studentCount === 0) {
    return <Empty text="No students yet. Performance appears once students join and start working through the lessons." />;
  }
  if (data.itemsTotal === 0 && data.assessments.length === 0) {
    return <Empty text="This subject has no lessons or quizzes yet, and you haven't published a quiz or exam, so there's nothing to measure." />;
  }

  const quizAverages = data.students.map((s) => s.quizAverage).filter((v): v is number => v !== null);

  return (
    <>
      <KpiGrid>
        <KpiCard icon={KpiIcons.students} value={`${data.studentCount}`} label="Students" />
        <KpiCard icon={KpiIcons.progress} value={data.completionRate === null ? '—' : `${data.completionRate}%`} label="Average completion" />
        <KpiCard icon={KpiIcons.score} value={data.averageScore === null ? '—' : `${data.averageScore}%`} label="Average module quiz score" />
        <KpiCard icon={KpiIcons.check} value={data.assessmentAverage === null ? '—' : `${data.assessmentAverage}%`} label="Average on your quizzes & exams" />
      </KpiGrid>

      <ChartGrid columns="minmax(0, 2fr) minmax(0, 1fr)">
        <ChartCard title="Class activity" subtitle="What this class's students did each week">
          <TrendChart weeks={data.trend} />
        </ChartCard>
        <ChartCard title="Module quiz averages" subtitle={`${quizAverages.length} of ${data.studentCount} students have taken a quiz`}>
          <ColumnChart
            groups={SCORE_BAND_LABELS.map((label, i) => ({ label, values: [bandCounts(quizAverages)[i]] }))}
            series={[{ label: 'Students', color: CHART_COLORS.green }]}
            colorFor={(gi) => SCORE_BAND_COLORS[gi]}
            height={200}
            emptyText="No quiz attempts yet"
          />
        </ChartCard>
      </ChartGrid>

      <ChartGrid columns={data.assessments.length > 0 ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)'}>
        <ChartCard title="Completion by module" subtitle="Average share of each module the class has finished">
          <BarList rows={data.modules.map((m) => ({ label: m.title, value: m.itemsTotal === 0 ? null : m.completion }))} max={100} unit="%" emptyText="No modules yet." />
          <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: '12px 14px', marginTop: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>Lowest performing topic</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {data.lowestTopic
                ? `${data.lowestTopic.chapterTitle} (${data.lowestTopic.moduleTitle}) — quiz average ${data.lowestTopic.average}%`
                : 'No quiz attempts yet.'}
            </div>
          </div>
        </ChartCard>
        {data.assessments.length > 0 && (
          <ChartCard title="Your quizzes & exams" subtitle="Class average on each (best graded attempt per student)">
            <ColumnChart
              groups={data.assessments.map((a) => ({
                label: a.title,
                hint: `${a.kind === 'EXAM' ? 'Exam' : 'Quiz'} · ${a.submitted} of ${data.studentCount} submitted`,
                values: [a.average],
              }))}
              series={[{ label: 'Class average', color: CHART_COLORS.blue }]}
              colorFor={(gi) => (data.assessments[gi].kind === 'EXAM' ? CHART_COLORS.red : CHART_COLORS.blue)}
              max={100}
              unit="%"
              emptyText="No graded submissions yet"
            />
            <Legend
              items={[
                { label: 'Quiz', color: CHART_COLORS.blue },
                { label: 'Exam', color: CHART_COLORS.red },
              ]}
            />
          </ChartCard>
        )}
      </ChartGrid>

      {data.assessments.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', margin: '10px 0 12px' }}>Your quizzes &amp; exams</div>
          <Table columns={['Title', 'Type', 'Submitted', 'Class average', 'To grade']} gridTemplateColumns={ASSESSMENT_COLS}>
            {data.assessments.map((a) => (
              <TableRow
                key={a.id}
                gridTemplateColumns={ASSESSMENT_COLS}
                columns={[
                  <Link key="t" to={`/classes/${classId}/assessments/${a.id}`} style={{ fontWeight: 600 }}>
                    {a.title}
                  </Link>,
                  <Tag key="k" tone={a.kind === 'EXAM' ? 'danger' : 'success'}>
                    {a.kind === 'EXAM' ? 'Exam' : 'Quiz'}
                  </Tag>,
                  `${a.submitted} of ${data.studentCount}`,
                  a.average === null ? '—' : `${a.average}%`,
                  a.toGrade > 0 ? (
                    <span key="g" style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
                      {a.toGrade}
                    </span>
                  ) : (
                    '—'
                  ),
                ]}
              />
            ))}
          </Table>
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>Students</div>
      <Table columns={['Student', 'SR code', 'Completion', 'Module quiz avg.', 'Quizzes', 'Quiz & exam avg.', 'Last active']} gridTemplateColumns={STUDENT_COLS}>
        {data.students.map((s) => (
          <TableRow
            key={s.studentId}
            gridTemplateColumns={STUDENT_COLS}
            columns={[
              <span key="n" style={{ fontWeight: 600 }}>{s.name}</span>,
              <span key="sr" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{s.srCode ?? '—'}</span>,
              <div key="c" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 20 }}>
                <Bar pct={s.completion} />
                <span style={{ width: 36, textAlign: 'right' }}>{s.completion}%</span>
              </div>,
              s.quizAverage === null ? '—' : `${s.quizAverage}%`,
              s.quizzesTaken,
              s.assessmentAverage === null ? (s.assessmentsTaken ? 'Grading…' : '—') : `${s.assessmentAverage}%`,
              formatLastActive(s.lastActivity),
            ]}
          />
        ))}
      </Table>
    </>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ flex: 1, height: 6, background: 'var(--primary-light)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)' }} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
      {text}
    </div>
  );
}
