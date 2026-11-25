import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { emitNotice, type AlertNotice } from '@/services/notices';

let configured = false;

async function ensureConfigured(): Promise<void> {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('budgets', {
      name: 'Budget alerts',
      importance: AndroidImportance.DEFAULT,
    });
  }
  configured = true;
}

export async function notificationPermission(): Promise<boolean> {
  try {
    await ensureConfigured();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function publishAlert(notice: AlertNotice, system: boolean): Promise<void> {
  emitNotice(notice);
  if (!system) return;
  try {
    await ensureConfigured();
    await Notifications.scheduleNotificationAsync({
      content: { title: notice.title, body: notice.body, sound: false },
      trigger: null,
    });
  } catch {
    // In-app notice already landed. A denied permission should not block the save.
  }
}
