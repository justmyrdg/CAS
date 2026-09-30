import { Table, TableRow, Tag } from '../../components/ui';
import { BarList, ChartCard, ChartGrid, Donut, RISK_COLORS } from '../../components/charts';
import { useAuth } from '../../state/AuthContext';
import { RISK_LABELS, RISK_TONES, formatLastActive, useClassAnalytics } from '../../data/classAnalytics';

const AT_RISK_COLS = '1.3fr 120px 2fr 110px 120px';

// "Module quiz avg. 45%" and "Module quiz avg. 70%" are the same kind of reason: group by the words before the numbers.
function reasonKind(reason: string) {
  if (/behind class/.test(reason)) return 'Behind the class';
  if (/^No activity/.test(reason)) return 'Inactive 14+ days';
  if (/^Missed \d+ exam/.test(reason)) return 'Missed an exam';
  if (/^Missed \d+ quiz/.test(reason)) return 'Missed a quiz';
  return reason.replace(/\s*\d+%$/, '');
}

export default function AtRiskTab({ classId }: { classId: string }) {
  const { accessToken } = useAuth();
  const { data, error } = useClassAnalytics(classId, accessToken);

  if (error) return <div style={{ color: 'var(--danger-text)' }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>;

  const reasons = new Map<string, number>();
  for (const s of data.students) for (const r of new Set(s.reasons.map(reasonKind))) reasons.set(r, (reasons.get(r) ?? 0) + 1);

  return (
    <>
      <ChartGrid columns="minmax(0, 1fr) minmax(0, 1fr)">
        <ChartCard title="Risk levels" subtitle={`${data.studentCount} student${data.studentCount === 1 ? '' : 's'}`}>
          <Donut
            segments={[
              { label: 'High risk', value: data.riskCounts.HIGH, color: RISK_COLORS.HIGH },
              { label: 'Moderate', value: data.riskCounts.MODERATE, color: RISK_COLORS.MODERATE },
              { label: 'Low risk', value: data.riskCounts.LOW, color: RISK_COLORS.LOW },
            ]}
            centerLabel="students"
            emptyText="No students yet"
          />
        </ChartCard>
        <ChartCard title="Why students are flagged" subtitle="Students per reason (one student can have several)">
          <BarList
            rows={[...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))}
            max={Math.max(data.studentCount, 1)}
            color={RISK_COLORS.HIGH}
            emptyText="No one is flagged right now."
          />
        </ChartCard>
      </ChartGrid>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Flagged when: module-quiz average, or average on your own quizzes &amp; exams, is below 60% (high) or 75% (moderate) · missed
        an exam after it closed (high) or a quiz (moderate) · no activity for 14+ days · not started a week after joining · 25+ points
        behind the class's average completion (40+ is high).
      </div>

      {data.studentCount === 0 ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          No students in this class yet.
        </div>
      ) : (
        <Table columns={['Student', 'Risk level', 'Reasons', 'Completion', 'Last active']} gridTemplateColumns={AT_RISK_COLS}>
          {data.students.map((s) => (
            <TableRow
              key={s.studentId}
              gridTemplateColumns={AT_RISK_COLS}
              faded={s.risk === 'LOW'}
              columns={[
                <div key="n">
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>{s.srCode}</div>
                </div>,
                <Tag key="r" tone={RISK_TONES[s.risk]}>
                  {RISK_LABELS[s.risk]}
                </Tag>,
                s.reasons.length > 0 ? (
                  <div key="why" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.reasons.map((r) => (
                      <Tag key={r}>{r}</Tag>
                    ))}
                  </div>
                ) : (
                  <span key="none" style={{ color: 'var(--text-faint)' }}>—</span>
                ),
                `${s.completion}%`,
                formatLastActive(s.lastActivity),
              ]}
            />
          ))}
        </Table>
      )}
    </>
  );
}
