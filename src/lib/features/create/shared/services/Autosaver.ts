/**
 * Autosave Service
 *
 * Handles automatic saving of sequence drafts to Firestore.
 * - Saves drafts every N seconds when changes detected
 * - Retrieves drafts for session recovery
 * - Cleans up old drafts
 *
 * Domain: Create module - Draft persistence
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
import {
  createDraftSequence,
  type DraftSequence,
} from "../domain/DraftSequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export class Autosaver {
  private autosaveInterval: number | null = null;
  private isDirty = false;

  /**
   * Save a draft to Firestore
   */
  async saveDraft(
    sessionId: string,
    sequenceData: SequenceData
  ): Promise<void> {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("User must be authenticated to save draft");
    }

    const draftData = createDraftSequence(sessionId, user.uid, sequenceData);

    const draft: DraftSequence = {
      ...draftData,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const firestore = await getFirestoreInstance();
    const draftRef = doc(firestore, `users/${user.uid}/drafts/${sessionId}`);
    await setDoc(draftRef, draft, { merge: true });

    this.isDirty = false;
  }

  /**
   * Load a draft by session ID
   */
  async loadDraft(sessionId: string): Promise<DraftSequence | null> {
    const user = getAuthSync().currentUser;
    if (!user) return null;

    const firestore = await getFirestoreInstance();
    const draftRef = doc(firestore, `users/${user.uid}/drafts/${sessionId}`);
    const snapshot = await getDoc(draftRef);

    if (!snapshot.exists()) return null;

    return snapshot.data() as DraftSequence;
  }

  /**
   * Delete a draft
   */
  async deleteDraft(sessionId: string): Promise<void> {
    const user = getAuthSync().currentUser;
    if (!user) return;

    const firestore = await getFirestoreInstance();
    const draftRef = doc(firestore, `users/${user.uid}/drafts/${sessionId}`);
    await deleteDoc(draftRef);
  }

  /**
   * Get all drafts for current user
   */
  async getAllDrafts(): Promise<DraftSequence[]> {
    const user = getAuthSync().currentUser;
    if (!user) return [];

    const firestore = await getFirestoreInstance();
    const draftsRef = collection(firestore, `users/${user.uid}/drafts`);
    const snapshot = await getDocs(draftsRef);

    return snapshot.docs.map((doc) => doc.data() as DraftSequence);
  }

  /**
   * Start autosave interval
   * @param onSave Callback to get current sequence data
   * @param sessionId Current session ID
   * @param intervalMs Autosave interval in milliseconds (default: 30s)
   */
  startAutosave(
    onSave: () => SequenceData | null,
    sessionId: string,
    intervalMs = 30000
  ): void {
    this.stopAutosave();

    this.autosaveInterval = window.setInterval(async () => {
      if (!this.isDirty) return;

      const sequenceData = onSave();
      if (!sequenceData || sequenceData.beats.length === 0) return;

      try {
        await this.saveDraft(sessionId, sequenceData);
      } catch (error) {
        console.error("Failed to autosave draft:", error);
      }
    }, intervalMs);
  }

  /**
   * Stop autosave interval
   */
  stopAutosave(): void {
    if (this.autosaveInterval !== null) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  /**
   * Mark that changes have been made (needs autosave)
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Clean up old drafts (older than N days)
   */
  async cleanupOldDrafts(daysOld = 7): Promise<number> {
    const user = getAuthSync().currentUser;
    if (!user) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.getTime();

    const firestore = await getFirestoreInstance();
    const draftsRef = collection(firestore, `users/${user.uid}/drafts`);
    const snapshot = await getDocs(draftsRef);

    let deletedCount = 0;

    for (const docSnapshot of snapshot.docs) {
      const draft = docSnapshot.data() as DraftSequence;
      const updatedAt = draft.updatedAt as Timestamp;

      if (updatedAt.toMillis() < cutoffTimestamp) {
        await deleteDoc(docSnapshot.ref);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
