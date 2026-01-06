/**
 * Error State - Centralized error UI state management
 *
 * Uses Svelte 5 runes for reactive state. This is the single source of truth
 * for displaying error modals/toasts to users.
 */

import type { AppError, ErrorSeverity, ShowErrorOptions } from "../domain/error-models";

// Reactive error state
let currentError = $state<AppError | null>(null);
let errorHistory = $state<AppError[]>([]);

let errorIdCounter = 0;

/**
 * Show an error to the user
 * Returns the error ID
 */
export function showError(options: ShowErrorOptions): string {
  const id = `error_${++errorIdCounter}_${Date.now()}`;

  const severity = options.severity ?? "error";
  const reportable =
    options.reportable ?? (severity === "error" || severity === "critical");

  const appError: AppError = {
    id,
    message: options.message,
    technicalDetails: options.technicalDetails ?? options.error?.message,
    severity,
    context: {
      module: options.context?.module,
      tab: options.context?.tab,
      action: options.context?.action,
      userId: options.context?.userId,
      additionalData: options.context?.additionalData,
    },
    timestamp: new Date(),
    stack: options.error?.stack,
    reportable,
  };

  currentError = appError;
  errorHistory.push(appError);

  // Keep history bounded
  if (errorHistory.length > 50) {
    errorHistory = errorHistory.slice(-50);
  }

  // Auto-dismiss for non-critical errors if duration specified
  const duration = options.duration ?? getDefaultDuration(severity);
  if (duration > 0) {
    setTimeout(() => {
      if (currentError?.id === id) {
        dismissError();
      }
    }, duration);
  }

  return id;
}

/**
 * Dismiss the current error
 */
export function dismissError(): void {
  currentError = null;
}

/**
 * Clear error history
 */
export function clearErrorHistory(): void {
  errorHistory = [];
}

/**
 * Get default auto-dismiss duration based on severity
 */
function getDefaultDuration(severity: ErrorSeverity): number {
  switch (severity) {
    case "info":
      return 3000;
    case "warning":
      return 5000;
    case "error":
      return 0; // Don't auto-dismiss errors
    case "critical":
      return 0; // Don't auto-dismiss critical errors
    default:
      return 0;
  }
}

// Export reactive getters
export function getCurrentError(): AppError | null {
  return currentError;
}

export function getErrorHistory(): AppError[] {
  return errorHistory;
}

// Convenience methods matching toast API style
export const appError = {
  info: (message: string, options?: Partial<ShowErrorOptions>) =>
    showError({ message, severity: "info", ...options }),
  warning: (message: string, options?: Partial<ShowErrorOptions>) =>
    showError({ message, severity: "warning", ...options }),
  error: (message: string, options?: Partial<ShowErrorOptions>) =>
    showError({ message, severity: "error", ...options }),
  critical: (message: string, options?: Partial<ShowErrorOptions>) =>
    showError({ message, severity: "critical", ...options }),
};
