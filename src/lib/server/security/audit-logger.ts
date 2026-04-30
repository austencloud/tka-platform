/**
 * Audit logger for admin actions.
 *
 * Writes structured entries to Firestore `audit_log` collection.
 * Fire-and-forget by default - audit failures should never block
 * the admin operation itself.
 */

import { getAdminDb } from "$lib/server/firebaseAdmin";

export interface AuditEntry {
  /** UID of the admin performing the action */
  uid: string;
  /** Human-readable action name (e.g., "feature_flag_update", "user_auth_query") */
  action: string;
  /** Target of the action (e.g., user ID queried, flag key changed) */
  target?: string;
  /** Arbitrary extra context */
  metadata?: Record<string, unknown>;
  /** Client IP address */
  ip?: string;
}

/**
 * Log an admin action to Firestore audit_log collection.
 *
 * This is fire-and-forget - errors are logged to console but never thrown.
 */
export function logAdminAction(entry: AuditEntry): void {
  const db = getAdminDb();
  const doc = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  db.collection("audit_log")
    .add(doc)
    .catch((err: unknown) => {
      console.error("[audit-logger] Failed to write audit entry:", err, doc);
    });
}
