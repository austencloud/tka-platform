/**
 * Audit Logger Interface
 *
 * Immutable record of all admin operations for accountability and debugging.
 */

export type AuditActionType =
  | "role_changed"
  | "account_disabled"
  | "account_enabled"
  | "user_data_reset"
  | "user_deleted"
  | "challenge_created"
  | "challenge_updated"
  | "challenge_deleted"
  | "announcement_created"
  | "announcement_updated"
  | "announcement_deleted"
  | "flag_updated"
  | "other";

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: AuditActionType;
  performedBy: string; // admin user ID
  affectedUserId?: string; // user being affected (if applicable)
  summary: string; // human-readable description
  details?: Record<string, unknown>; // additional metadata
}

export interface IAuditLogger {
  /**
   * Log an admin action
   */
  logAction(
    action: AuditActionType,
    summary: string,
    affectedUserId?: string,
    details?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Get recent audit log entries
   */
  getRecentActions(limit: number): Promise<AuditLogEntry[]>;

  /**
   * Get audit log entries for a specific user
   */
  getUserActions(userId: string, limit: number): Promise<AuditLogEntry[]>;

  /**
   * Get audit log entries for a specific action type
   */
  getActionsByType(
    actionType: AuditActionType,
    limit: number
  ): Promise<AuditLogEntry[]>;
}
