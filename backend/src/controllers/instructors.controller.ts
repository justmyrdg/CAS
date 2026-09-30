import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { serializeUser } from '../utils/serializeUser';
import { ApiError } from '../utils/ApiError';
import * as instructorsService from '../services/instructors.service';

const PREFIX_VALUES = ['MR', 'MS', 'DR', 'ENGR', 'PROF', 'ASST_PROF', 'ASSOC_PROF'] as const;
const POSITION_VALUES = ['FULL_TIME', 'PART_TIME'] as const;

export const createInstructorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().min(1).optional(),
  lastName: z.string().min(1, 'Last name is required'),
  prefix: z.enum(PREFIX_VALUES),
  position: z.enum(POSITION_VALUES),
  employeeId: z.string().regex(/^\d{5}$/, 'Employee ID must be exactly 5 digits'),
  email: z.string().email('Must be a valid email'),
});

export const updateInstructorSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    middleName: z.string().trim().min(1).nullable().optional(),
    lastName: z.string().min(1).optional(),
    prefix: z.enum(PREFIX_VALUES).optional(),
    position: z.enum(POSITION_VALUES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export const setInstructorStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createInstructor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { user, generatedPassword } = await instructorsService.createInstructor({
    ...(req.body as z.infer<typeof createInstructorSchema>),
    createdById: req.user.id,
  });

  res.status(201).json({ user: serializeUser(user), generatedPassword });
});

const listInstructorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  // Matches first/middle/last name, email or employee ID, case-insensitively.
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

export const listInstructors = asyncHandler(async (req: Request, res: Response) => {
  // Express 5 makes req.query read-only, so this can't go through validateBody-style middleware.
  const parsed = listInstructorsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid list parameters', parsed.error.flatten().fieldErrors);
  }
  const { page, pageSize } = parsed.data;
  const { users, total } = await instructorsService.listInstructors(parsed.data);
  res.json({ users: users.map(serializeUser), total, page, pageSize });
});

export const updateInstructor = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const instructor = await instructorsService.updateInstructor(
    id,
    req.body as z.infer<typeof updateInstructorSchema>,
  );
  res.json({ user: serializeUser(instructor) });
});

export const setInstructorStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as z.infer<typeof setInstructorStatusSchema>;
  const id = req.params.id as string;
  const instructor = await instructorsService.setInstructorActive(id, isActive);
  res.json({ user: serializeUser(instructor) });
});
