// Enums & type aliases
export type {
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
  ArchiveReason,
  ClaimHealth,
  StaleReason,
  AgentType,
  FeedbackSource,
  TesterConfirmationStatus,
  SubtaskStatus,
  ChangelogCategory,
} from "./enums.js";
export { FEEDBACK_STATUSES, FEEDBACK_TYPES, ARCHIVE_REASONS } from "./enums.js";

// Domain models
export type {
  FeedbackItem,
  FeedbackSubtask,
  AdminResponse,
  TesterConfirmation,
  StatusHistoryEntry,
  DeviceContext,
  AppVersion,
  FeedbackSummary,
  ChangelogEntry,
  FeedbackFormData,
  FeedbackFormErrors,
  FeedbackSubmitStatus,
  FeedbackFilterOptions,
  FeedbackDraft,
  VersionFeedbackItem,
  PrepareReleaseFormData,
  PrepareReleaseFormErrors,
} from "./models.js";
export { PRE_RELEASE_VERSION } from "./models.js";

// Configuration
export {
  STALE_THRESHOLDS,
  STALE_CLAIM_MS,
  AGENT_SESSION_CONFIG,
  EMERGENCY_CONFIG,
  WIP_LIMITS,
  checkClaimStaleness,
  isApproachingStale,
  formatDuration,
} from "./config.js";

// Display config
export {
  STATUS_CONFIG,
  CONFIRMATION_STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  ARCHIVE_REASON_CONFIG,
} from "./display-config.js";

// Guards
export {
  isFeedbackStatus,
  isFeedbackType,
  isArchiveReason,
} from "./guards.js";

// Notification models
export type {
  NotificationType,
  BaseNotification,
  FeedbackNotification,
  SequenceNotification,
  SocialNotification,
  MessageNotification,
  SystemNotification,
  AdminNotification,
  ModerationNotification,
  UserNotification,
  TesterNotification,
  NotificationPreferences,
} from "./notification-models.js";
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getPreferenceKeyForType,
  NOTIFICATION_TYPE_CONFIG,
} from "./notification-models.js";

// AI settings models
export type {
  AIProviderType,
  OllamaSettings,
  ClaudeSettings,
  OpenAISettings,
  AIAnalysisSettings,
} from "./ai-settings-models.js";
export {
  CLAUDE_MODELS,
  OPENAI_MODELS,
  DEFAULT_AI_SETTINGS,
} from "./ai-settings-models.js";
