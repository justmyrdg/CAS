import 'dotenv/config';
import { writeFileSync } from 'fs';
import path from 'path';
import { PrismaClient, UserPosition, UserPrefix, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Every seeded account (admin, faculty and students) signs in with this one password
// (8+ chars, an uppercase letter and a digit).
const DEFAULT_PASSWORD = 'CogniView2026!';

// Every login this seed knows about is written here so it can be opened in a text editor.
// Git-ignored at the repo root because it holds a plain-text password.
const ACCOUNTS_FILE = path.resolve(__dirname, '..', '..', 'DEFAULT_ACCOUNTS.txt');

type SeedUser = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  srCode?: string;
  prefix?: UserPrefix;
  position?: UserPosition;
};

const FACULTY_NAMES: Pick<SeedUser, 'firstName' | 'lastName' | 'prefix' | 'position'>[] = [
  { firstName: 'Andrea', lastName: 'Villanueva', prefix: 'PROF', position: 'FULL_TIME' },
  { firstName: 'Ramon', lastName: 'Castillo', prefix: 'ENGR', position: 'FULL_TIME' },
  { firstName: 'Liza', lastName: 'Mendoza', prefix: 'MS', position: 'PART_TIME' },
];

const FACULTY: SeedUser[] = FACULTY_NAMES.map((f, i) => ({
  ...f,
  email: `${f.firstName}.${f.lastName}@cogniview.edu`.toLowerCase(),
  role: 'INSTRUCTOR' as const,
  employeeId: String(10001 + i),
}));

const STUDENT_NAMES: [string, string][] = [
  ['Maria', 'Alonzo'], ['Jerome', 'Cruz'], ['Rina', 'Torres'], ['Diego', 'Pineda'],
  ['Angela', 'Santos'], ['Paolo', 'Reyes'], ['Camille', 'Bautista'], ['Joshua', 'Garcia'],
  ['Bea', 'Ramos'], ['Carlo', 'Aquino'], ['Nicole', 'Dela Cruz'], ['Mark', 'Salazar'],
  ['Trisha', 'Navarro'], ['Kevin', 'Flores'], ['Janine', 'Lopez'], ['Miguel', 'Hernandez'],
  ['Sofia', 'Domingo'], ['Adrian', 'Mercado'], ['Hannah', 'Valdez'], ['Luis', 'Gonzales'],
];

const STUDENTS: SeedUser[] = STUDENT_NAMES.map(([firstName, lastName], i) => {
  const srCode = `24-${String(i + 1).padStart(5, '0')}`;
  return {
    firstName,
    lastName,
    email: `${srCode}@g.cogniview.edu`,
    role: 'STUDENT' as const,
    srCode,
  };
});

function adminFromEnv(): SeedUser {
  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME ?? 'Root Admin';
  const employeeId = process.env.SEED_ADMIN_EMPLOYEE_ID ?? '00001';

  if (!email) {
    throw new Error('SEED_ADMIN_EMAIL must be set to seed the bootstrap admin');
  }

  const spaceIndex = name.indexOf(' ');
  return {
    firstName: spaceIndex === -1 ? name : name.slice(0, spaceIndex),
    lastName: spaceIndex === -1 ? '' : name.slice(spaceIndex + 1),
    email: email.toLowerCase(),
    role: 'ADMIN',
    employeeId,
  };
}

// Creates the user unless one already holds its email / employee ID / SR code. An existing account keeps
// its profile, but if its password was changed it is set back to DEFAULT_PASSWORD ('reset').
async function ensureUser(user: SeedUser, passwordHash: string): Promise<'created' | 'exists' | 'reset'> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: user.email },
        ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
        ...(user.srCode ? [{ srCode: user.srCode }] : []),
      ],
    },
  });

  if (existing) {
    if (await bcrypt.compare(DEFAULT_PASSWORD, existing.passwordHash)) return 'exists';
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: false },
    });
    return 'reset';
  }

  await prisma.user.create({ data: { ...user, passwordHash, isActive: true } });
  return 'created';
}

function writeAccountsFile(admin: SeedUser) {
  const pad = (s: string, n: number) => s.padEnd(n);
  const row = (id: string | undefined, u: SeedUser) =>
    `  ${pad(id ?? '', 12)}${pad(`${u.firstName} ${u.lastName}`.trim(), 24)}${u.email}`;
  const header = (idLabel: string) => `  ${pad(idLabel, 12)}${pad('Name', 24)}Email`;
  const lines = [
    'CogniView AR — default accounts (created by `npm run seed` in backend/)',
    'LOCAL DEVELOPMENT ONLY — do not commit or reuse this password.',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    `PASSWORD FOR EVERY ACCOUNT:  ${DEFAULT_PASSWORD}`,
    'Log in with the Login ID / SR code (or the email).',
    '',
    'ADMIN — admin-web, http://localhost:1200',
    header('Login ID'),
    row(admin.employeeId, admin),
    '',
    'FACULTY (instructors) — instructor-web, http://localhost:1201',
    header('Login ID'),
    ...FACULTY.map((u) => row(u.employeeId, u)),
    '',
    'STUDENTS — student-mobile, http://localhost:1202',
    header('SR code'),
    ...STUDENTS.map((u) => row(u.srCode, u)),
    '',
  ];
  writeFileSync(ACCOUNTS_FILE, lines.join('\r\n'));
}

async function main() {
  const admin = adminFromEnv();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const counts = { created: 0, exists: 0, reset: 0 };
  for (const user of [admin, ...FACULTY, ...STUDENTS]) {
    counts[await ensureUser(user, passwordHash)] += 1;
  }
  writeAccountsFile(admin);
  console.log(
    `Seed done: ${counts.created} created, ${counts.reset} existing had their password reset, ${counts.exists} already up to date.`,
  );
  console.log(`Logins written to ${ACCOUNTS_FILE}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
