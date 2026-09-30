import type { User } from '@prisma/client';
import { fullName } from './fullName';

// The one place a User row is allowed to become an HTTP response — every
// controller must funnel through this instead of returning a Prisma row
// directly, or passwordHash ends up on the wire.
export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    fullName: fullName(user),
    prefix: user.prefix,
    position: user.position,
    role: user.role,
    employeeId: user.employeeId,
    srCode: user.srCode,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type PublicUser = ReturnType<typeof serializeUser>;
