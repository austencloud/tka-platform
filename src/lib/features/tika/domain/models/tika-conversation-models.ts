/**
 * TIKA Conversation Data Models
 *
 * Types for persisting TIKA chat sessions to Firebase.
 * Uses AI SDK's UIMessage type for storing conversation messages.
 */

import type { UIMessage } from "ai";

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
 * Create a new session from messages
 */
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
  return message.content || "";
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
