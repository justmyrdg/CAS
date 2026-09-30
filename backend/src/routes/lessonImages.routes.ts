import express, { Router } from 'express';
import * as controller from '../controllers/lessonImages.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { MAX_IMAGE_BYTES } from '../services/lessonImages.service';

// Mounted at /api/admin/images — admins/deans upload images for lesson image blocks.
const router = Router();

router.use(authenticate, authorize('ADMIN', 'DEAN'));

// The image is the raw request body (any content type); a little headroom over the limit so an
// oversized file reaches the service and gets its friendly "5 MB or smaller" message.
router.post('/', express.raw({ type: () => true, limit: MAX_IMAGE_BYTES + 1024 }), controller.upload);

export default router;
