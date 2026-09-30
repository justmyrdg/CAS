import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuth } from '../state/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import MainTabs from './MainTabs';
import JoinClassScreen from '../screens/JoinClassScreen';
import ModuleChapterScreen from '../screens/ModuleChapterScreen';
import LessonScreen from '../screens/LessonScreen';
import QuizScreen from '../screens/QuizScreen';
import AssessmentScreen from '../screens/AssessmentScreen';
import ArViewerScreen from '../screens/ArViewerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Which screens exist depends on the session: signed out -> Login only;
// on a temporary password -> Change Password only; otherwise the app.
// Switching the set is what moves the student between them (no manual navigate after login/logout).
export default function RootNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : user.mustChangePassword ? (
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="JoinClass" component={JoinClassScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="ModuleChapter" component={ModuleChapterScreen} />
          <Stack.Screen name="Lesson" component={LessonScreen} />
          <Stack.Screen name="Quiz" component={QuizScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Assessment" component={AssessmentScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="ArViewer" component={ArViewerScreen} options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
