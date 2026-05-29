/**
 * UserKnowledgeProfilePersister
 *
 * Persists learning progress to Firestore for cross-device sync.
 * Follows the FirebaseSettingsPersister pattern:
 * - setDoc with merge: true for writes
 * - onSnapshot for real-time cross-device sync
 * - trackWrite for offline state management
 * - serverTimestamp for consistent ordering
 *
 * Maps and Sets are serialized to plain objects/arrays for Firestore compatibility.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { getUserLearningProgressPath } from "../data/firestore-paths";
import type { LearningProgress, ConceptProgress } from "../domain/types";
import type { SerializedLearningProgress } from "./types";

export class UserKnowledgeProfilePersister
{
  private unsubscribe: Unsubscribe | null = null;

  /**
   * Get the Firestore document reference for a user's learning progress.
   */
  private async getDocRef(userId: string) {
    const firestore = await getFirestoreInstance();
    return doc(firestore, getUserLearningProgressPath(userId));
  }

  /**
   * Serialize LearningProgress for Firestore storage.
   * Converts Map to plain object and Set to array.
   */
  private dateToISO(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return null;
  }

  private serialize(progress: LearningProgress): SerializedLearningProgress {
    const conceptEntries: Record<string, unknown> = {};
    progress.concepts.forEach((value, key) => {
      conceptEntries[key] = {
        ...value,
        startedAt: this.dateToISO(value.startedAt),
        completedAt: this.dateToISO(value.completedAt),
        lastPracticedAt: this.dateToISO(value.lastPracticedAt),
        nextPracticeAt: this.dateToISO(value.nextPracticeAt),
      };
    });

    return {
      concepts: conceptEntries,
      completedConcepts: Array.from(progress.completedConcepts),
      currentConceptId: progress.currentConceptId,
      overallProgress: progress.overallProgress,
      totalCorrect: progress.totalCorrect,
      totalTimeSpent: progress.totalTimeSpent,
      badges: progress.badges,
      lastUpdated: this.dateToISO(progress.lastUpdated) ?? new Date().toISOString(),
    };
  }

  /**
   * Deserialize Firestore data back to LearningProgress.
   * Converts plain object to Map and array to Set.
   */
  private deserialize(data: Record<string, unknown>): LearningProgress {
    const concepts = new Map<string, ConceptProgress>();
    const rawConcepts = (data.concepts as Record<string, Record<string, unknown>>) || {};

    for (const [key, value] of Object.entries(rawConcepts)) {
      concepts.set(key, {
        conceptId: (value.conceptId as string) || key,
        status: (value.status as ConceptProgress["status"]) || "available",
        percentComplete: (value.percentComplete as number) || 0,
        correctAnswers: (value.correctAnswers as number) || 0,
        incorrectAnswers: (value.incorrectAnswers as number) || 0,
        totalAttempts: (value.totalAttempts as number) || 0,
        accuracy: (value.accuracy as number) || 0,
        currentStreak: (value.currentStreak as number) || 0,
        bestStreak: (value.bestStreak as number) || 0,
        timeSpentSeconds: (value.timeSpentSeconds as number) || 0,
        startedAt: value.startedAt ? new Date(value.startedAt as string) : undefined,
        completedAt: value.completedAt ? new Date(value.completedAt as string) : undefined,
        lastPracticedAt: value.lastPracticedAt
          ? new Date(value.lastPracticedAt as string)
          : undefined,
        nextPracticeAt: value.nextPracticeAt
          ? new Date(value.nextPracticeAt as string)
          : undefined,
      });
    }

    return {
      concepts,
      completedConcepts: new Set((data.completedConcepts as string[]) || []),
      currentConceptId: data.currentConceptId as string | undefined,
      overallProgress: (data.overallProgress as number) || 0,
      totalCorrect: (data.totalCorrect as number) || 0,
      totalTimeSpent: (data.totalTimeSpent as number) || 0,
      badges: (data.badges as string[]) || [],
      lastUpdated: data.lastUpdated
        ? new Date(data.lastUpdated as string)
        : new Date(),
    };
  }

  async saveProgress(
    userId: string,
    progress: LearningProgress
  ): Promise<void> {
    try {
      const docRef = await this.getDocRef(userId);
      const serialized = this.serialize(progress);

      await trackWrite(() =>
        setDoc(
          docRef,
          {
            ...serialized,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    } catch (error) {
      console.error(
        "[UserKnowledgeProfilePersister] Failed to save progress:",
        error
      );
      throw error;
    }
  }

  async loadProgress(userId: string): Promise<LearningProgress | null> {
    try {
      const docRef = await this.getDocRef(userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Strip Firestore metadata
        const { updatedAt: _, createdAt: _c, ...progressData } = data;
        return this.deserialize(progressData);
      }

      return null;
    } catch (error) {
      console.error(
        "[UserKnowledgeProfilePersister] Failed to load progress:",
        error
      );
      throw error;
    }
  }

  subscribeToProgress(
    userId: string,
    callback: (progress: LearningProgress) => void,
    onError?: (error: unknown) => void
  ): () => void {
    // Clean up existing subscription
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Start async subscription setup
    this.getDocRef(userId)
      .then((docRef) => {
        this.unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const { updatedAt: _, createdAt: _c, ...progressData } = data;
              if (Object.keys(progressData).length > 0) {
                callback(this.deserialize(progressData));
              }
            }
          },
          (error) => {
            console.error(
              "[UserKnowledgeProfilePersister] Subscription error:",
              error
            );
            onError?.(error);
          }
        );
      })
      .catch((error) => {
        console.error(
          "[UserKnowledgeProfilePersister] Failed to initialize subscription:",
          error
        );
        onError?.(error);
      });

    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}
