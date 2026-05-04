import type { NotificationPreferences } from "$lib/shared/feedback/domain/models/notification-models";

export type PreferenceItem = {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
};
