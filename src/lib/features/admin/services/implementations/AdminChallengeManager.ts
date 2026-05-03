/**
 * Admin Challenge Manager Implementation
 *
 * Handles admin operations for daily challenges
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { db } from "$lib/shared/persistence/database/TKADatabase";
import type { DailyChallenge } from "$lib/shared/gamification/domain/models/achievement-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  ChallengeScheduleEntry,
  ChallengeFormData,
} from "../../domain/models/AdminModels";
import type { AuditLogger } from "./AuditLogger";

export class AdminChallengeManager {
  constructor(private readonly auditLogger: AuditLogger) {}
  /**
   * Get all scheduled challenges for a date range
   * Optimized: Single batch query instead of per-day requests
   */
  async getScheduledChallenges(
    startDate: Date,
    endDate: Date
  ): Promise<ChallengeScheduleEntry[]> {
    try {
      const firestore = await getFirestoreInstance();
      // Build date strings for the range
      const startDateStr = startDate.toISOString().split("T")[0] ?? "";
      const endDateStr = endDate.toISOString().split("T")[0] ?? "";

      // Fetch all challenges in range with a single query
      const challengesRef = collection(firestore, "dailyChallenges");
      const q = query(
        challengesRef,
        where("date", ">=", startDateStr),
        where("date", "<=", endDateStr)
      );

      const challengeMap = new Map<string, DailyChallenge>();

      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        const challenge = doc.data() as DailyChallenge;
        challengeMap.set(challenge.date, challenge);
      });

      // Build entries array for each day in range
      const entries: ChallengeScheduleEntry[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0] ?? "";
        const challenge = challengeMap.get(dateStr) ?? null;

        entries.push({
          date: dateStr,
          challenge,
          isScheduled: challenge !== null,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return entries;
    } catch (error) {
      console.error(
        "[AdminChallengeManager] Failed to fetch scheduled challenges:",
        error
      );
      toast.error("Failed to load scheduled challenges.");
      return [];
    }
  }

  /**
   * Create a new daily challenge
   */
  async createChallenge(formData: ChallengeFormData): Promise<DailyChallenge> {
    try {
      const firestore = await getFirestoreInstance();
      const challengeId = `challenge_${formData.date}`;

      // Create end-of-day expiration
      const expiresAt = new Date(formData.date);
      expiresAt.setHours(23, 59, 59, 999);

      const challenge: DailyChallenge = {
        id: challengeId,
        date: formData.date,
        type: formData.type,
        difficulty: formData.difficulty,
        title: formData.title,
        description: formData.description,
        xpReward: formData.xpReward,
        requirement: {
          type: formData.type,
          target: formData.target,
          ...(formData.metadata && { metadata: formData.metadata }),
        },
        expiresAt,
      };

      // Save to Firestore
      const challengeDocRef = doc(firestore, `dailyChallenges/${challengeId}`);
      await setDoc(challengeDocRef, {
        ...challenge,
        expiresAt: Timestamp.fromDate(expiresAt),
      });

      // Log the action
      await this.auditLogger.logAction(
        "challenge_created",
        `Created daily challenge: ${challenge.title} (${formData.date})`,
        undefined,
        { challengeId, date: formData.date, difficulty: formData.difficulty }
      );

      return challenge;
    } catch (error) {
      console.error(
        "[AdminChallengeManager] Failed to create challenge:",
        error
      );
      toast.error("Failed to create challenge. Please try again.");
      throw error;
    }
  }

  /**
   * Update an existing daily challenge
   */
  async updateChallenge(
    challengeId: string,
    formData: Partial<ChallengeFormData>
  ): Promise<DailyChallenge> {
    try {
      const firestore = await getFirestoreInstance();
      const challengeDocRef = doc(firestore, `dailyChallenges/${challengeId}`);
      const challengeDoc = await getDoc(challengeDocRef);

      if (!challengeDoc.exists()) {
        throw new Error(`Challenge ${challengeId} not found`);
      }

      const existingChallenge = challengeDoc.data() as DailyChallenge;

      // Build update object
      const updates: Partial<DailyChallenge> = {};

      if (formData.title) updates.title = formData.title;
      if (formData.description) updates.description = formData.description;
      if (formData.difficulty) updates.difficulty = formData.difficulty;
      if (formData.xpReward !== undefined) updates.xpReward = formData.xpReward;
      if (formData.type) updates.type = formData.type;

      if (formData.target !== undefined || formData.metadata !== undefined) {
        updates.requirement = {
          ...existingChallenge.requirement,
          ...(formData.target !== undefined && { target: formData.target }),
          ...(formData.metadata && { metadata: formData.metadata }),
        };
      }

      await updateDoc(challengeDocRef, updates);

      // Fetch and return updated challenge
      const updatedDoc = await getDoc(challengeDocRef);
      return updatedDoc.data() as DailyChallenge;
    } catch (error) {
      console.error(
        "[AdminChallengeManager] Failed to update challenge:",
        error
      );
      toast.error("Failed to update challenge. Please try again.");
      throw error;
    }
  }

  /**
   * Delete a daily challenge
   */
  async deleteChallenge(challengeId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const challengeDocRef = doc(firestore, `dailyChallenges/${challengeId}`);
      await deleteDoc(challengeDocRef);
    } catch (error) {
      console.error(
        "[AdminChallengeManager] Failed to delete challenge:",
        error
      );
      toast.error("Failed to delete challenge. Please try again.");
      throw error;
    }
  }

  /**
   * Get user's saved sequences (for selection)
   */
  async getUserSequences(): Promise<SequenceData[]> {
    try {
      const sequences = await db.sequences.toArray();
      return sequences;
    } catch (error) {
      console.error(
        "[AdminChallengeManager] Failed to fetch user sequences:",
        error
      );
      toast.error("Failed to load sequences.");
      return [];
    }
  }

  /**
   * Get a specific challenge by date
   */
  async getChallengeByDate(date: string): Promise<DailyChallenge | null> {
    try {
      const firestore = await getFirestoreInstance();
      const challengeId = `challenge_${date}`;
      const challengeDocRef = doc(firestore, `dailyChallenges/${challengeId}`);

      const challengeDoc = await getDoc(challengeDocRef);

      if (challengeDoc.exists()) {
        return challengeDoc.data() as DailyChallenge;
      }

      return null;
    } catch (error) {
      console.error(
        `[AdminChallengeManager] Failed to fetch challenge for ${date}:`,
        error
      );
      toast.error("Failed to load challenge.");
      return null;
    }
  }
}
