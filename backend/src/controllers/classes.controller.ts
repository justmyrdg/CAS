import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as classesService from '../services/classes.service';
import * as enrollmentsService from '../services/enrollments.service';
import * as analyticsService from '../services/classAnalytics.service';

const TERM_VALUES = ['FIRST_SEM', 'SECOND_SEM', 'SUMMER'] as const;

export const createClassSchema = z.object({
  subjectId: z.string().uuid('Choose a subject'),
  section: z.string().trim().min(1, 'Section is required').max(20),
  term: z.enum(TERM_VALUES),
  schoolYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'School year must look like 2026-2027')
    .refine((value) => {
      const [start, end] = value.split('-').map(Number);
      return end === start + 1;
    }, 'School year must span two consecutive years'),
});

export const updateClassSchema = z
  .object({
    section: z.string().trim().min(1, 'Section is required').max(20).optional(),
    term: z.enum(TERM_VALUES).optional(),
    schoolYear: createClassSchema.shape.schoolYear.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

const listClassesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'archived']).default('all'),
});

const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
});

export const addStudentSchema = z.object({
  srCode: z.string().trim().regex(/^\d{2}-\d{5}$/, 'SR code must look like 23-01452'),
});

export const createClass = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const body = req.body as z.infer<typeof createClassSchema>;
  const created = await classesService.createClass({ ...body, instructorId: req.user.id });
  res.status(201).json({ class: created });
});

export const listClasses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const parsed = listClassesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid list parameters', parsed.error.flatten().fieldErrors);
  }
  const { page, pageSize } = parsed.data;
  const { classes, total } = await classesService.listClasses({ ...parsed.data, instructorId: req.user.id });
  res.json({ classes, total, page, pageSize });
});

export const getClass = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const found = await classesService.getClass(req.params.id as string, req.user.id);
  res.json({ class: found });
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const [counts, overview] = await Promise.all([
    classesService.getSummary(req.user.id),
    analyticsService.getInstructorOverview(req.user.id),
  ]);
  res.json({ ...counts, ...overview });
});

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const parsed = listStudentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid list parameters', parsed.error.flatten().fieldErrors);
  }
  const { page, pageSize } = parsed.data;
  const { students, total } = await enrollmentsService.listStudents(req.params.id as string, req.user.id, parsed.data);
  res.json({ students, total, page, pageSize });
});

export const addStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { srCode } = req.body as z.infer<typeof addStudentSchema>;
  const enrollment = await enrollmentsService.addStudentBySrCode(req.params.id as string, req.user.id, srCode);
  res.status(201).json({ enrollment });
});

export const removeStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  await enrollmentsService.removeStudent(req.params.id as string, req.user.id, req.params.enrollmentId as string);
  res.status(204).send();
});

export const updateClass = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const updated = await classesService.updateClass(req.params.id as string, req.user.id, req.body as z.infer<typeof updateClassSchema>);
  res.json({ class: updated });
});

export const deleteClass = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await classesService.deleteClass(req.params.id as string, req.user.id);
  res.status(204).send();
});

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json(await analyticsService.getAnalytics(req.params.id as string, req.user.id));
});

export const getContent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json(await analyticsService.getContent(req.params.id as string, req.user.id));
});

export const getContentItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await analyticsService.getContentItem(req.params.id as string, req.user.id, req.params.itemId as string);
  if (!item) throw ApiError.notFound('Lesson or quiz not found in this class');
  res.json({ item });
});
