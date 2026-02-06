/**
 * IFeedbackEditor
 *
 * Contract for managing feedback field edits with snapshot-based change detection.
 * Provides utilities for tracking changes, validating fields, and restoring from snapshots.
 */

import type {
  FeedbackItem,
  FeedbackType,
  FeedbackPriority,
} from "../../domain/models/feedback-models";

/**
 * Snapshot of feedback state for change detection
 */
export interface EditSnapshot {
  type: FeedbackType;
  priority: FeedbackPriority | "";
  title: string;
  description: string;
}

/**
 * Editable fields of a feedback item
 */
export interface EditableFields {
  type: FeedbackType;
  priority: FeedbackPriority | "";
  title: string;
  description: string;
}

/**
 * Validation result for fields
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Contract for feedback editing operations
 */
export interface IFeedbackEditor {
  /**
   * Create a snapshot of current feedback state for change tracking
   */
  createSnapshot(item: FeedbackItem): EditSnapshot;

  /**
   * Check if current values differ from snapshot
   */
  hasChanges(current: EditableFields, snapshot: EditSnapshot): boolean;

  /**
   * Restore fields from snapshot
   */
  restoreFromSnapshot(snapshot: EditSnapshot): EditableFields;

  /**
   * Validate editable fields
   */
  validateFields(fields: EditableFields): ValidationResult;
}
