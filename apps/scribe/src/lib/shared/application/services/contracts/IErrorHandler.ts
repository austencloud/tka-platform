/**
 * Error Handling Service Interface
 *
 * Centralized error handling and reporting for the application.
 * Provides both internal logging and user-facing error display.
 */

import type {
  ShowErrorOptions,
  ErrorContext,
} from "$lib/shared/error/domain/error-models";

export interface IErrorHandler {
  /**
   * Handle and log an error (internal logging only)
   */
  handleError(error: Error, context?: string): void;

  /**
   * Report a critical error (internal logging only)
   */
  reportCriticalError(error: Error, context?: string): void;

  /**
   * Show an error to the user via modal/toast
   * This is the primary method for user-facing errors
   */
  showUserError(options: ShowErrorOptions): string;

  /**
   * Show an error to the user with simplified API
   * Convenience method that wraps showUserError
   */
  showError(
    message: string,
    error?: Error,
    context?: Partial<ErrorContext>
  ): string;

  /**
   * Show a warning to the user (auto-dismisses)
   */
  showWarning(message: string, context?: Partial<ErrorContext>): string;

  /**
   * Dismiss the current error modal
   */
  dismissError(): void;

  /**
   * Submit an error as a bug report
   * Returns the feedback ID if successful
   */
  reportBug(
    errorId: string,
    additionalComment?: string
  ): Promise<string | null>;

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    criticalErrors: number;
    lastError?: Date;
  };

  /**
   * Clear error history
   */
  clearErrors(): void;
}
