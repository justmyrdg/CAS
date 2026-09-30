import { Router } from 'express';
import * as controller from '../controllers/adminAccounts.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

const router = Router();

// Every route here requires a logged-in, active ADMIN or DEAN.
router.use(authenticate, authorize('ADMIN', 'DEAN'));

router.get('/', controller.listAccounts);
router.post('/', validateBody(controller.createAccountSchema), controller.createAccount);
router.patch('/:id/status', validateBody(controller.setStatusSchema), controller.setAccountStatus);

export default router;
