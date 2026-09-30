import { Router } from 'express';
import * as controller from '../controllers/catalog.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

// Admin/dean management of the Subject -> Module -> Chapter catalog.
const router = Router();

router.use(authenticate, authorize('ADMIN', 'DEAN'));

router.get('/subjects', controller.listSubjects);
router.post('/subjects', validateBody(controller.createSubjectSchema), controller.createSubject);
router.get('/subjects/:id', controller.getSubject);
router.patch('/subjects/:id', validateBody(controller.updateSubjectSchema), controller.updateSubject);
router.delete('/subjects/:id', controller.deleteSubject);

router.post('/subjects/:id/modules', validateBody(controller.createModuleSchema), controller.createModule);
router.put('/subjects/:id/modules/order', validateBody(controller.reorderSchema), controller.reorderModules);
router.patch('/modules/:id', validateBody(controller.updateItemSchema), controller.updateModule);
// Whole-form save from the module editor: module fields + its full, ordered chapter list.
router.put('/modules/:id', validateBody(controller.saveModuleSchema), controller.saveModule);
router.delete('/modules/:id', controller.deleteModule);

router.post('/modules/:id/chapters', validateBody(controller.createItemSchema), controller.createChapter);
router.put('/modules/:id/chapters/order', validateBody(controller.reorderSchema), controller.reorderChapters);
router.patch('/chapters/:id', validateBody(controller.updateItemSchema), controller.updateChapter);
router.delete('/chapters/:id', controller.deleteChapter);

router.post('/chapters/:id/content', controller.createContent);
router.put('/chapters/:id/content/order', validateBody(controller.reorderSchema), controller.reorderContent);
router.get('/content/:id', controller.getContent);
// Validated in the controller against the stored item's type (lesson vs quiz).
router.put('/content/:id', controller.saveContent);
router.delete('/content/:id', controller.deleteContent);

export default router;
