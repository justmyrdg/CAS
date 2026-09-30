import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function usage(): never {
  console.error(
    [
      'Usage:',
      '  npm run create:account -- --firstName Jane --lastName Dean --email jane@school.edu --password Password1 --role DEAN --employeeId EMP-0042',
      '  npm run create:account -- --firstName Maria --lastName Alonzo --email maria@school.edu --password Password1 --role STUDENT --srCode 23-01452',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { firstName, lastName, email, password, role, employeeId, srCode } = args;

  if (!firstName || !lastName || !email || !password || !role) usage();

  // Instructors are created from admin-web (which generates their password), so they aren't offered here.
  if (role !== 'ADMIN' && role !== 'DEAN' && role !== 'STUDENT') {
    throw new Error('--role must be ADMIN, DEAN or STUDENT');
  }
  const isStudent = role === 'STUDENT';
  if (isStudent && !srCode) usage();
  if (!isStudent && !employeeId) usage();
  if (isStudent && !/^\d{2}-\d{5}$/.test(srCode)) {
    throw new Error('--srCode must look like 23-01452');
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('--password must be at least 8 characters with an uppercase letter and a digit');
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error(`A user with email ${normalizedEmail} already exists (role: ${existing.role})`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash,
      role: role as UserRole,
      ...(isStudent ? { srCode } : { employeeId }),
      isActive: true,
    },
  });

  const id = isStudent ? `srCode: ${user.srCode}` : `employeeId: ${user.employeeId}`;
  console.log(`Created ${user.role}: ${user.email} (${id})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
