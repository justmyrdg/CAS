import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { ApiError } from './utils/ApiError';
import * as arModelsController from './controllers/arModels.controller';
import * as lessonImagesController from './controllers/lessonImages.controller';
import * as arTriggersController from './controllers/arTriggers.controller';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  // AR model files are fetched by 3D viewers from any origin — including the
  // mobile WebView, which sends "Origin: null" — so this one read-only route sits
  // ahead of the allowlist below with open CORS. (Model ids are random UUIDs.)
  app.get('/api/ar-models/:id/file', cors({ origin: '*' }), arModelsController.download);
  // Lesson images are public for the same reason: <img> tags and the phone load them by URL.
  app.get('/api/images/:id/file', cors({ origin: '*' }), lessonImagesController.download);
  // The AR page's targets (printed marker + every trigger picture) and the pictures themselves.
  app.get('/api/ar-targets/index', cors({ origin: '*' }), arTriggersController.targetsIndex);
  app.get('/api/ar-targets/targets.mind', cors({ origin: '*' }), arTriggersController.targetsFile);
  app.get('/api/ar-triggers/:id/image', cors({ origin: '*' }), arTriggersController.image);
  // The printed AR marker (marker.png) and its MindAR tracking data (marker.mind), loaded by the student app's AR
  // WebView and the admin's print page. Static files in backend/assets/ar-marker (same path from src/ and dist/).
  app.use(
    '/api/ar-marker',
    cors({ origin: '*' }),
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.resolve(__dirname, '../assets/ar-marker'), { index: false, maxAge: '1h' }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header (curl, mobile apps, same-origin) is allowed
        // through; a browser Origin must be in the explicit allowlist.
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new ApiError(403, `Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );

  // Trigger-picture uploads (base64 picture + tracking data) are parsed on their own route with a larger limit.
  const jsonBody = express.json({ limit: '1mb' });
  app.use((req, res, next) =>
    req.method === 'POST' && /^\/api\/admin\/ar-models\/[^/]+\/triggers$/.test(req.path) ? next() : jsonBody(req, res, next),
  );
  app.use(cookieParser());
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
