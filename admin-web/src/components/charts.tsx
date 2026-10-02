import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

// Small hand-drawn SVG charts for the dashboards and analytics (no chart library). instructor-web has a copy of this
// file — keep the two in sync by hand, like ui.tsx.

export const CHART_COLORS = {
  green: '#1F6D52',
  mint: '#6FBF9B',
  amber: '#E0A33B',
  blue: '#5B7FB8',
  red: '#C4553D',
  grid: '#ECEAE2',
  axis: '#9CA8A1',
} as const;

// The three kinds of learning activity, in the same colors everywhere.
export const ACTIVITY_SERIES = [
  { key: 'lessons', label: 'Lessons completed', color: CHART_COLORS.green },
  { key: 'quizzes', label: 'Module quizzes taken', color: CHART_COLORS.amber },
  { key: 'assessments', label: 'Class quizzes & exams', color: CHART_COLORS.blue },
] as const;

export const RISK_COLORS = { HIGH: CHART_COLORS.red, MODERATE: CHART_COLORS.amber, LOW: CHART_COLORS.mint } as const;
export const SCORE_BAND_LABELS = ['Below 60%', '60–74%', '75–89%', '90–100%'];
export const SCORE_BAND_COLORS = [CHART_COLORS.red, CHART_COLORS.amber, CHART_COLORS.mint, CHART_COLORS.green];

export interface TrendWeek {
  weekStart: string;
  lessons: number;
  quizzes: number;
  assessments: number;
}

// ---------- helpers ----------

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// 0 → 4, 7 → 8, 23 → 25, 140 → 150: a round axis maximum that splits into 4 ticks.
export function niceMax(value: number) {
  if (value <= 4) return 4;
  const step = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const nice = [1, 2, 2.5, 5, 10].find((n) => n * magnitude >= step) ?? 10;
  return nice * magnitude * 4;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function weekLabel(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// A smooth line through the points; control points stay level with their point, so it never overshoots.
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const mid = (x1 - x0) / 2;
    d += ` C${x0 + mid},${y0} ${x1 - mid},${y1} ${x1},${y1}`;
  }
  return d;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: y,
        transform: 'translate(-50%, -100%)',
        background: 'var(--primary-dark)',
        color: '#fff',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: 1.5,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 6px 18px rgba(18,60,44,0.25)',
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
}

function Swatch({ color, round }: { color: string; round?: boolean }) {
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: round ? 5 : 2, background: color, flexShrink: 0 }} />;
}

// ---------- layout ----------

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// Responsive grid of chart cards: `columns` like '2fr 1fr'.
export function ChartGrid({ columns, children, style }: { columns: string; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 18, alignItems: 'stretch', marginBottom: 18, ...style }}>{children}</div>;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Swatch color={i.color} round />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// A headline number on a white card, with an optional icon, hint line and tone.
export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger' | 'good';
}) {
  const accent = tone === 'danger' ? 'var(--danger-text)' : 'var(--primary)';
  const tint = tone === 'danger' ? 'var(--danger-bg)' : 'var(--primary-light)';
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        minWidth: 0,
      }}
    >
      {icon && (
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: tint,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 24, lineHeight: 1.25, color: tone === 'danger' ? 'var(--danger-text)' : 'var(--text)' }}>{value}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  );
}

export function KpiGrid({ children, columns = 4 }: { children: ReactNode; columns?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 14, marginBottom: 18 }}>{children}</div>;
}

function EmptyOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        color: 'var(--text-muted)',
        pointerEvents: 'none',
      }}
    >
      <span style={{ background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: 8 }}>{text}</span>
    </div>
  );
}

// ---------- weekly activity (area/line chart) ----------

