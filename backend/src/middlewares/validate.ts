import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

// Validates + replaces req.body with the parsed (and coerced) result, so
// controllers can trust req.body's shape instead of re-checking it.
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors);
    }
    req.body = result.data;
    next();
  };
}
