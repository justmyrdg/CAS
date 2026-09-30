import type { User } from '@prisma/client';

const PREFIX_LABELS: Record<NonNullable<User['prefix']>, string> = {
  MR: 'Mr.',
  MS: 'Ms.',
  DR: 'Dr.',
  ENGR: 'Engr.',
  PROF: 'Prof.',
  ASST_PROF: 'Asst. Prof.',
  ASSOC_PROF: 'Assoc. Prof.',
};

export function fullName(user: Pick<User, 'prefix' | 'firstName' | 'middleName' | 'lastName'>): string {
  const parts = [
    user.prefix ? PREFIX_LABELS[user.prefix] : undefined,
    user.firstName,
    user.middleName ?? undefined,
    user.lastName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' ');
}
