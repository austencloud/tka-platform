/**
 * Notification State - Svelte 5 Runes
 *
 * Reactive state for achievement notifications using Svelte 5 runes.
 * This provides a centralized, reactive notification queue for the UI.
 */

import type { AchievementNotification } from "../domain/models/achievement-models";

// Reactive notification queue - export directly for reactive access
export const notificationQueue = $state<AchievementNotification[]>([]);

// Actions
export function addNotification(notification: AchievementNotification): void {
  notificationQueue.push(notification);
}

export function removeNotification(): AchievementNotification | undefined {
  return notificationQueue.shift();
}

export function clearNotifications(): void {
  notificationQueue.length = 0;
}
