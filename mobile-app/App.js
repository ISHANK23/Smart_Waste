import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { OfflineQueueProvider } from './src/contexts/OfflineQueueContext';
import { SyncProvider } from './src/contexts/SyncContext';
import { useNotifications } from './src/hooks/useNotifications';
const App = () => {
  useNotifications();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <OfflineQueueProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <AppNavigator />
            </NavigationContainer>
          </OfflineQueueProvider>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};
export default App;