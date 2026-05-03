/**
 * FeedbackEditor
 *
 * Implements snapshot-based change detection and field validation for feedback items.
 * Used by FeedbackDetailState to track edits and restore from snapshots.
 */

import type { EditSnapshot, EditableFields, ValidationResult } from "../contracts/types";
import type { FeedbackItem } from "../../domain/models/feedback-models";

export class FeedbackEditor {
  /**
   * Create a snapshot of current feedback state for change tracking
   */
  createSnapshot(item: FeedbackItem): EditSnapshot {
    return {
      type: item.type,
      priority: item.priority || "",
      title: item.title,
      description: item.description,
    };
  }

  /**
   * Check if current values differ from snapshot
   */
  hasChanges(current: EditableFields, snapshot: EditSnapshot): boolean {
    return (
      current.type !== snapshot.type ||
      current.priority !== snapshot.priority ||
      current.title !== snapshot.title ||
      current.description !== snapshot.description
    );
  }

  /**
   * Restore fields from snapshot (creates immutable copy)
   */
  restoreFromSnapshot(snapshot: EditSnapshot): EditableFields {
    return {
      type: snapshot.type,
      priority: snapshot.priority,
      title: snapshot.title,
      description: snapshot.description,
    };
  }

  /**
   * Validate editable fields
   */
  validateFields(fields: EditableFields): ValidationResult {
    const errors: Record<string, string> = {};

    if (!fields.title.trim()) {
      errors.title = "Title is required";
    }

    if (!fields.description.trim()) {
      errors.description = "Description is required";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
