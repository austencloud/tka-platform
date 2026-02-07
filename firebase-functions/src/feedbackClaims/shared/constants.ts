/**
 * Shared Constants for Feedback Claims
 *
 * Single source of truth for all claim-related constants.
 */

import * as admin from "firebase-admin";

/**
 * Admin User ID - the service account user for CLI operations
 */
export const ADMIN_USER_ID = "rKWiPd1SthNJLMmCwKR4lgKwJuD3";

/**
 * Valid status transitions (mirrors feedback.config.js)
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["in-progress"],
  "in-progress": ["new", "in-review"],
  "in-review": ["in-progress", "completed"],
  completed: ["archived", "in-review"],
  archived: ["new"],
};

/**
 * WIP limits per status
 */
export const WIP_LIMITS: Record<string, number> = {
  new: 0,
  "in-progress": 4,
  "in-review": 5,
  completed: 0,
};

/**
 * Emergency action cooldown (1 hour)
 */
export const EMERGENCY_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Valid agent types for session registration
 */
export const VALID_AGENT_TYPES = ["claude-cli", "human", "ci"] as const;

/**
 * Get Firestore instance (lazy to avoid initialization order issues)
 */
let _db: admin.firestore.Firestore | null = null;
export function getDb(): admin.firestore.Firestore {
  if (!_db) {
    _db = admin.firestore();
  }
  return _db;
}
