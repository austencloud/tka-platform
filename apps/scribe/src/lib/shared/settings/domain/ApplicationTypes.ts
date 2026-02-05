/**
 * Application Core Types
 *
 * Core application configuration, state, and lifecycle types.
 */

export interface ApplicationConfig {
  version: string;
  environment: "development" | "production" | "test";
  features: Record<string, boolean>;
}

export interface ApplicationStateModel {
  isInitialized: boolean;
  currentUser?: string;
  preferences: Record<string, unknown>;
}

export interface InitializationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface ApplicationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface ApplicationPerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  errorCount: number;
}

export interface ProcessingResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}
