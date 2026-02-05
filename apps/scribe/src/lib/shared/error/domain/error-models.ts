/**
 * Error Domain Models
 *
 * Types for the centralized error handling system.
 */

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AppError {
  id: string;
  message: string;
  technicalDetails?: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: Date;
  stack?: string;
  reportable: boolean;
}

export interface ErrorContext {
  module?: string;
  tab?: string;
  action?: string;
  userId?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorReportData {
  errorId: string;
  message: string;
  technicalDetails?: string;
  stack?: string;
  context: ErrorContext;
  userAgent: string;
  url: string;
  timestamp: Date;
}

/**
 * Options for showing an error to the user
 */
export interface ShowErrorOptions {
  /** Error message to display */
  message: string;
  /** Technical details (shown in expandable section) */
  technicalDetails?: string;
  /** Error severity - determines presentation */
  severity?: ErrorSeverity;
  /** Context about where the error occurred */
  context?: Partial<ErrorContext>;
  /** Original error object (for stack trace) */
  error?: Error;
  /** Whether this error can be reported as a bug (default: true for error/critical) */
  reportable?: boolean;
  /** Auto-dismiss after duration (ms). 0 = no auto-dismiss. Default varies by severity */
  duration?: number;
}
