import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  ClassList: undefined;
  Scan: undefined; // the middle camera button — opens the AR card scanner (ArViewer with no params)
  Progress: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ChangePassword: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  JoinClass: undefined;
  ModuleChapter: { classId: string };
  Lesson: { lessonId: string; crumb: string };
  Quiz: { quizId: string; crumb: string };
  // An instructor-made class quiz or exam.
  Assessment: { assessmentId: string; title: string };
  // No params = the AR card scanner (scan a printed card to pick the model).
  ArViewer: { modelId: string; modelName: string } | undefined;
};
