import { Router } from 'express';
import * as controller from '../controllers/student.controller';
import * as assessments from '../controllers/assessments.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validateBody } from '../middlewares/validate';

// The student app's API. Every route is scoped to the signed-in student.
const router = Router();

router.use(authenticate, authorize('STUDENT'));

router.get('/classes', controller.listClasses);
router.post('/classes/join', validateBody(controller.joinClassSchema), controller.joinClass);
router.get('/classes/:id', controller.getClass);
router.get('/lessons/:id', controller.getLesson);
router.post('/lessons/:id/complete', controller.completeLesson);
router.get('/quizzes/:id', controller.getQuiz);
router.post('/quizzes/:id/attempts', validateBody(controller.submitQuizSchema), controller.submitQuiz);
router.get('/progress', controller.getProgress);
// Class quizzes & exams made by the instructor.
router.get('/classes/:id/assessments', assessments.studentList);
router.get('/assessments/:id', assessments.studentGet);
router.post('/assessments/:id/attempts', assessments.studentStart);
router.post('/attempts/:attemptId/submit', validateBody(assessments.answersInputSchema), assessments.studentSubmit);
router.get('/attempts/:attemptId', assessments.studentReview);
router.get('/ar-models', controller.listArModels);
router.get('/ar-models/:id', controller.getArModel);

export default router;
