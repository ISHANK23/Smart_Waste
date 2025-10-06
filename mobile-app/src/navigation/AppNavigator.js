import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ScanScreen from '../screens/ScanScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import BillingScreen from '../screens/BillingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAuthState } from '../contexts/AuthContext';
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const tabBarIcon = (name, color, size) => <Ionicons name={name} size={size} color={color} />;
const MainTabs = () => {
  const { user } = useAuthState();
  const tabScreens = useMemo(() => {
    const tabs = [
      {
        name: 'Dashboard',
        component: DashboardScreen,
        icon: 'speedometer-outline'
      }
    ];
    if (user?.role === 'staff') {
      tabs.push({
        name: 'Scan',
        component: ScanScreen,
        icon: 'qr-code-outline'
      });
    }
    if (user?.role === 'resident') {
      tabs.push({
        name: 'Schedule',
        component: ScheduleScreen,
        icon: 'calendar-outline'
      });
    }
    tabs.push(
      {
        name: 'Billing',
        component: BillingScreen,
        icon: 'card-outline'
      },
      {
        name: 'Profile',
        component: ProfileScreen,
        icon: 'person-circle-outline'
      }
    );
    return tabs;
  }, [user?.role]);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const screen = tabScreens.find((tab) => tab.name === route.name);
          return tabBarIcon(screen?.icon || 'ellipse-outline', color, size);
        },
        tabBarActiveTintColor: '#0b8a6b',
        tabBarInactiveTintColor: '#7a7f85',
        headerShown: false
      })}
    >
      {tabScreens.map((tab) => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
};
const AppNavigator = () => {
  const { token, loading } = useAuthState();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#0b8a6b" />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
export default AppNavigator;