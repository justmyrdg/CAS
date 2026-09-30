import { useCallback } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useWorkSansFonts,
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
} from '@expo-google-fonts/work-sans';
import { useFonts as useSourceSerifFonts, SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/state/AuthContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Keeps the splash screen up until fonts are loaded and the saved session has been restored.
function AppContent() {
  const { initializing } = useAuth();
  const [workSansLoaded] = useWorkSansFonts({
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
  });
  const [serifLoaded] = useSourceSerifFonts({ SourceSerif4_700Bold });

  const ready = workSansLoaded && serifLoaded && !initializing;

  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </View>
  );
}
