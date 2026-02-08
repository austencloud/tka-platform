/**
 * Feedback system domain models.
 *
 * FeedbackItem is the canonical shape stored in Firestore.
 * Both Cirque Aflame and TKA Platform use this exact interface.
 */

import type {
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
  FeedbackSource,
  ArchiveReason,
  TesterConfirmationStatus,
  SubtaskStatus,
  ChangelogCategory,
} from "./enums.js";

/**
 * Draft persistence data structure
 */
export interface FeedbackDraft {
  formData: FeedbackFormData;
  timestamp: number;
}

/**
 * Device context data captured on feedback submission
 */
export interface DeviceContext {
  // Device & Browser
  userAgent: string;
  platform: string;
  isTouchDevice: boolean;

  // Viewport & Screen
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;

  // App Context
  appVersion: string;
  currentModule?: string;
  currentTab?: string;

  // Timestamp
  capturedAt: Date;
}

/**
 * Subtask for breaking down complex feedback into prerequisites
 */
export interface FeedbackSubtask {
  id: string;
  title: string;
  description: string;
  status: SubtaskStatus;
  completedAt?: Date;
  dependsOn?: string[];
}

/**
 * Admin response to tester - visible in tester's "My Feedback" view
 */
export interface AdminResponse {
  message: string;
  respondedAt: Date;
  respondedBy: string;
}

/**
 * Tester's confirmation after fix is implemented
 */
export interface TesterConfirmation {
  status: TesterConfirmationStatus;
  comment?: string;
  respondedAt?: Date;
}

/**
 * Status change history entry
 */
export interface StatusHistoryEntry {
  status: FeedbackStatus;
  timestamp: Date;
  fromStatus?: FeedbackStatus;
  actorId?: string;
  actorName?: string;
  notes?: string;
}

/**
 * Core feedback item stored in Firestore
 */
export interface FeedbackItem {
  id: string;
  createdAt: Date;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL?: string;

  // Feedback content
  type: FeedbackType;
  title: string;
  description: string;
  priority?: FeedbackPriority;
  imageUrls?: string[];

  // Original content (write-once, never overwritten)
  originalTitle?: string;
  originalDescription?: string;

  // Context (auto-captured)
  capturedModule: string;
  capturedTab: string;
  deviceContext?: DeviceContext;

  // Source tracking
  source?: FeedbackSource;

  // Admin management
  status: FeedbackStatus;
  adminNotes?: string;
  userFacingNotes?: string;
  changelogEntry?: string;
  updatedAt?: Date;

  // Claim tracking
  claimedAt?: Date;
  claimedBy?: string;
  claimToken?: string;
  claimSession?: string;
  lastActivity?: Date;
  lastActivityType?: string;

  // Subtasks
  subtasks?: FeedbackSubtask[];

  // Admin response to tester
  adminResponse?: AdminResponse;

  // Tester confirmation
  testerConfirmation?: TesterConfirmation;

  // Soft delete
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;

  // Version tracking (set when archived)
  fixedInVersion?: string;
  archivedAt?: Date;
  archiveReason?: ArchiveReason;

  // Message tracking
  lastNotifiedAt?: Date;
  lastNotifiedStatus?: FeedbackStatus;

  // Deferment
  deferredUntil?: Date;
  reactivatedAt?: Date;
  reactivatedFrom?: Date;

  // Status change history
  statusHistory?: StatusHistoryEntry[];
}

/**
 * Form data for feedback submission
 */
export interface FeedbackFormData {
  type: FeedbackType;
  title: string;
  description: string;
}

/**
 * Form validation errors
 */
export interface FeedbackFormErrors {
  type?: string;
  title?: string;
  description?: string;
}

/**
 * Form submission status
 */
export type FeedbackSubmitStatus = "idle" | "submitting" | "success" | "error";

/**
 * Filter options for manage tab
 */
export interface FeedbackFilterOptions {
  type: FeedbackType | "all";
  status: FeedbackStatus | "all";
  priority: FeedbackPriority | "all";
}

/**
 * Summary counts by feedback type
 */
export interface FeedbackSummary {
  bugs: number;
  features: number;
  general: number;
}

/**
 * A single user-facing changelog entry
 */
export interface ChangelogEntry {
  category: ChangelogCategory;
  text: string;
  feedbackId?: string;
}

/**
 * App version record stored in Firestore
 */
export interface AppVersion {
  version: string;
  releasedAt: Date;
  releaseNotes?: string;
  feedbackCount: number;
  feedbackSummary: FeedbackSummary;
  changelogEntries?: ChangelogEntry[];
  highlights?: string[];
}

/**
 * Lightweight feedback item for version lists
 */
export interface VersionFeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
}

/**
 * Form data for preparing a release
 */
export interface PrepareReleaseFormData {
  version: string;
}

/**
 * Validation errors for release form
 */
export interface PrepareReleaseFormErrors {
  version?: string;
}

/**
 * Pre-release version for existing archived feedback
 */
export const PRE_RELEASE_VERSION = "0.0.0";
