/**
 * TIKA Conversation Data Models
 *
 * Types for persisting TIKA chat sessions to Firebase.
 * Uses AI SDK's UIMessage type for storing conversation messages.
 */

import type { UIMessage } from "ai";

/**
 * Review workflow statuses
 * - pending: Flagged, waiting for review
 * - claimed: /tika command is currently reviewing
 * - in-review: Human reviewing AI's assessment
 * - approved: Passed review
 * - needs-correction: Needs prompt/system improvement
 * - archived: Historical record
 */
export type ReviewStatus =
  | "pending"
  | "claimed"
  | "in-review"
  | "approved"
  | "needs-correction"
  | "archived";

/**
 * Metadata captured during the review process
 */
export interface ReviewMetadata {
  /** When this was claimed for review */
  claimedAt?: Date;

  /** Who claimed it: "claude-tika" or a user ID */
  claimedBy?: string;

  /** Letter grade from review (A+, A, B, C, D, F) */
  grade?: string;

  /** Confidence score 0-100 */
  confidence?: number;

  /** Human-added notes before review */
  notes?: string;

  /** Claude's analysis from /tika command */
  aiNotes?: string;

  /** If response needed correction, the ideal response */
  correctedResponse?: string;

  /** When the review was completed */
  reviewedAt?: Date;
}

/**
 * Full Tika session data stored in Firestore
 */
export interface TikaSession {
  /** Firestore document ID */
  id: string;

  /** User ID who owns this session */
  userId: string;

  /** Auto-derived title from first user message (max 50 chars) */
  title: string;

  /** When the session was created */
  createdAt: Date;

  /** When the session was last updated */
  updatedAt: Date;

  /** Total number of messages in the conversation */
  messageCount: number;

  /** Preview of last user message (max 100 chars) */
  lastUserMessage: string;

  /** Full AI SDK message array */
  messages: UIMessage[];

  /** Whether this session is flagged for human review */
  flaggedForReview?: boolean;

  /** When the session was flagged for review */
  flaggedAt?: Date;

  /** Review workflow status */
  reviewStatus?: ReviewStatus;

  /** Review metadata (notes, grade, claim info) */
  reviewMetadata?: ReviewMetadata;
}

/**
 * Lightweight preview for listing sessions
 * (excludes full message array to reduce Firestore reads)
 */
export interface TikaSessionPreview {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastUserMessage: string;
  flaggedForReview?: boolean;
  flaggedAt?: Date;
  reviewStatus?: ReviewStatus;
  reviewMetadata?: ReviewMetadata;
}

/**
 * Options for querying sessions
 */
export interface TikaSessionQueryOptions {
  /** Maximum number of sessions to return */
  limit?: number;

  /** Sort direction (default: desc by updatedAt) */
  sortDirection?: "asc" | "desc";
}

/**
 * Options for querying review queue
 */
export interface ReviewQueueQueryOptions {
  /** Filter by review status */
  status?: ReviewStatus | ReviewStatus[];

  /** Maximum number of sessions to return */
  limit?: number;
}

/**
 * Result from a review submission
 */
export interface ReviewResult {
  /** The grade assigned (A+, A, B, C, D, F) */
  grade: string;

  /** Confidence score 0-100 */
  confidence: number;

  /** Notes from the reviewer */
  notes?: string;

  /** Corrected response if needed */
  correctedResponse?: string;

  /** Whether to auto-approve (based on grade/confidence) */
  autoApprove: boolean;
}

export function createTikaSession(
  userId: string,
  messages: UIMessage[],
  existingId?: string
): TikaSession {
  const now = new Date();

  // Extract title from first user message
  const firstUserMessage = messages.find((m) => m.role === "user");
  const title = firstUserMessage
    ? truncateText(getTextFromMessage(firstUserMessage), 50)
    : "New Conversation";

  // Get last user message for preview
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserMessage = lastUserMsg
    ? truncateText(getTextFromMessage(lastUserMsg), 100)
    : "";

  return {
    id: existingId || crypto.randomUUID(),
    userId,
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: messages.length,
    lastUserMessage,
    messages,
  };
}

/**
 * Extract text content from a UIMessage
 */
function getTextFromMessage(message: UIMessage): string {
  if (message.parts) {
    const textParts = message.parts.filter((p) => p.type === "text");
    return textParts
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
  }
  const legacy = message as { content?: string };
  return legacy.content || "";
}

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 1) + "…";
}

/**
 * Recursively remove undefined values from an object.
 * Firestore doesn't accept undefined, so we strip them out.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as T;
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}
