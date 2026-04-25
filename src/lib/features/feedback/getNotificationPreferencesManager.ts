import type { INotificationPreferencesManager } from '$lib/shared/push/services/contracts/INotificationPreferencesManager';
import { NotificationPreferencesManager } from './services/implementations/NotificationPreferencesManager';

let instance: INotificationPreferencesManager | null = null;
export function getNotificationPreferencesManager(): INotificationPreferencesManager {
  return instance ??= new NotificationPreferencesManager();
}
