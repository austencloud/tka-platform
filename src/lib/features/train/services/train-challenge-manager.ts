import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getAuthSync, getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  getTrainChallengesPath,
  getUserTrainProgressPath,
} from "$lib/shared/gamification/data/firestore-collections";
import { getDifficultySortIndex } from "$lib/shared/gamification/domain/models/achievement-models";
import type {
  TrainChallenge,
  UserTrainChallengeProgress,
  TrainChallengeFilters,
  TrainChallengeScore,
} from "../domain/models/train-challenge-models";
import { isChallengeAvailable } from "../domain/models/train-challenge-models";
import type { AchievementManager } from '$lib/shared/gamification/services/implementations/AchievementManager'

export class TrainChallengeManager {
  private _achievementService: AchievementManager | null = null;

  constructor(achievementService: AchievementManager) {
    this._achievementService = achievementService;
  }

  async getActiveChallenges(): Promise<TrainChallenge[]> {
    try {
      const firestore = await getFirestoreInstance();
      const challengesPath = getTrainChallengesPath();
      const challengesQuery = query(
        collection(firestore, challengesPath),
        where("isActive", "==", true),
        orderBy("order", "asc")
      );

      const snapshot = await getDocs(challengesQuery);
      const challenges: TrainChallenge[] = [];

      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const challenge = this._convertFirestoreChallenge(data, docSnapshot.id);

        if (isChallengeAvailable(challenge)) {
          challenges.push(challenge);
        }
      });

