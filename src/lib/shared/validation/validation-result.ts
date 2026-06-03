/**
 * Standard validation result interface used across the application
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorInfo[];
  warnings?: ValidationWarning[];
}

export interface ValidationErrorInfo {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
  severity: "error" | "warning" | "info";
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}
