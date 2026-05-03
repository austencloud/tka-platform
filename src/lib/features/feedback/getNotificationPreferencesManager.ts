import { NotificationPreferencesManager } from './services/implementations/NotificationPreferencesManager';

let instance: NotificationPreferencesManager | null = null;
export function getNotificationPreferencesManager(): NotificationPreferencesManager {
  return instance ??= new NotificationPreferencesManager();
}
