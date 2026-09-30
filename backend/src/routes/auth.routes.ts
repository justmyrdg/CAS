import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';
import { loginRateLimiter } from '../middlewares/rateLimiters';

const router = Router();

router.post('/login', loginRateLimiter, validateBody(authController.loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  validateBody(authController.changePasswordSchema),
  authController.changePassword,
);

export default router;
