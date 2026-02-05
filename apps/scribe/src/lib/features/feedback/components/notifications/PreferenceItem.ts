import type { NotificationPreferences } from "../../domain/models/notification-models";

export type PreferenceItem = {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
};
