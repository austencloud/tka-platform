/**
 * Autosave Service
 *
 * Saves sequence drafts to Dexie (IndexedDB) first - no auth required,
 * works offline, survives a page reload. If the user is authenticated,
 * we also fire a non-blocking Firestore sync so the draft is backed up
 * to the cloud when connectivity is available.
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
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import {
  createDraftSequence,
  type DraftSequence,
} from "../domain/draft-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { db } from "$lib/shared/persistence/database/tka-database";
import { UserWorkType } from "$lib/shared/persistence/domain/enums/user-work-type";

export class Autosaver {
  private autosaveInterval: number | null = null;
  private isDirty = false;
  private saving = false;

  /**
   * Save a draft.
   *
   * Always writes to Dexie first - instant, no auth needed, works offline.
   * If the user is signed in we also kick off a Firestore sync in the
   * background so the draft reaches the cloud, but we never await it here.
   */
  async saveDraft(
    sessionId: string,
    sequenceData: SequenceData
  ): Promise<void> {
    // Guard against concurrent saves (interval + manual can overlap)
    if (this.saving) return;
    this.saving = true;

    try {
      // --- Dexie (local, always) ---
      // Deep-clone via JSON to strip non-cloneable objects (Firestore Timestamps,
      // class instances, functions) that IndexedDB's structured clone rejects.
      const cloneableData = JSON.parse(JSON.stringify({
        sessionId,
        sequenceData,
        stepCount: sequenceData.steps.length,
        name: sequenceData.name,
      }));

      await db.userWork.put({
        type: UserWorkType.SEQUENCE_DRAFT,
        tabId: "create",
        data: cloneableData,
        lastModified: new Date(),
        version: 1,
      });

      // Only clear dirty flag after successful Dexie write
      this.isDirty = false;

    // --- Firestore (cloud, fire-and-forget) ---
    const user = getAuthSync().currentUser;
    if (user) {
      const draftData = createDraftSequence(sessionId, user.uid, sequenceData);
      // Deep-clone the sequence data via JSON to strip undefined values -
      // Firestore rejects them (e.g. startPosition.startPosition can be
      // undefined on fresh pictographs). Timestamps are added after the
      // clone since serverTimestamp() is a Firestore sentinel, not JSON.
      const cleanData = JSON.parse(JSON.stringify(draftData));
      cleanData.createdAt = serverTimestamp();
      cleanData.updatedAt = serverTimestamp();

      getFirestoreInstance().then((firestore) => {
        const draftRef = doc(
          firestore,
          `users/${user.uid}/drafts/${sessionId}`
        );
        trackWrite(() => setDoc(draftRef, cleanData, { merge: true })).catch(
          (err) =>
            console.warn("[Autosaver] Firestore draft sync failed:", err)
        );
      });
    }
    } finally {
      this.saving = false;
    }
  }

  /**
   * Load a draft for session recovery.
   *
   * Checks Dexie first - if we have a local copy we use it immediately
   * without touching the network. Falls back to Firestore only when
   * Dexie has nothing and the user is authenticated.
   */
  async loadDraft(sessionId?: string): Promise<DraftSequence | null> {
    // --- Dexie (local, always first) ---
    try {
      const localDraft = await db.userWork
        .where("[type+tabId]")
        .equals([UserWorkType.SEQUENCE_DRAFT, "create"])
        .first();

      if (localDraft?.data) {
        const data = localDraft.data as {
          sessionId: string;
          sequenceData: SequenceData;
          stepCount: number;
          name?: string;
        };

        return {
          sessionId: data.sessionId,
          userId: "",
          sequenceData: data.sequenceData,
          stepCount: data.stepCount,
          name: data.name,
          createdAt: null as unknown as Timestamp,
          updatedAt: null as unknown as Timestamp,
        };
      }
    } catch (err) {
      console.warn("[Autosaver] Dexie draft load failed:", err);
    }

    // --- Firestore fallback ---
    const user = getAuthSync().currentUser;
    if (!user || !sessionId) return null;

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
    await db.userWork
      .where("[type+tabId]")
      .equals([UserWorkType.SEQUENCE_DRAFT, "create"])
      .delete();

    const user = getAuthSync().currentUser;
    if (!user) return;

    const firestore = await getFirestoreInstance();
    const draftRef = doc(firestore, `users/${user.uid}/drafts/${sessionId}`);
    await trackWrite(() => deleteDoc(draftRef));
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
      if (!sequenceData || sequenceData.steps.length === 0) return;

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
