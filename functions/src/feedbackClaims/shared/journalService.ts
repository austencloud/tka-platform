/**
 * Journal Service
 *
 * Tamper-proof audit trail for all feedback operations.
 * Uses Admin SDK so entries cannot be modified by clients.
 */

import * as admin from "firebase-admin";
import { getDb } from "./constants";

export interface JournalEntryData {
  [key: string]: unknown;
}

/**
 * Add a tamper-proof journal entry
 *
 * @param feedbackId - The feedback document ID
 * @param type - Entry type (claimed, unclaimed, heartbeat, status_change, etc.)
 * @param sessionId - The session that performed the action
 * @param message - Human-readable description
 * @param data - Additional structured data
 * @returns The journal entry ID, or null if failed
 */
export async function addJournalEntry(
  feedbackId: string,
  type: string,
  sessionId: string,
  message: string,
  data: JournalEntryData = {}
): Promise<string | null> {
  try {
    const journalRef = getDb()
      .collection("feedback")
      .doc(feedbackId)
      .collection("journal")
      .doc();

    await journalRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type,
      sessionId,
      message,
      data,
    });

    return journalRef.id;
  } catch (error) {
    console.error(`Failed to write journal entry for ${feedbackId}:`, error);
    return null;
  }
}
