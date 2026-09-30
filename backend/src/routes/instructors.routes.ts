import { Router } from 'express';
import * as controller from '../controllers/instructors.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

const router = Router();

// Every route here requires a logged-in, active ADMIN or DEAN.
router.use(authenticate, authorize('ADMIN', 'DEAN'));

router.get('/', controller.listInstructors);
router.post('/', validateBody(controller.createInstructorSchema), controller.createInstructor);
router.patch('/:id', validateBody(controller.updateInstructorSchema), controller.updateInstructor);
router.patch('/:id/status', validateBody(controller.setInstructorStatusSchema), controller.setInstructorStatus);

export default router;
