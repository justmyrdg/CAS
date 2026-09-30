import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { serializeUser } from '../utils/serializeUser';
import * as overviewService from '../services/adminOverview.service';
import * as studentsService from '../services/students.service';

// Admin/dean-only: dashboard, all classes, assessments, reports, and student accounts.

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
};

function parseQuery<T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest('Invalid list parameters', parsed.error.flatten().fieldErrors);
  return parsed.data;
}

const param = (req: Request, name: string) => req.params[name] as string;

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await overviewService.getDashboard());
});

const classesQuery = z.object({ ...pageQuery, status: z.enum(['all', 'active', 'archived']).default('all') });

export const listClasses = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(classesQuery, req);
  res.json({ ...(await overviewService.listAllClasses(query)), page: query.page, pageSize: query.pageSize });
});

const assessmentsQuery = z.object(pageQuery);

export const listAssessments = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(assessmentsQuery, req);
  res.json({ ...(await overviewService.listAssessments(query)), page: query.page, pageSize: query.pageSize });
});

export const getReports = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await overviewService.getReports());
});

// ---------- Students ----------

const name = z.string().trim().min(1).max(80);

export const createStudentSchema = z.object({
  firstName: name,
  middleName: z.string().trim().min(1).max(80).optional(),
  lastName: name,
  srCode: z.string().trim().regex(/^\d{2}-\d{5}$/, 'SR code must look like 23-01452'),
  email: z.string().trim().email('Must be a valid email'),
});

export const updateStudentSchema = z
  .object({
    firstName: name.optional(),
    middleName: z.string().trim().min(1).max(80).nullable().optional(),
    lastName: name.optional(),
    email: z.string().trim().email('Must be a valid email').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const setStudentStatusSchema = z.object({ isActive: z.boolean() });

const studentsQuery = z.object({ ...pageQuery, status: z.enum(['all', 'active', 'inactive']).default('all') });

function serializeStudent(user: Parameters<typeof serializeUser>[0] & { _count?: { enrollments: number } }) {
  return { ...serializeUser(user), classCount: user._count?.enrollments ?? 0 };
}

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(studentsQuery, req);
  const { users, total } = await studentsService.listStudents(query);
  res.json({ users: users.map(serializeStudent), total, page: query.page, pageSize: query.pageSize });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { user, generatedPassword } = await studentsService.createStudent({
    ...(req.body as z.infer<typeof createStudentSchema>),
    createdById: req.user.id,
  });
  res.status(201).json({ user: serializeStudent(user), generatedPassword });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const user = await studentsService.updateStudent(param(req, 'id'), req.body as z.infer<typeof updateStudentSchema>);
  res.json({ user: serializeStudent(user) });
});

export const setStudentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as z.infer<typeof setStudentStatusSchema>;
  res.json({ user: serializeStudent(await studentsService.setStudentActive(param(req, 'id'), isActive)) });
});

export const resetStudentPassword = asyncHandler(async (req: Request, res: Response) => {
  const { user, generatedPassword } = await studentsService.resetStudentPassword(param(req, 'id'));
  res.json({ user: serializeStudent(user), generatedPassword });
});
