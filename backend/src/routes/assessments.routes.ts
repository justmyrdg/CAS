import { Router } from 'express';
import * as controller from '../controllers/assessments.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

// Mounted at /api/instructor/classes/:classId/assessments — an instructor's quizzes & exams for one of their classes.
const router = Router({ mergeParams: true });

router.use(authenticate, authorize('INSTRUCTOR'));

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:assessmentId', controller.get);
router.put('/:assessmentId', controller.update);
router.delete('/:assessmentId', controller.remove);
router.get('/:assessmentId/results', controller.results);
router.get('/:assessmentId/attempts/:attemptId', controller.getAttempt);
router.put('/:assessmentId/attempts/:attemptId/grades', validateBody(controller.gradesSchema), controller.grade);

export default router;
