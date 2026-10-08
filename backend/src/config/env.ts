import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // Where uploaded AR models, trigger pictures and lesson images are kept: backend/uploads/ (development) or Cloudinary.
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  CLOUDINARY_URL: z.string().optional(), // cloudinary://<api key>:<api secret>@<cloud name>, read by the Cloudinary SDK
  CLOUDINARY_FOLDER: z.string().default('cogniview'), // top-level folder in the Cloudinary library
}).superRefine((value, ctx) => {
  if (value.STORAGE_DRIVER === 'cloudinary' && !value.CLOUDINARY_URL?.startsWith('cloudinary://')) {
    ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_URL'], message: 'CLOUDINARY_URL (cloudinary://key:secret@cloud) is required when STORAGE_DRIVER=cloudinary' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
