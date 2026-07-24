/**
 * Sequence Session Domain Model
 *
 * Represents a creative session in the Create module.
 * Each session has clear boundaries and tracks autosave state.
 *
 * Domain: Create module - Session management
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Session metadata stored in Firestore
 */
export interface SequenceSession {
  /** Unique session identifier */
  sessionId: string;

  /** User ID who owns this session */
  userId: string;

  /** Device ID where session was created */
  deviceId: string;

  /** When the session was created */
  createdAt: Timestamp;

  /** Last modification timestamp */
  lastModified: Timestamp;

  /** Timestamp of last autosave */
  lastAutosave: Timestamp | null;

  /** Whether this session has been saved to library */
  isSaved: boolean;

  /** Sequence ID if saved (null for drafts) */
  sequenceId: string | null;

  /** Number of steps in the sequence */
  stepCount: number;

  /** Session status */
  status: "active" | "completed" | "abandoned";

  /** Sequence name (if provided) */
  name?: string;

  /** Preview thumbnail URL (if generated) */
  thumbnailUrl?: string;
}

/**
 * Factory function to create a new session
 */
export function createSequenceSession(
  userId: string,
  deviceId: string,
  sessionId: string
): Omit<SequenceSession, "createdAt" | "lastModified" | "lastAutosave"> {
  return {
    sessionId,
    userId,
    deviceId,
    isSaved: false,
    sequenceId: null,
    stepCount: 0,
    status: "active",
  };
}

/**
 * Generate device ID from browser fingerprint
 */
export function generateDeviceId(): string {
  const stored = localStorage.getItem("deviceId");
  if (stored) return stored;

  const newId = `device_${crypto.randomUUID()}`;
  localStorage.setItem("deviceId", newId);
  return newId;
}
