/**
 * Notification Action State
 *
 * Tracks which feedback item should be opened when navigating from a notification.
 * Used to coordinate between NotificationCenterWidget and MyFeedbackTab/FeedbackManageTab.
 */

let targetFeedbackId = $state<string | null>(null);

/**
 * Reactive state object for use in components
 * Export the state directly for proper Svelte 5 reactivity tracking
 */
export const notificationTargetState = {
  get feedbackId() {
    return targetFeedbackId;
  },
  set feedbackId(id: string | null) {
    targetFeedbackId = id;
  },
  take(): string | null {
    const id = targetFeedbackId;
    targetFeedbackId = null;
    return id;
  },
};

/**
 * Set which feedback should be opened
 */
export function setNotificationTargetFeedback(feedbackId: string | null) {
  targetFeedbackId = feedbackId;
}

/**
 * Get and clear the target feedback ID
 */
export function takeNotificationTargetFeedback(): string | null {
  const id = targetFeedbackId;
  targetFeedbackId = null;
  return id;
}

/**
 * Get the current target feedback ID without clearing
 */
export function getNotificationTargetFeedback(): string | null {
  return targetFeedbackId;
}