      return challenges;
    } catch (error) {
      console.error("❌ Failed to fetch active train challenges:", error);
      return [];
    }
  }

  async getChallengeById(challengeId: string): Promise<TrainChallenge | null> {
    try {
      const firestore = await getFirestoreInstance();
      const challengesPath = getTrainChallengesPath();
      const challengeDocRef = doc(
        firestore,
        `${challengesPath}/${challengeId}`
      );
      const challengeDoc = await getDoc(challengeDocRef);

      if (challengeDoc.exists()) {
        return this._convertFirestoreChallenge(
          challengeDoc.data(),
          challengeDoc.id
        );
      }
      console.warn(`⚠️ Train challenge not found: ${challengeId}`);
      return null;
    } catch (error) {
      console.error("❌ Failed to fetch train challenge:", error);
      return null;
    }
  }

  async getChallenges(
    filters: TrainChallengeFilters
  ): Promise<TrainChallenge[]> {
    const allChallenges = await this.getActiveChallenges();
    let filtered = allChallenges;

    if (filters.filter === "completed") {
      const progress = await this.getUserChallengeProgress();
      const completedIds = new Set(
        progress.filter((p) => p.isCompleted).map((p) => p.challengeId)
      );
      filtered = filtered.filter((c) => completedIds.has(c.id));
    } else if (filters.filter === "available") {
      const progress = await this.getUserChallengeProgress();
      const completedIds = new Set(
        progress.filter((p) => p.isCompleted).map((p) => p.challengeId)
      );
      filtered = filtered.filter((c) => !completedIds.has(c.id));
    }

    if (filters.difficulty) {
      filtered = filtered.filter((c) => c.difficulty === filters.difficulty);
    }

    if (filters.mode) {
      filtered = filtered.filter(
        (c) => c.requirement.metadata?.mode === filters.mode
      );
    }

    switch (filters.sortBy) {
      case "difficulty":
        filtered.sort(
          (a, b) =>
            getDifficultySortIndex(a.difficulty) -
            getDifficultySortIndex(b.difficulty)
        );
        break;
      case "xp":
        filtered.sort((a, b) => b.xpReward - a.xpReward);
        break;
      case "newest":
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "expiring":
        filtered = filtered
          .filter((c) => c.endDate)
          .sort((a, b) => {
            if (!a.endDate || !b.endDate) return 0;
            return a.endDate.getTime() - b.endDate.getTime();
          });
        break;
    }

    return filtered;
  }

  async getUserChallengeProgress(): Promise<UserTrainChallengeProgress[]> {
    const user = getAuthSync().currentUser;
    if (!user) return [];

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserTrainProgressPath(user.uid);
      const progressSnapshot = await getDocs(
        collection(firestore, progressPath)
      );

      const progress: UserTrainChallengeProgress[] = [];
      progressSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        progress.push(this._convertFirestoreProgress(data));
      });

      return progress;
    } catch (error) {
      console.error("❌ Failed to fetch train challenge progress:", error);
      return [];
    }
  }

  async getUserProgressForChallenge(
    challengeId: string
  ): Promise<UserTrainChallengeProgress | null> {
    const user = getAuthSync().currentUser;
    if (!user) return null;

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserTrainProgressPath(user.uid);
      const progressDocRef = doc(firestore, `${progressPath}/${challengeId}`);
      const progressDoc = await getDoc(progressDocRef);

      if (progressDoc.exists()) {
        return this._convertFirestoreProgress(progressDoc.data());
      }

      return null;
    } catch (error) {
      console.error("❌ Failed to fetch challenge progress:", error);
      return null;
    }
  }

  async startChallenge(challengeId: string): Promise<void> {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    const existingProgress =
      await this.getUserProgressForChallenge(challengeId);
    if (existingProgress) {
      return; 
    }

    const firestore = await getFirestoreInstance();
    const initialProgress: Partial<UserTrainChallengeProgress> = {
      id: challengeId,
      challengeId,
      userId: user.uid,
      progress: 0,
      isCompleted: false,
      startedAt: new Date(),
      lastProgressAt: new Date(),
      attempts: 0,
      bonusEarned: false,
    };

    const progressPath = getUserTrainProgressPath(user.uid);
    const progressDocRef = doc(firestore, `${progressPath}/${challengeId}`);

    await setDoc(progressDocRef, {
      ...initialProgress,
      startedAt: serverTimestamp(),
      lastProgressAt: serverTimestamp(),
    });
  }

  async recordProgress(
    challengeId: string,
    increment: number,
    score?: TrainChallengeScore
  ): Promise<void> {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    let progress = await this.getUserProgressForChallenge(challengeId);
    if (!progress) {
      await this.startChallenge(challengeId);
      progress = await this.getUserProgressForChallenge(challengeId);
      if (!progress) {
        throw new Error("Failed to initialize challenge progress");
      }
    }

    if (progress.isCompleted) {
      return;
    }

    const firestore = await getFirestoreInstance();
    const newProgress = progress.progress + increment;
    const updatedAttempts = progress.attempts + 1;

    let bestScore = progress.bestScore;
    if (score) {
      if (
        !bestScore ||
        score.accuracy > bestScore.accuracy ||
        (score.accuracy === bestScore.accuracy && score.combo > bestScore.combo)
      ) {
        bestScore = score;
      }
    }

    const progressPath = getUserTrainProgressPath(user.uid);
    const progressDocRef = doc(firestore, `${progressPath}/${challengeId}`);

    await updateDoc(progressDocRef, {
      progress: newProgress,
      lastProgressAt: serverTimestamp(),
      attempts: updatedAttempts,
      ...(bestScore && { bestScore }),
    });
  }

  async completeChallenge(
    challengeId: string,
    finalScore: TrainChallengeScore
  ): Promise<number> {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    const challenge = await this.getChallengeById(challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const progress = await this.getUserProgressForChallenge(challengeId);
    if (!progress) {
      throw new Error("Challenge not started");
    }

    if (progress.isCompleted) {
      console.warn("⚠️ Challenge already completed");
      return 0;
    }

    const firestore = await getFirestoreInstance();
    const bonusEarned = this._checkBonusCondition(challenge, finalScore);

    const progressPath = getUserTrainProgressPath(user.uid);
    const progressDocRef = doc(firestore, `${progressPath}/${challengeId}`);

    await updateDoc(progressDocRef, {
      progress: challenge.requirement.target,
      isCompleted: true,
      completedAt: serverTimestamp(),
      bestScore: finalScore,
      bonusEarned,
    });

    let totalXP = challenge.xpReward;
    if (bonusEarned && challenge.bonusXP) {
      totalXP += challenge.bonusXP;
    }

    if (this._achievementService) {
      await this._achievementService.trackAction("drill_completed", {
        challengeId: challenge.id,
        difficulty: challenge.difficulty,
        bonusEarned,
        xpAwarded: totalXP,
      });
    }

    return totalXP;
  }

  async isChallengeCompleted(challengeId: string): Promise<boolean> {
    const progress = await this.getUserProgressForChallenge(challengeId);
    return progress?.isCompleted ?? false;
  }

  async getCompletionStats(): Promise<{
    totalChallenges: number;
    completedChallenges: number;
    totalXPEarned: number;
    bonusXPEarned: number;
  }> {
    const allChallenges = await this.getActiveChallenges();
    const progress = await this.getUserChallengeProgress();

    const completed = progress.filter((p) => p.isCompleted);

    let totalXPEarned = 0;
    let bonusXPEarned = 0;

    for (const prog of completed) {
      const challenge = await this.getChallengeById(prog.challengeId);
      if (challenge) {
        totalXPEarned += challenge.xpReward;
        if (prog.bonusEarned && challenge.bonusXP) {
          bonusXPEarned += challenge.bonusXP;
          totalXPEarned += challenge.bonusXP;
        }
      }
    }

    return {
      totalChallenges: allChallenges.length,
      completedChallenges: completed.length,
      totalXPEarned,
      bonusXPEarned,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _convertFirestoreChallenge(data: any, docId: string): TrainChallenge {
    return {
      ...data,
      id: docId, 
      createdAt: data.createdAt?.toDate?.() || new Date(),
      startDate: data.startDate?.toDate?.(),
      endDate: data.endDate?.toDate?.(),
    } as TrainChallenge;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _convertFirestoreProgress(data: any): UserTrainChallengeProgress {
    return {
      ...data,
      startedAt: data.startedAt?.toDate?.() || new Date(),
      lastProgressAt: data.lastProgressAt?.toDate?.() || new Date(),
      completedAt: data.completedAt?.toDate?.(),
      bestScore: data.bestScore
        ? {
            ...data.bestScore,
            achievedAt: data.bestScore.achievedAt?.toDate?.() || new Date(),
          }
        : undefined,
    } as UserTrainChallengeProgress;
  }

  private _checkBonusCondition(
    challenge: TrainChallenge,
    score: TrainChallengeScore
  ): boolean {
    if (!challenge.bonusCondition) return false;

    if (challenge.bonusCondition === "perfect_run") {
      return score.accuracy === 100;
    }

    return false;
  }
}
