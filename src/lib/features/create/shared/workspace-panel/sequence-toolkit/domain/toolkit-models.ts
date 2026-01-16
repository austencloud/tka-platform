import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ToolOperationType } from "./toolkit-enums";

/**
 * Base interface for all tool operation results
 */
export interface ToolOperationResult {
  success: boolean;
  operation: ToolOperationType;
  message?: string;
  error?: string;
}

/**
 * Result for operations that modify sequence data
 */
export interface SequenceOperationResult extends ToolOperationResult {
  sequence?: SequenceData;
  originalSequence?: SequenceData;
}

/**
 * Result for delete operations
 */
export interface DeleteOperationResult extends ToolOperationResult {
  deletedSequenceId?: string;
  affectedSequences?: SequenceData[];
}

/**
 * Result for export operations
 */
export interface ExportOperationResult extends ToolOperationResult {
  exportData?: string;
  exportFormat?: "json" | "fullscreen" | "Explore";
}

/**
 * Parameters for transform operations
 */
export interface TransformOperationParams {
  sequence: SequenceData;
  operation: ToolOperationType;
  newName?: string; // For duplicate operation
}

/**
 * Parameters for delete operations
 */
export interface DeleteOperationParams {
  sequenceId: string;
  operation: ToolOperationType;
  stepIndex?: number; // For single beat deletion
  stepIndices?: number[]; // For multiple beat deletion
  startIndex?: number; // For delete beat and following
}

/**
 * Parameters for export operations
 */
export interface ExportOperationParams {
  sequence: SequenceData;
  operation: ToolOperationType;
  format?: "json" | "fullscreen" | "Explore";
}

/**
 * Tool state for tracking current operation
 */
export interface ToolState {
  currentOperation?: ToolOperationType;
  isProcessing: boolean;
  lastResult?: ToolOperationResult;
  selectedTool?: ToolOperationType;
}

/**
 * Tool configuration options
 */
export interface ToolConfig {
  enabledOperations: ToolOperationType[];
  confirmDestructiveOperations: boolean;
  autoSaveAfterOperations: boolean;
}

export interface ToolOperationMetadata {
  type: ToolOperationType;
  name: string;
  description: string;
  icon: string;
  isDestructive: boolean;
  requiresConfirmation: boolean;
  category: "transform" | "delete" | "share";
}
