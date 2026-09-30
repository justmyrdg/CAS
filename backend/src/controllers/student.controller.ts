import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as studentService from '../services/student.service';
import * as arService from '../services/arModels.service';

export const joinClassSchema = z.object({
  joinCode: z.string().trim().min(3, 'Enter the join code from your instructor').max(40),
});

export const submitQuizSchema = z.object({
  answers: z.array(z.number().int().min(0)).min(1),
});

function studentId(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user.id;
}

const param = (req: Request, name: string) => req.params[name] as string;

export const listClasses = asyncHandler(async (req: Request, res: Response) => {
  res.json({ classes: await studentService.listClasses(studentId(req)) });
});

export const joinClass = asyncHandler(async (req: Request, res: Response) => {
  const { joinCode } = req.body as z.infer<typeof joinClassSchema>;
  res.status(201).json({ class: await studentService.joinClass(studentId(req), joinCode) });
});

export const getClass = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentService.getClass(studentId(req), param(req, 'id')));
});

export const getLesson = asyncHandler(async (req: Request, res: Response) => {
  res.json({ lesson: await studentService.getLesson(studentId(req), param(req, 'id')) });
});

export const completeLesson = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentService.completeLesson(studentId(req), param(req, 'id')));
});

export const getQuiz = asyncHandler(async (req: Request, res: Response) => {
  res.json({ quiz: await studentService.getQuiz(studentId(req), param(req, 'id')) });
});

export const submitQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { answers } = req.body as z.infer<typeof submitQuizSchema>;
  res.status(201).json(await studentService.submitQuiz(studentId(req), param(req, 'id'), answers));
});

export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  res.json(await studentService.getProgress(studentId(req)));
});

export const listArModels = asyncHandler(async (req: Request, res: Response) => {
  res.json({ models: await arService.listForStudent(studentId(req)) });
});

export const getArModel = asyncHandler(async (req: Request, res: Response) => {
  res.json({ model: await arService.getForStudent(param(req, 'id')) });
});
