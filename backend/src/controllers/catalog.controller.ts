import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as catalogService from '../services/catalog.service';
import * as contentService from '../services/content.service';
import { formatValidationError, lessonBlocksInputSchema, presentBlocks, toStoredBlocks } from '../utils/lessonBlocks';

// Blank descriptions are stored as null rather than "".
const description = z
  .string()
  .trim()
  .max(1000, 'Description is too long')
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

const subjectCode = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2,8}\d{1,4}[A-Z]?$/, 'Subject code should look like CS101 or MATH204'));

export const createSubjectSchema = z.object({
  code: subjectCode,
  name: z.string().trim().min(1, 'Subject name is required').max(120),
  description,
});

export const updateSubjectSchema = createSubjectSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export const createItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  description,
});

const MAX_CHAPTERS_PER_SAVE = 200;

export const createModuleSchema = createItemSchema.extend({
  chapters: z.array(createItemSchema).max(MAX_CHAPTERS_PER_SAVE).default([]),
});

export const saveModuleSchema = createItemSchema.extend({
  chapters: z.array(createItemSchema.extend({ id: z.string().uuid().optional() })).max(MAX_CHAPTERS_PER_SAVE),
});

export const updateItemSchema = createItemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const listSubjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
});

const param = (req: Request, name: string) => req.params[name] as string;

export const listSubjects = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listSubjectsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid list parameters', parsed.error.flatten().fieldErrors);
  }
  const { page, pageSize } = parsed.data;
  const { subjects, total } = await catalogService.listSubjects(parsed.data);
  res.json({ subjects, total, page, pageSize });
});

export const listSubjectOptions = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ subjects: await catalogService.listSubjectOptions() });
});

export const getSubject = asyncHandler(async (req: Request, res: Response) => {
  res.json({ subject: await catalogService.getSubject(param(req, 'id')) });
});

export const createSubject = asyncHandler(async (req: Request, res: Response) => {
  const subject = await catalogService.createSubject(req.body as z.infer<typeof createSubjectSchema>);
  res.status(201).json({ subject });
});

export const updateSubject = asyncHandler(async (req: Request, res: Response) => {
  const subject = await catalogService.updateSubject(param(req, 'id'), req.body as z.infer<typeof updateSubjectSchema>);
  res.json({ subject });
});

export const deleteSubject = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deleteSubject(param(req, 'id'));
  res.status(204).send();
});

export const createModule = asyncHandler(async (req: Request, res: Response) => {
  const mod = await catalogService.createModule(param(req, 'id'), req.body as z.infer<typeof createModuleSchema>);
  res.status(201).json({ module: mod });
});

export const updateModule = asyncHandler(async (req: Request, res: Response) => {
  const mod = await catalogService.updateModule(param(req, 'id'), req.body as z.infer<typeof updateItemSchema>);
  res.json({ module: mod });
});

export const saveModule = asyncHandler(async (req: Request, res: Response) => {
  const mod = await catalogService.saveModule(param(req, 'id'), req.body as z.infer<typeof saveModuleSchema>);
  res.json({ module: mod });
});

export const deleteModule = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deleteModule(param(req, 'id'));
  res.status(204).send();
});

export const reorderModules = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.reorderModules(param(req, 'id'), (req.body as z.infer<typeof reorderSchema>).ids);
  res.status(204).send();
});

export const createChapter = asyncHandler(async (req: Request, res: Response) => {
  const chapter = await catalogService.createChapter(param(req, 'id'), req.body as z.infer<typeof createItemSchema>);
  res.status(201).json({ chapter });
});

export const updateChapter = asyncHandler(async (req: Request, res: Response) => {
  const chapter = await catalogService.updateChapter(param(req, 'id'), req.body as z.infer<typeof updateItemSchema>);
  res.json({ chapter });
});

export const deleteChapter = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deleteChapter(param(req, 'id'));
  res.status(204).send();
});

export const reorderChapters = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.reorderChapters(param(req, 'id'), (req.body as z.infer<typeof reorderSchema>).ids);
  res.status(204).send();
});

// ---------- Lessons & quizzes (chapter content) ----------

const questionSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Every question needs a prompt').max(1000),
    choices: z
      .array(z.string().trim().min(1, 'Choices cannot be blank').max(300))
      .min(2, 'Each question needs at least 2 choices')
      .max(6, 'A question can have at most 6 choices'),
    correctChoice: z.number().int().min(0),
  })
  .refine((q) => q.correctChoice < q.choices.length, { message: 'Pick the correct choice', path: ['correctChoice'] });

const lessonSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  // Defaults to [] only for create, where a brand-new lesson naturally starts empty.
  blocks: lessonBlocksInputSchema.default([]),
  arModelId: z.string().uuid().nullable().optional(),
});

// Saving (PUT) an existing lesson must not silently wipe its blocks: a client that omits the
// field (rather than sending `blocks: []` on purpose) should get a validation error, not a save
// that empties the lesson.
const lessonSaveSchema = lessonSchema.extend({ blocks: lessonBlocksInputSchema });

const quizSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  questions: z.array(questionSchema).min(1, 'A quiz needs at least one question').max(100),
});

export const createContentSchema = z.discriminatedUnion('type', [
  lessonSchema.extend({ type: z.literal('LESSON') }),
  quizSchema.extend({ type: z.literal('QUIZ') }),
]);

// Lesson/quiz bodies are parsed here (not by validateBody) so a lesson error can name its block.
function parseContent<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = formatValidationError(parsed.error);
    throw ApiError.badRequest(message, { lesson: [message] });
  }
  return parsed.data;
}

type LessonData = z.infer<typeof lessonSchema> | z.infer<typeof lessonSaveSchema>;
type QuizData = z.infer<typeof quizSchema>;

const toServiceInput = (data: LessonData | QuizData) =>
  'blocks' in data ? { ...data, blocks: toStoredBlocks(data.blocks) } : data;

// Image blocks get the URL of their file.
function presentItem<T extends { blocks: unknown }>(item: T) {
  return { ...item, blocks: presentBlocks(item.blocks) };
}

export const getContent = asyncHandler(async (req: Request, res: Response) => {
  res.json({ item: presentItem(await contentService.getContentItem(param(req, 'id'))) });
});

export const createContent = asyncHandler(async (req: Request, res: Response) => {
  const { type, ...data } = parseContent(createContentSchema, req.body);
  const item = await contentService.createContentItem(param(req, 'id'), type, toServiceInput(data));
  res.status(201).json({ item: presentItem(item) });
});

export const saveContent = asyncHandler(async (req: Request, res: Response) => {
  const existing = await contentService.getContentItem(param(req, 'id'));
  const data = parseContent(existing.type === 'QUIZ' ? quizSchema : lessonSaveSchema, req.body);
  const item = await contentService.saveContentItem(existing.id, toServiceInput(data));
  res.json({ item: presentItem(item) });
});

export const deleteContent = asyncHandler(async (req: Request, res: Response) => {
  await contentService.deleteContentItem(param(req, 'id'));
  res.status(204).send();
});

export const reorderContent = asyncHandler(async (req: Request, res: Response) => {
  await contentService.reorderContent(param(req, 'id'), (req.body as z.infer<typeof reorderSchema>).ids);
  res.status(204).send();
});