export function TrendChart({
  weeks,
  series = ACTIVITY_SERIES,
  height = 230,
  emptyText = 'No activity in the last 12 weeks yet',
}: {
  weeks: TrendWeek[];
  series?: readonly { key: keyof Omit<TrendWeek, 'weekStart'>; label: string; color: string }[];
  height?: number;
  emptyText?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '');
  const pad = { top: 12, right: 12, bottom: 26, left: 34 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...weeks.flatMap((w) => series.map((s) => w[s.key]))));
  const x = (i: number) => pad.left + (weeks.length <= 1 ? innerW / 2 : (i / (weeks.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const empty = weeks.every((w) => series.every((s) => w[s.key] === 0));
  const labelEvery = innerW / weeks.length < 44 ? 2 : 1;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    const i = Math.round((px / innerW) * (weeks.length - 1));
    setHover(i >= 0 && i < weeks.length ? i : null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div ref={ref} style={{ position: 'relative', height }}>
        {width > 0 && (
          <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`${gradientId}-${i}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={i === 0 ? 0.22 : 0.1} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {[0, 1, 2, 3, 4].map((t) => {
              const v = (max / 4) * t;
              return (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={CHART_COLORS.grid} strokeDasharray={t === 0 ? undefined : '3 4'} />
                  <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={CHART_COLORS.axis}>
                    {Math.round(v)}
                  </text>
                </g>
              );
            })}
            {weeks.map((w, i) =>
              i % labelEvery === (weeks.length - 1) % labelEvery ? (
                <text
                  key={w.weekStart}
                  x={x(i)}
                  y={height - 6}
                  textAnchor={i === 0 ? 'start' : i === weeks.length - 1 ? 'end' : 'middle'}
                  fontSize={11}
                  fill={CHART_COLORS.axis}
                >
                  {weekLabel(w.weekStart)}
                </text>
              ) : null,
            )}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={CHART_COLORS.axis} strokeDasharray="3 3" />}
            {[...series].reverse().map((s) => {
              const i = series.indexOf(s);
              const points = weeks.map((w, wi) => [x(wi), y(w[s.key])] as [number, number]);
              const line = smoothPath(points);
              return (
                <g key={s.key}>
                  <path d={`${line} L${x(weeks.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradientId}-${i})`} />
                  <path d={line} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
                  {hover !== null && <circle cx={points[hover][0]} cy={points[hover][1]} r={4.5} fill="#fff" stroke={s.color} strokeWidth={2.4} />}
                </g>
              );
            })}
          </svg>
        )}
        {empty && <EmptyOverlay text={emptyText} />}
        {hover !== null && !empty && (
          <Tooltip x={x(hover)} y={pad.top + 4} width={width}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Week of {weekLabel(weeks[hover].weekStart)}</div>
            {series.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Swatch color={s.color} round />
                <span style={{ flex: 1 }}>{s.label}</span>
                <b style={{ marginLeft: 10 }}>{weeks[hover][s.key]}</b>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ---------- forecast (actual line, then a dashed projection) ----------

export interface ForecastWeek {
  weekStart: string;
  actual: number | null;
  projected: number | null;
}

// A percentage over time: the solid line is what happened, the dashed line is where it is heading.
export function ForecastChart({ weeks, height = 230, targetLabel }: { weeks: ForecastWeek[]; height?: number; targetLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 14, right: 16, bottom: 26, left: 40 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (weeks.length <= 1 ? innerW / 2 : (i / (weeks.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / 100) * innerH;
  const actual = weeks.map((w, i) => [i, w.actual] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  const projected = weeks.map((w, i) => [i, w.projected] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  const path = (pts: readonly (readonly [number, number])[]) => pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const nowIndex = actual.length ? actual[actual.length - 1][0] : 0;
  const labelEvery = Math.max(1, Math.ceil(weeks.length / Math.max(1, Math.floor(innerW / 64))));

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.left) / innerW) * (weeks.length - 1));
    setHover(i >= 0 && i < weeks.length ? i : null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 0, borderTop: `2.5px solid ${CHART_COLORS.green}` }} />
          Actual
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 0, borderTop: `2.5px dashed ${CHART_COLORS.amber}` }} />
          Forecast at the current pace
        </span>
      </div>
      <div ref={ref} style={{ position: 'relative', height }}>
        {width > 0 && weeks.length > 0 && (
          <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={CHART_COLORS.grid} strokeDasharray={v === 0 ? undefined : '3 4'} />
                <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={CHART_COLORS.axis}>
                  {v}%
                </text>
              </g>
            ))}
            {/* "Today" divider between history and forecast */}
            <line x1={x(nowIndex)} x2={x(nowIndex)} y1={pad.top} y2={pad.top + innerH} stroke={CHART_COLORS.axis} strokeDasharray="2 3" />
            <text x={x(nowIndex) + 4} y={pad.top + 10} fontSize={10} fill={CHART_COLORS.axis}>
              Today
            </text>
            {targetLabel && (
              <text x={x(weeks.length - 1)} y={pad.top + 10} textAnchor="end" fontSize={10} fill={CHART_COLORS.axis}>
                {targetLabel}
              </text>
            )}
            {weeks.map((w, i) =>
              (i % labelEvery === 0 && weeks.length - 1 - i >= labelEvery) || i === weeks.length - 1 ? (
                <text
                  key={w.weekStart}
                  x={x(i)}
                  y={height - 6}
                  textAnchor={i === 0 ? 'start' : i === weeks.length - 1 ? 'end' : 'middle'}
                  fontSize={11}
                  fill={CHART_COLORS.axis}
                >
                  {weekLabel(w.weekStart)}
                </text>
              ) : null,
            )}
            {actual.length > 1 && (
              <path d={`${path(actual)} L${x(nowIndex)},${y(0)} L${x(actual[0][0])},${y(0)} Z`} fill={CHART_COLORS.green} opacity={0.08} />
            )}
            <path d={path(actual)} fill="none" stroke={CHART_COLORS.green} strokeWidth={2.5} strokeLinejoin="round" />
            <path d={path(projected)} fill="none" stroke={CHART_COLORS.amber} strokeWidth={2.5} strokeDasharray="6 5" strokeLinejoin="round" />
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={CHART_COLORS.axis} strokeDasharray="3 3" />}
            {projected.length > 0 && (
              <circle cx={x(projected[projected.length - 1][0])} cy={y(projected[projected.length - 1][1])} r={4.5} fill="#fff" stroke={CHART_COLORS.amber} strokeWidth={2.5} />
            )}
          </svg>
        )}
        {hover !== null && weeks[hover] && (
          <Tooltip x={x(hover)} y={pad.top + 4} width={width}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Week of {weekLabel(weeks[hover].weekStart)}</div>
            {weeks[hover].actual !== null && <div>Actual: {weeks[hover].actual}%</div>}
            {weeks[hover].projected !== null && <div>Forecast: {weeks[hover].projected}%</div>}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ---------- vertical (grouped) columns ----------

export function ColumnChart({
  groups,
  series,
  max: fixedMax,
  unit = '',
  height = 230,
  colorFor,
  emptyText = 'Nothing to show yet',
}: {
  groups: { label: string; values: (number | null)[]; hint?: string }[];
  series: { label: string; color: string }[];
  max?: number;
  unit?: string;
  height?: number;
  // Per-column color override (e.g. score bands), by group index.
  colorFor?: (groupIndex: number, seriesIndex: number) => string;
  emptyText?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 8, bottom: 30, left: 36 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = fixedMax ?? niceMax(Math.max(0, ...groups.flatMap((g) => g.values.map((v) => v ?? 0))));
  const slot = innerW / Math.max(groups.length, 1);
  const barW = Math.min(34, (slot * 0.64) / series.length);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const empty = groups.length === 0 || groups.every((g) => g.values.every((v) => !v));
  const maxLabelChars = Math.max(4, Math.floor(slot / 7));
  const short = (s: string) => (s.length > maxLabelChars ? `${s.slice(0, maxLabelChars - 1)}…` : s);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {series.length > 1 && <Legend items={series} />}
      <div ref={ref} style={{ position: 'relative', height }}>
        {width > 0 && (
          <svg width={width} height={height} style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
            {[0, 1, 2, 3, 4].map((t) => {
              const v = (max / 4) * t;
              return (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={CHART_COLORS.grid} strokeDasharray={t === 0 ? undefined : '3 4'} />
                  <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={CHART_COLORS.axis}>
                    {Math.round(v)}
                    {unit}
                  </text>
                </g>
              );
            })}
            {groups.map((g, gi) => {
              const cx = pad.left + slot * gi + slot / 2;
              const start = cx - (barW * series.length + 4 * (series.length - 1)) / 2;
              return (
                <g key={gi} onMouseEnter={() => setHover(gi)}>
                  <rect x={pad.left + slot * gi} y={pad.top} width={slot} height={innerH} fill={hover === gi ? 'rgba(31,109,82,0.05)' : 'transparent'} />
                  {g.values.map((v, si) => {
                    const h = v ? Math.max(((v ?? 0) / max) * innerH, 2) : 0;
                    return (
                      <rect
                        key={si}
                        x={start + si * (barW + 4)}
                        y={pad.top + innerH - h}
                        width={barW}
                        height={h}
                        rx={Math.min(5, barW / 3)}
                        fill={colorFor ? colorFor(gi, si) : series[si].color}
                      />
                    );
                  })}
                  <text x={cx} y={height - 10} textAnchor="middle" fontSize={11} fill={CHART_COLORS.axis}>
                    {short(g.label)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {empty && <EmptyOverlay text={emptyText} />}
        {hover !== null && !empty && groups[hover] && (
          <Tooltip x={pad.left + slot * hover + slot / 2} y={pad.top + 4} width={width}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{groups[hover].label}</div>
            {groups[hover].hint && <div style={{ opacity: 0.75, marginBottom: 2 }}>{groups[hover].hint}</div>}
            {series.map((s, si) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Swatch color={colorFor ? colorFor(hover, si) : s.color} round />
                <span style={{ flex: 1 }}>{s.label}</span>
                <b style={{ marginLeft: 10 }}>{groups[hover].values[si] === null ? '—' : `${groups[hover].values[si]}${unit}`}</b>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ---------- horizontal bars (a ranked list) ----------

export function BarList({
  rows,
  max: fixedMax,
  unit = '',
  color = CHART_COLORS.green,
  emptyText = 'Nothing to show yet',
}: {
  rows: { label: string; value: number | null; sub?: string; color?: string }[];
  max?: number;
  unit?: string;
  color?: string;
  emptyText?: string;
}) {
  const max = fixedMax ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  if (rows.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>{emptyText}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, marginBottom: 5 }}>
            <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.label}
              {r.sub && <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · {r.sub}</span>}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{r.value === null ? '—' : `${r.value}${unit}`}</span>
          </div>
          <div style={{ height: 8, background: 'var(--primary-light)', borderRadius: 4, overflow: 'hidden' }}>
            <GrowBar pct={((r.value ?? 0) / max) * 100} color={r.color ?? color} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GrowBar({ pct, color }: { pct: number; color: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return <div style={{ height: '100%', width: `${shown}%`, background: color, borderRadius: 4, transition: 'width 600ms ease' }} />;
}

// ---------- donut with legend ----------

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 150,
  thickness = 20,
  emptyText = 'No data yet',
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART_COLORS.grid} strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s, i) => {
              const length = (s.value / total) * circumference;
              const dash = Math.max(length - gap, 0);
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? thickness + 4 : thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: 'stroke-width 150ms' }}
                />
              );
              offset += length;
              return s.value > 0 ? el : null;
            })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {total === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText}</span>
          ) : hover !== null ? (
            <>
              <span style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)' }}>{Math.round((segments[hover].value / total) * 100)}%</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: size - thickness * 2 - 8 }}>{segments[hover].label}</span>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)' }}>{centerValue ?? total}</span>
              {centerLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{centerLabel}</span>}
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 130, flex: 1 }}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: hover === null || hover === i ? 1 : 0.5 }}
          >
            <Swatch color={s.color} round />
            <span style={{ flex: 1, color: 'var(--text)' }}>{s.label}</span>
            <b style={{ color: 'var(--text)' }}>{s.value}</b>
            <span style={{ color: 'var(--text-faint)', width: 38, textAlign: 'right' }}>{total ? `${Math.round((s.value / total) * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- icons for KPI cards ----------

const icon = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const KpiIcons = {
  book: icon(<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />),
  classes: icon(
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </>,
  ),
  teacher: icon(
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>,
  ),
  students: icon(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-.5A5.5 5.5 0 0 1 8 14h2a5.5 5.5 0 0 1 5.5 5.5v.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 5.1v.9" />
    </>,
  ),
  score: icon(
    <>
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </>,
  ),
  progress: icon(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>,
  ),
  alert: icon(
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>,
  ),
  check: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 10" />
    </>,
  ),
};
