import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});
export const useNotifications = () => {
  const [status, setStatus] = useState(null);
  const registerForPushNotificationsAsync = async () => {
    try {
      const settings = await Notifications.getPermissionsAsync();
      let finalStatus = settings.status;
      if (settings.status !== 'granted') {
        const request = await Notifications.requestPermissionsAsync();
        finalStatus = request.status;
      }
      if (finalStatus !== 'granted') {
        setStatus('denied');
        return null;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      setStatus('granted');
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250]
        });
      }
      return token?.data;
    } catch (error) {
      console.warn('Notification registration failed', error);
      setStatus('error');
      return null;
    }
  };
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);
  return { status };
};