/**
 * LOOP Labeler Domain Types
 *
 * Standalone types with no imports to avoid circular dependencies.
 */

export type LabelingMode = "whole" | "section" | "steppair";
export type SyncStatus = "idle" | "syncing" | "synced" | "error";
