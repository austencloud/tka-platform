/**
 * Notification Domain Models
 *
 * Types for tester notifications when their feedback is addressed.
 */

/**
 * Notification type classification
 */
export type NotificationType =
  | "feedback-resolved"
  | "feedback-in-progress"
  | "feedback-needs-info"
  | "feedback-response"
  | "sequence-liked"
  | "user-followed"
  | "achievement-unlocked"
  | "message-received"
  | "admin-new-user-signup"
  | "system-announcement"
  | "moderation-warning";

/**
 * Base notification interface
 */
export interface BaseNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  createdAt: Date;
  read: boolean;
  readAt?: Date;
  fromUserId?: string;
  fromUserName?: string;
}

/**
 * Feedback-related notification
 */
export interface FeedbackNotification extends BaseNotification {
  type:
    | "feedback-resolved"
    | "feedback-in-progress"
    | "feedback-needs-info"
    | "feedback-response";
  feedbackId: string;
  feedbackTitle: string;
  fromUserId: string;
  fromUserName: string;
}

/**
 * Sequence-related notification
 */
export interface SequenceNotification extends BaseNotification {
  type: "sequence-liked";
  sequenceId: string;
  sequenceTitle: string;
  fromUserId: string;
  fromUserName: string;
}

/**
 * Social notification
 */
export interface SocialNotification extends BaseNotification {
  type: "user-followed" | "achievement-unlocked";
  fromUserId?: string;
  fromUserName?: string;
  achievementId?: string;
  achievementName?: string;
}

/**
 * Message notification (direct messages)
 */
export interface MessageNotification extends BaseNotification {
  type: "message-received";
  conversationId: string;
  fromUserId: string;
  fromUserName: string;
  messagePreview: string;
}

/**
 * System notification
 */
export interface SystemNotification extends BaseNotification {
  type: "system-announcement";
  title: string;
  actionUrl?: string;
}

/**
 * Admin notification
 */
export interface AdminNotification extends BaseNotification {
  type: "admin-new-user-signup";
  newUserId: string;
  newUserEmail: string | null;
  newUserDisplayName: string;
}

/**
 * Moderation notification
 */
export interface ModerationNotification extends BaseNotification {
  type: "moderation-warning";
  reportId: string;
  category: string;
  adminMessage?: string;
}

/**
 * Union type for all notifications
 */
export type UserNotification =
  | FeedbackNotification
  | SequenceNotification
  | SocialNotification
  | MessageNotification
  | SystemNotification
  | AdminNotification
  | ModerationNotification;

/**
 * Legacy alias for backward compatibility
 * @deprecated Use FeedbackNotification instead
 */
export type TesterNotification = FeedbackNotification;

/**
 * Notification preferences - stored per user
 */
export interface NotificationPreferences {
  pushEnabled: boolean;
  feedbackResolved: boolean;
  feedbackInProgress: boolean;
  feedbackNeedsInfo: boolean;
  feedbackResponse: boolean;
  sequenceSaved: boolean;
  sequenceVideoSubmitted: boolean;
  sequenceLiked: boolean;
  sequenceCommented: boolean;
  userFollowed: boolean;
  achievementUnlocked: boolean;
  messageReceived: boolean;
  adminNewUserSignup: boolean;
}

/**
 * Default notification preferences (all enabled)
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  feedbackResolved: true,
  feedbackInProgress: true,
  feedbackNeedsInfo: true,
  feedbackResponse: true,
  sequenceSaved: true,
  sequenceVideoSubmitted: true,
  sequenceLiked: true,
  sequenceCommented: true,
  userFollowed: true,
  achievementUnlocked: true,
  messageReceived: true,
  adminNewUserSignup: true,
};

export function getPreferenceKeyForType(
  type: NotificationType
): keyof NotificationPreferences | null {
  const typeToKey: Record<string, keyof NotificationPreferences> = {
    "feedback-resolved": "feedbackResolved",
    "feedback-in-progress": "feedbackInProgress",
    "feedback-needs-info": "feedbackNeedsInfo",
    "feedback-response": "feedbackResponse",
    "sequence-liked": "sequenceLiked",
    "user-followed": "userFollowed",
    "achievement-unlocked": "achievementUnlocked",
    "message-received": "messageReceived",
    "admin-new-user-signup": "adminNewUserSignup",
  };

  return typeToKey[type] || null;
}

/**
 * Notification display configuration
 */
export const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { label: string; color: string; icon: string; actionLabel: string }
> = {
  "feedback-resolved": {
    label: "Feedback Resolved",
    color: "#10b981",
    icon: "fa-check-circle",
    actionLabel: "View Details",
  },
  "feedback-in-progress": {
    label: "Being Worked On",
    color: "#f59e0b",
    icon: "fa-spinner",
    actionLabel: "View Details",
  },
  "feedback-needs-info": {
    label: "More Info Needed",
    color: "#8b5cf6",
    icon: "fa-question-circle",
    actionLabel: "Respond",
  },
  "feedback-response": {
    label: "Admin Response",
    color: "#3b82f6",
    icon: "fa-comment",
    actionLabel: "View Message",
  },
  "sequence-liked": {
    label: "Sequence Liked",
    color: "#ec4899",
    icon: "fa-heart",
    actionLabel: "View Sequence",
  },
  "user-followed": {
    label: "New Follower",
    color: "#06b6d4",
    icon: "fa-user-plus",
    actionLabel: "View Profile",
  },
  "achievement-unlocked": {
    label: "Achievement Unlocked",
    color: "#f59e0b",
    icon: "fa-trophy",
    actionLabel: "View Achievement",
  },
  "message-received": {
    label: "New Message",
    color: "#8b5cf6",
    icon: "fa-envelope",
    actionLabel: "View Message",
  },
  "admin-new-user-signup": {
    label: "New User Signup",
    color: "#10b981",
    icon: "fa-user-plus",
    actionLabel: "View User",
  },
  "system-announcement": {
    label: "System Announcement",
    color: "#6366f1",
    icon: "fa-bell",
    actionLabel: "Learn More",
  },
  "moderation-warning": {
    label: "Account Warning",
    color: "#ef4444",
    icon: "fa-exclamation-triangle",
    actionLabel: "View Details",
  },
};
