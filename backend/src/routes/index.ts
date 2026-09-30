import { Router } from 'express';
import authRoutes from './auth.routes';
import adminAccountsRoutes from './adminAccounts.routes';
import instructorsRoutes from './instructors.routes';
import assessmentsRoutes from './assessments.routes';
import classesRoutes from './classes.routes';
import catalogRoutes from './catalog.routes';
import studentRoutes from './student.routes';
import adminOverviewRoutes from './adminOverview.routes';
import arModelsRoutes from './arModels.routes';
import lessonImagesRoutes from './lessonImages.routes';
import * as catalogController from '../controllers/catalog.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/admin/accounts', adminAccountsRoutes);
router.use('/admin/instructors', instructorsRoutes);
router.use('/admin/catalog', catalogRoutes);
router.use('/admin/ar-models', arModelsRoutes);
router.use('/admin/images', lessonImagesRoutes);
// Must come after the more specific /admin/* routers above.
router.use('/admin', adminOverviewRoutes);
router.use('/instructor/classes/:classId/assessments', assessmentsRoutes);
router.use('/instructor/classes', classesRoutes);
router.use('/student', studentRoutes);
// Read-only subject list for the instructor's Create Class dropdown.
router.get('/instructor/subjects', authenticate, authorize('INSTRUCTOR'), catalogController.listSubjectOptions);

export default router;
