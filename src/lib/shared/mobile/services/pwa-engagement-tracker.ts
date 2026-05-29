import type { PWAEngagementMetrics } from "./types";

const STORAGE_KEY = "tka_pwa_engagement";

// Thresholds for showing install prompt
const ENGAGEMENT_THRESHOLDS = {
  VISITS: 2,
  INTERACTIONS: 5,
  TIME_SPENT_MS: 120000, // 2 minutes
  HAS_CREATED_SEQUENCE: true,
} as const;

/**
 * PWA Engagement Tracking Service Implementation
 *
 * Tracks user engagement to determine optimal timing for install prompts.
 * Uses localStorage for persistence across sessions.
 */
export class PWAEngagementTracker {
  private metrics: PWAEngagementMetrics;
  private sessionStartTime: number | null = null;
  private sessionIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.metrics = this.loadMetrics();
  }

  private loadMetrics(): PWAEngagementMetrics {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return this.getDefaultMetrics();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Failed to load PWA engagement metrics:", error);
    }

    return this.getDefaultMetrics();
  }

  private saveMetrics(): void {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metrics));
    } catch (error) {
      console.warn("Failed to save PWA engagement metrics:", error);
    }
  }

  private getDefaultMetrics(): PWAEngagementMetrics {
    const now = Date.now();
    return {
      visitCount: 0,
      hasCreatedSequence: false,
      interactionCount: 0,
      totalTimeSpent: 0,
      firstVisit: now,
      lastVisit: now,
    };
  }

  recordVisit(): void {
    this.metrics.visitCount++;
    this.metrics.lastVisit = Date.now();
    this.saveMetrics();
  }

  recordSequenceCreated(): void {
    if (!this.metrics.hasCreatedSequence) {
      this.metrics.hasCreatedSequence = true;
      this.saveMetrics();
    }
  }

  recordInteraction(): void {
    this.metrics.interactionCount++;
    this.saveMetrics();
  }

  startSession(): void {
    if (this.sessionStartTime !== null) {
      return; // Session already started
    }

    this.sessionStartTime = Date.now();

    // Update total time every 10 seconds
    this.sessionIntervalId = setInterval(() => {
      if (this.sessionStartTime !== null) {
        const sessionDuration = Date.now() - this.sessionStartTime;
        this.metrics.totalTimeSpent += sessionDuration;
        this.sessionStartTime = Date.now(); // Reset for next interval
        this.saveMetrics();
      }
    }, 10000); // 10 seconds
  }

  endSession(): void {
    if (this.sessionStartTime !== null) {
      const sessionDuration = Date.now() - this.sessionStartTime;
      this.metrics.totalTimeSpent += sessionDuration;
      this.sessionStartTime = null;
      this.saveMetrics();
    }

    if (this.sessionIntervalId !== null) {
      clearInterval(this.sessionIntervalId);
      this.sessionIntervalId = null;
    }
  }

  getMetrics(): PWAEngagementMetrics {
    return { ...this.metrics };
  }

  shouldShowInstallPrompt(): boolean {
    // Check all engagement signals
    const hasEnoughVisits =
      this.metrics.visitCount >= ENGAGEMENT_THRESHOLDS.VISITS;
    const hasEnoughInteractions =
      this.metrics.interactionCount >= ENGAGEMENT_THRESHOLDS.INTERACTIONS;
    const hasEnoughTimeSpent =
      this.metrics.totalTimeSpent >= ENGAGEMENT_THRESHOLDS.TIME_SPENT_MS;
    const hasCreatedSequence = this.metrics.hasCreatedSequence;

    // Show prompt if ANY engagement threshold is met
    return (
      hasCreatedSequence ||
      hasEnoughVisits ||
      hasEnoughInteractions ||
      hasEnoughTimeSpent
    );
  }

  reset(): void {
    this.metrics = this.getDefaultMetrics();
    this.endSession();
    this.saveMetrics();
  }
}
