import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { serializeUser } from '../utils/serializeUser';
import { ApiError } from '../utils/ApiError';
import * as adminAccountsService from '../services/adminAccounts.service';

const PREFIX_VALUES = ['MR', 'MS', 'DR', 'ENGR', 'PROF', 'ASST_PROF', 'ASSOC_PROF'] as const;
const POSITION_VALUES = ['FULL_TIME', 'PART_TIME'] as const;

export const createAccountSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().min(1).optional(),
  lastName: z.string().min(1, 'Last name is required'),
  // Optional for admins/deans, same values as an instructor's profile.
  prefix: z.enum(PREFIX_VALUES).optional(),
  position: z.enum(POSITION_VALUES).optional(),
  email: z.string().email('Must be a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  role: z.enum(['ADMIN', 'DEAN']),
  employeeId: z.string().min(1, 'Employee ID is required'),
});

export const setStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createAccount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const account = await adminAccountsService.createAdminAccount({
    ...(req.body as z.infer<typeof createAccountSchema>),
    createdById: req.user.id,
  });

  res.status(201).json({ user: serializeUser(account) });
});

export const listAccounts = asyncHandler(async (_req: Request, res: Response) => {
  const accounts = await adminAccountsService.listAdminAccounts();
  res.json({ users: accounts.map(serializeUser) });
});

export const setAccountStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { isActive } = req.body as z.infer<typeof setStatusSchema>;
  const id = req.params.id as string;
  const account = await adminAccountsService.setAccountActive(id, isActive, req.user.id);
  res.json({ user: serializeUser(account) });
});
