import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import type { NavigationProp } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from './types';
import TabIcon from '../components/TabIcon';
import { colors, fonts } from '../theme/colors';
import { useLayout } from '../lib/responsive';
import ClassListScreen from '../screens/ClassListScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS = {
  ClassList: 'classes',
  Scan: 'camera',
  Progress: 'progress',
  Profile: 'profile',
} as const;

const LABELS: Record<keyof MainTabParamList, string> = {
  ClassList: 'Classes',
  Scan: 'Scan',
  Progress: 'Progress',
  Profile: 'Profile',
};

// The Scan tab never shows a screen of its own: pressing it opens the AR card scanner (see listeners below).
function ScanPlaceholder() {
  return null;
}

// The raised round camera button in the middle of the tab bar.
function ScanButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  return (
    <View style={styles.scanSlot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Scan an AR card"
        accessibilityState={accessibilityState}
        style={({ pressed }) => [styles.scanButton, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <TabIcon name="camera" color="#fff" size={28} />
      </Pressable>
      <Text style={styles.scanLabel}>Scan</Text>
    </View>
  );
}

// Phone and tablet: the bar along the bottom with the raised scan button.
// Desktop: no bar here, the sidebar in DesktopShell does the navigating.
export default function MainTabs() {
  const { isDesktop } = useLayout();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: isDesktop ? { display: 'none' } : { height: 64, borderTopColor: colors.border, overflow: 'visible' },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarIcon: ({ color }) => <TabIcon name={ICONS[route.name]} color={color} />,
        tabBarLabel: LABELS[route.name],
      })}
    >
      <Tab.Screen name="ClassList" component={ClassListScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen
        name="Scan"
        component={ScanPlaceholder}
        options={{ tabBarButton: (props) => <ScanButton {...props} /> }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            // ArViewer lives on the root stack; with no params it's the AR card scanner.
            (navigation as unknown as NavigationProp<RootStackParamList>).navigate('ArViewer');
          },
        })}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scanSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  scanButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scanLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary, marginTop: 2 },
});
