/**
 * ConceptProgressTracker
 *
 * Manages user progress through the TKA learning path.
 * Handles concept unlocking, progress tracking, and persistence.
 */

import { TKA_CONCEPTS, isConceptUnlocked } from "../../domain/concepts";
import type {
  ConceptProgress,
  ConceptStatus,
  LearningProgress,
} from "../../domain/types";
import type { IConceptProgressTracker } from "../contracts/IConceptProgressTracker";

const STORAGE_KEY = "tka_learning_progress";

export class ConceptProgressTracker implements IConceptProgressTracker {
  private progress: LearningProgress;
  private subscribers: Set<(progress: LearningProgress) => void> = new Set();

  constructor() {
    this.progress = this.loadProgress();
  }

  private loadProgress(): LearningProgress {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return {
          ...data,
          concepts: new Map(Object.entries(data.concepts || {})),
          completedConcepts: new Set(data.completedConcepts || []),
          lastUpdated: new Date(data.lastUpdated),
        };
      }
    } catch (error) {
      console.warn("Failed to load learning progress:", error);
    }

    return {
      concepts: new Map(),
      completedConcepts: new Set(),
      overallProgress: 0,
      totalCorrect: 0,
      totalTimeSpent: 0,
      badges: [],
      lastUpdated: new Date(),
    };
  }

  private saveProgress(): void {
    try {
      const data = {
        ...this.progress,
        concepts: Object.fromEntries(this.progress.concepts),
        completedConcepts: Array.from(this.progress.completedConcepts),
        lastUpdated: this.progress.lastUpdated.toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.notifySubscribers();
    } catch (error) {
      console.error("Failed to save learning progress:", error);
    }
  }

  subscribe(callback: (progress: LearningProgress) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.progress));
  }

  getProgress(): LearningProgress {
    return { ...this.progress };
  }

  getConceptStatus(conceptId: string): ConceptStatus {
    const progress = this.progress.concepts.get(conceptId);
    if (progress) return progress.status;

    if (isConceptUnlocked(conceptId, this.progress.completedConcepts)) {
      return "available";
    }

    return "locked";
  }

  getConceptProgress(conceptId: string): ConceptProgress {
    const existing = this.progress.concepts.get(conceptId);
    if (existing) return existing;

    const status = this.getConceptStatus(conceptId);
    return {
      conceptId,
      status,
      percentComplete: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalAttempts: 0,
      accuracy: 0,
      currentStreak: 0,
      bestStreak: 0,
      timeSpentSeconds: 0,
    };
  }

  startConcept(conceptId: string): void {
    const status = this.getConceptStatus(conceptId);
    if (status === "locked") {
      throw new Error(`Concept ${conceptId} is locked`);
    }

    const progress = this.getConceptProgress(conceptId);

    if (progress.status === "available") {
      progress.status = "in-progress";
      progress.startedAt = new Date();
    }

    this.progress.concepts.set(conceptId, progress);
    this.progress.currentConceptId = conceptId;
    this.progress.lastUpdated = new Date();

    this.saveProgress();
  }

  recordPracticeAttempt(
    conceptId: string,
    correct: boolean,
    timeSpentSeconds: number = 0
  ): void {
    const progress = this.getConceptProgress(conceptId);

    progress.totalAttempts++;
    progress.timeSpentSeconds += timeSpentSeconds;

    if (correct) {
      progress.correctAnswers++;
      progress.currentStreak++;
      progress.bestStreak = Math.max(
        progress.bestStreak,
        progress.currentStreak
      );
      this.progress.totalCorrect++;
    } else {
      progress.incorrectAnswers++;
      progress.currentStreak = 0;
    }

    progress.accuracy =
      (progress.correctAnswers / progress.totalAttempts) * 100;

    progress.percentComplete = Math.min(
      (progress.correctAnswers / 10) * 100,
      100
    );

    progress.lastPracticedAt = new Date();
    progress.nextPracticeAt = this.calculateNextPracticeDate(progress);

    if (
      progress.percentComplete >= 100 &&
      progress.accuracy >= 80 &&
      progress.status !== "completed"
    ) {
      this.completeConcept(conceptId);
    } else {
      this.progress.concepts.set(conceptId, progress);
    }

    this.progress.totalTimeSpent += timeSpentSeconds;
    this.progress.lastUpdated = new Date();

    this.saveProgress();
  }

  completeConcept(conceptId: string): void {
    const progress = this.getConceptProgress(conceptId);

    progress.status = "completed";
    progress.completedAt = new Date();
    progress.percentComplete = 100;

    this.progress.concepts.set(conceptId, progress);
    this.progress.completedConcepts.add(conceptId);

    this.updateOverallProgress();
    this.checkBadges();

    this.progress.lastUpdated = new Date();
    this.saveProgress();
  }

  private calculateNextPracticeDate(progress: ConceptProgress): Date {
    const intervals = [1, 3, 7, 14, 30];
    const reviewCount = Math.min(
      Math.floor(progress.correctAnswers / 5),
      intervals.length - 1
    );

    const daysToAdd = intervals[reviewCount] ?? 1;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysToAdd);

    return nextDate;
  }

  private updateOverallProgress(): void {
    const totalConcepts = TKA_CONCEPTS.length;
    const completedCount = this.progress.completedConcepts.size;
    this.progress.overallProgress = (completedCount / totalConcepts) * 100;
  }

  private checkBadges(): void {
    const badges = new Set(this.progress.badges);
    const completed = this.progress.completedConcepts.size;

    if (this.isCategoryComplete("foundation")) {
      badges.add("foundation-master");
    }
    if (this.isCategoryComplete("letters")) {
      badges.add("letter-master");
    }
    if (this.isCategoryComplete("combinations")) {
      badges.add("combination-master");
    }
    if (this.isCategoryComplete("advanced")) {
      badges.add("advanced-master");
    }

    if (completed >= 5) badges.add("first-five");
    if (completed >= 10) badges.add("halfway-there");
    if (completed >= 20) badges.add("almost-there");
    if (completed >= 28) badges.add("tka-master");

    const maxStreak = Math.max(
      ...Array.from(this.progress.concepts.values()).map((p) => p.bestStreak)
    );
    if (maxStreak >= 10) badges.add("streak-10");
    if (maxStreak >= 25) badges.add("streak-25");
    if (maxStreak >= 50) badges.add("streak-50");

    this.progress.badges = Array.from(badges);
  }

  private isCategoryComplete(category: string): boolean {
    const categoryConcepts = TKA_CONCEPTS.filter(
      (c) => c.category === category
    );
    return categoryConcepts.every((c) =>
      this.progress.completedConcepts.has(c.id)
    );
  }

  getConceptsDueForReview(): string[] {
    const now = new Date();
    const due: string[] = [];

    this.progress.concepts.forEach((progress, conceptId) => {
      if (
        progress.status === "completed" &&
        progress.nextPracticeAt &&
        new Date(progress.nextPracticeAt) <= now
      ) {
        due.push(conceptId);
      }
    });

    return due;
  }

  resetProgress(): void {
    this.progress = {
      concepts: new Map(),
      completedConcepts: new Set(),
      overallProgress: 0,
      totalCorrect: 0,
      totalTimeSpent: 0,
      badges: [],
      lastUpdated: new Date(),
    };
    this.saveProgress();
  }

  exportProgress(): string {
    return JSON.stringify(
      {
        concepts: Object.fromEntries(this.progress.concepts),
        completedConcepts: Array.from(this.progress.completedConcepts),
        currentConceptId: this.progress.currentConceptId,
        overallProgress: this.progress.overallProgress,
        totalCorrect: this.progress.totalCorrect,
        totalTimeSpent: this.progress.totalTimeSpent,
        badges: this.progress.badges,
        lastUpdated: this.progress.lastUpdated.toISOString(),
      },
      null,
      2
    );
  }

  importProgress(json: string): void {
    try {
      const data = JSON.parse(json);
      this.progress = {
        concepts: new Map(Object.entries(data.concepts || {})),
        completedConcepts: new Set(data.completedConcepts || []),
        currentConceptId: data.currentConceptId,
        overallProgress: data.overallProgress || 0,
        totalCorrect: data.totalCorrect || 0,
        totalTimeSpent: data.totalTimeSpent || 0,
        badges: data.badges || [],
        lastUpdated: new Date(data.lastUpdated || Date.now()),
      };
      this.saveProgress();
    } catch (error) {
      console.error("Failed to import progress:", error);
      throw new Error("Invalid progress data");
    }
  }
}
