import { Router } from 'express';
import * as controller from '../controllers/classes.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

const router = Router();

// An instructor only ever sees and manages their own classes.
router.use(authenticate, authorize('INSTRUCTOR'));

router.get('/', controller.listClasses);
router.post('/', validateBody(controller.createClassSchema), controller.createClass);
// Must stay above '/:id', or "summary" would be read as a class id.
router.get('/summary', controller.getSummary);
router.get('/:id', controller.getClass);
router.patch('/:id', validateBody(controller.updateClassSchema), controller.updateClass);
router.delete('/:id', controller.deleteClass);
router.get('/:id/analytics', controller.getAnalytics);
router.get('/:id/content', controller.getContent);
router.get('/:id/content/:itemId', controller.getContentItem);
router.get('/:id/students', controller.listStudents);
router.post('/:id/students', validateBody(controller.addStudentSchema), controller.addStudent);
router.delete('/:id/students/:enrollmentId', controller.removeStudent);

export default router;
