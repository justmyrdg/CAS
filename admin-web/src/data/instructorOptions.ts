export const PREFIX_OPTIONS = [
  { value: 'MR', label: 'Mr.' },
  { value: 'MS', label: 'Ms.' },
  { value: 'DR', label: 'Dr.' },
  { value: 'ENGR', label: 'Engr.' },
  { value: 'PROF', label: 'Prof.' },
  { value: 'ASST_PROF', label: 'Asst. Prof.' },
  { value: 'ASSOC_PROF', label: 'Assoc. Prof.' },
] as const;

export const POSITION_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
] as const;

export type PrefixValue = (typeof PREFIX_OPTIONS)[number]['value'];
export type PositionValue = (typeof POSITION_OPTIONS)[number]['value'];
