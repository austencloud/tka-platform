/**
 * Sequence Toolkit State Management
 *
 * Manages state for sequence toolkit operations including tool selection,
 * operation progress, and results. Uses Svelte 5 runes for reactivity.
 */

import type {
  ToolConfig,
  ToolOperationResult,
  ToolState,
} from "../domain/toolkit-models";
import type { ToolOperationType } from "../domain/toolkit-enums";
import { TOOL_OPERATIONS } from "../domain/toolkit-constants";

/**
 * Factory function to create toolkit state
 */
export function createToolkitState() {
  // Core state
  let currentOperation = $state<ToolOperationType | undefined>(undefined);
  let isProcessing = $state<boolean>(false);
  let lastResult = $state<ToolOperationResult | undefined>(undefined);
  let selectedTool = $state<ToolOperationType | undefined>(undefined);
  let error = $state<string | undefined>(undefined);

  // Configuration
  let config = $state<ToolConfig>({
    enabledOperations: Object.keys(TOOL_OPERATIONS) as ToolOperationType[],
    confirmDestructiveOperations: true,
    autoSaveAfterOperations: false,
  });

  // Operation history
  let operationHistory = $state<ToolOperationResult[]>([]);

  // Derived state
  const toolState = $derived(
    () =>
      ({
        currentOperation,
        isProcessing,
        lastResult,
        selectedTool,
      }) as ToolState
  );

  const hasError = $derived(() => !!error);
  const canPerformOperations = $derived(() => !isProcessing);
  const lastOperationSuccess = $derived(() => lastResult?.success ?? false);

  // Actions
  function selectTool(tool: ToolOperationType): void {
    if (isProcessing) return;
    selectedTool = tool;
    error = undefined;
  }

  function clearSelection(): void {
    if (isProcessing) return;
    selectedTool = undefined;
    error = undefined;
  }

  function startOperation(operation: ToolOperationType): void {
    currentOperation = operation;
    isProcessing = true;
    error = undefined;
  }

  function completeOperation(result: ToolOperationResult): void {
    isProcessing = false;
    currentOperation = undefined;
    lastResult = result;

    // Add to history
    operationHistory = [...operationHistory, result];

    // Keep only last 50 operations
    if (operationHistory.length > 50) {
      operationHistory = operationHistory.slice(-50);
    }

    if (!result.success) {
      error = result.error || "Operation failed";
    } else {
      error = undefined;
    }
  }

  function setError(errorMessage: string): void {
    error = errorMessage;
    isProcessing = false;
    currentOperation = undefined;
  }

  function clearError(): void {
    error = undefined;
  }

  function updateConfig(newConfig: Partial<ToolConfig>): void {
    config = { ...config, ...newConfig };
  }

  function isOperationEnabled(operation: ToolOperationType): boolean {
    return config.enabledOperations.includes(operation);
  }

  function requiresConfirmation(operation: ToolOperationType): boolean {
    const metadata = TOOL_OPERATIONS[operation];
    return config.confirmDestructiveOperations && metadata.requiresConfirmation;
  }

  function getOperationMetadata(operation: ToolOperationType) {
    return TOOL_OPERATIONS[operation];
  }

  function clearHistory(): void {
    operationHistory = [];
  }

  function getRecentOperations(count: number = 10): ToolOperationResult[] {
    return operationHistory.slice(-count);
  }

  function getOperationsByType(type: ToolOperationType): ToolOperationResult[] {
    return operationHistory.filter((op) => op.operation === type);
  }

  function reset(): void {
    currentOperation = undefined;
    isProcessing = false;
    lastResult = undefined;
    selectedTool = undefined;
    error = undefined;
    operationHistory = [];
  }

  // Return state interface
  return {
    // State getters
    get currentOperation() {
      return currentOperation;
    },
    get isProcessing() {
      return isProcessing;
    },
    get lastResult() {
      return lastResult;
    },
    get selectedTool() {
      return selectedTool;
    },
    get error() {
      return error;
    },
    get config() {
      return config;
    },
    get operationHistory() {
      return operationHistory;
    },

    // Derived state
    get toolState() {
      return toolState;
    },
    get hasError() {
      return hasError;
    },
    get canPerformOperations() {
      return canPerformOperations;
    },
    get lastOperationSuccess() {
      return lastOperationSuccess;
    },

    // Actions
    selectTool,
    clearSelection,
    startOperation,
    completeOperation,
    setError,
    clearError,
    updateConfig,
    isOperationEnabled,
    requiresConfirmation,
    getOperationMetadata,
    clearHistory,
    getRecentOperations,
    getOperationsByType,
    reset,
  };
}

export type ToolkitState = ReturnType<typeof createToolkitState>;
