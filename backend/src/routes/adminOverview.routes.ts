import { Router } from 'express';
import * as controller from '../controllers/adminOverview.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

// Mounted at /api/admin. Every route requires a logged-in, active ADMIN or DEAN.
const router = Router();

router.use(authenticate, authorize('ADMIN', 'DEAN'));

router.get('/dashboard', controller.getDashboard);
router.get('/classes', controller.listClasses);
router.get('/assessments', controller.listAssessments);
router.get('/reports', controller.getReports);

router.get('/students', controller.listStudents);
router.post('/students', validateBody(controller.createStudentSchema), controller.createStudent);
router.patch('/students/:id', validateBody(controller.updateStudentSchema), controller.updateStudent);
router.patch('/students/:id/status', validateBody(controller.setStudentStatusSchema), controller.setStudentStatus);
router.post('/students/:id/reset-password', controller.resetStudentPassword);

export default router;
