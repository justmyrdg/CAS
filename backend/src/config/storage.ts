import path from 'path';
import { env } from './env';
import { createCloudinaryStorage, createLocalStorage } from '../utils/fileStorage';
import type { FileStorage } from '../utils/fileStorage';

// The one place that decides where uploads are kept (STORAGE_DRIVER in .env). Services import this, never the drivers.
export const storage: FileStorage =
  env.STORAGE_DRIVER === 'cloudinary'
    ? createCloudinaryStorage(env.CLOUDINARY_FOLDER)
    : createLocalStorage(path.resolve(__dirname, '../../uploads')); // same path from src/ under tsx and from dist/ when built
