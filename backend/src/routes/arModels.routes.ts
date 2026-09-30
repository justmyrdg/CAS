import express, { Router } from 'express';
import * as controller from '../controllers/arModels.controller';
import * as triggers from '../controllers/arTriggers.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';
import { MAX_AR_BYTES } from '../services/arModels.service';

// Mounted at /api/admin/ar-models — admins/deans manage the AR library.
const router = Router();

router.use(authenticate, authorize('ADMIN', 'DEAN'));

// The model file is the raw request body (any content type), up to the size limit.
const rawUpload = express.raw({ type: () => true, limit: MAX_AR_BYTES });

router.get('/', controller.list);
router.post('/', rawUpload, controller.create);
router.get('/:id', controller.get);
router.patch('/:id', validateBody(controller.updateArSchema), controller.update);
router.put('/:id/file', rawUpload, controller.replaceFile);
router.put('/:id/hotspots', validateBody(controller.hotspotsInputSchema), controller.saveHotspots);
router.delete('/:id', controller.remove);
// Trigger pictures (image + MindAR data as base64 JSON, compiled in the admin's browser).
router.get('/:id/triggers', triggers.list);
router.post('/:id/triggers', express.json({ limit: '12mb' }), validateBody(triggers.addTriggerSchema), triggers.add);
router.delete('/:id/triggers/:triggerId', triggers.remove);

export default router;
