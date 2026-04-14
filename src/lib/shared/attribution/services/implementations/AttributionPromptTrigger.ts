/**
 * AttributionPromptTrigger
 *
 * Determines when to show the deferred attribution prompt
 * based on user engagement and time since signup.
 */

import { browser } from "$app/environment";
import type { IAttributionPromptTrigger } from "../contracts/IAttributionPromptTrigger";
import type {
  AttributionPromptState,
  AttributionPromptConfig,
  EngagementMetrics,
} from "../../domain/prompt-types";
import {
  DEFAULT_PROMPT_CONFIG,
  PROMPT_STATE_KEY,
} from "../../domain/prompt-types";

const METRICS_KEY = "tka-attribution-metrics";

interface StoredMetrics {
  sequencesViewed: number;
  sequencesCreated: number;
  modulesVisited: Set<string> | string[]; // Set in memory, array in JSON
  sessionCount: number;
  firstSeen: string;
}

export class AttributionPromptTrigger implements IAttributionPromptTrigger {
  private config: AttributionPromptConfig;

  constructor(config: AttributionPromptConfig = DEFAULT_PROMPT_CONFIG) {
    this.config = config;
  }

  shouldShowPrompt(): boolean {
    if (!browser) return false;

    const state = this.getPromptState();

    // Already completed - never show again
    if (state.completed) {
      return false;
    }

    // Shown too many times - give up
    if (state.showCount >= this.config.maxShowCount) {
      return false;
    }

    // Not yet eligible (too soon after signup)
    const now = new Date();
    const eligibleAfter = new Date(state.eligibleAfter);
    if (now < eligibleAfter) {
      return false;
    }

    // Recently dismissed - respect cooldown
    if (state.lastDismissed) {
      const dismissedAt = new Date(state.lastDismissed);
      const cooldownMs = this.config.dismissalCooldownHours * 60 * 60 * 1000;
      if (now.getTime() - dismissedAt.getTime() < cooldownMs) {
        return false;
      }
    }

    // Check engagement thresholds
    const metrics = this.getEngagementMetrics();

    const totalInteractions = metrics.sequencesViewed + metrics.sequencesCreated;
    if (totalInteractions < this.config.minInteractions) {
      return false;
    }

    if (metrics.modulesVisited < this.config.minModulesVisited) {
      return false;
    }

    // All conditions met
    return true;
  }

  getEngagementMetrics(): EngagementMetrics {
    const stored = this.loadMetrics();
    const modulesSet = Array.isArray(stored.modulesVisited)
      ? new Set(stored.modulesVisited)
      : stored.modulesVisited;

    const firstSeen = new Date(stored.firstSeen);
    const now = new Date();
    const daysSinceSignup = Math.floor(
      (now.getTime() - firstSeen.getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      sequencesViewed: stored.sequencesViewed,
      sequencesCreated: stored.sequencesCreated,
      modulesVisited: modulesSet.size,
      sessionCount: stored.sessionCount,
      daysSinceSignup,
    };
  }

  getPromptState(): AttributionPromptState {
    if (!browser) {
      return this.createDefaultState();
    }

    try {
      const stored = localStorage.getItem(PROMPT_STATE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("[AttributionPromptTrigger] Failed to load prompt state:", error);
    }

    return this.createDefaultState();
  }

  initializeForNewUser(): void {
    if (!browser) return;

    // Set eligibility to minDaysAfterSignup from now
    const eligibleAfter = new Date();
    eligibleAfter.setDate(eligibleAfter.getDate() + this.config.minDaysAfterSignup);

    const state: AttributionPromptState = {
      completed: false,
      showCount: 0,
      eligibleAfter: eligibleAfter.toISOString(),
    };

    this.savePromptState(state);

    // Initialize metrics
    const metrics: StoredMetrics = {
      sequencesViewed: 0,
      sequencesCreated: 0,
      modulesVisited: [],
      sessionCount: 1,
      firstSeen: new Date().toISOString(),
    };

    this.saveMetrics(metrics);
  }

  recordPromptShown(): void {
    const state = this.getPromptState();
    state.showCount++;
    this.savePromptState(state);
  }

  recordPromptDismissed(): void {
    const state = this.getPromptState();
    state.lastDismissed = new Date().toISOString();
    this.savePromptState(state);
  }

  recordPromptCompleted(): void {
    const state = this.getPromptState();
    state.completed = true;
    state.completedAt = new Date().toISOString();
    this.savePromptState(state);
  }

  recordInteraction(type: "sequence_view" | "sequence_create" | "module_visit"): void {
    if (!browser) return;

    const metrics = this.loadMetrics();
    const modulesSet = Array.isArray(metrics.modulesVisited)
      ? new Set(metrics.modulesVisited)
      : metrics.modulesVisited;

    switch (type) {
      case "sequence_view":
        metrics.sequencesViewed++;
        break;
      case "sequence_create":
        metrics.sequencesCreated++;
        break;
      case "module_visit":
        // Module ID should be passed separately, but for now we just count
        // This will be called with actual module IDs from navigation
        break;
    }

    metrics.modulesVisited = Array.from(modulesSet);
    this.saveMetrics(metrics);
  }

  /**
   * Record a module visit with the module ID
   */
  recordModuleVisit(moduleId: string): void {
    if (!browser) return;

    const metrics = this.loadMetrics();
    const modulesSet = Array.isArray(metrics.modulesVisited)
      ? new Set(metrics.modulesVisited)
      : metrics.modulesVisited;

    modulesSet.add(moduleId);
    metrics.modulesVisited = Array.from(modulesSet);
    this.saveMetrics(metrics);
  }

  /**
   * Increment session count (called on app init).
   *
   * On the very first app boot, nothing is persisted yet — so the default
   * state from getPromptState() returns a fresh "eligibleAfter = now + minDays"
   * every session without ever saving it, which would make the deferred
   * eligibility drift forward forever. Here we detect that first boot (no
   * stored prompt state) and persist the initial state so the clock actually
   * starts ticking.
   */
  recordSessionStart(): void {
    if (!browser) return;

    const hasStoredState = localStorage.getItem(PROMPT_STATE_KEY) !== null;
    const hasStoredMetrics = localStorage.getItem(METRICS_KEY) !== null;

    if (!hasStoredState || !hasStoredMetrics) {
      this.initializeForNewUser();
      return;
    }

    const metrics = this.loadMetrics();
    metrics.sessionCount++;
    this.saveMetrics(metrics);
  }

  // Private helpers

  private createDefaultState(): AttributionPromptState {
    const eligibleAfter = new Date();
    eligibleAfter.setDate(eligibleAfter.getDate() + this.config.minDaysAfterSignup);

    return {
      completed: false,
      showCount: 0,
      eligibleAfter: eligibleAfter.toISOString(),
    };
  }

  private loadMetrics(): StoredMetrics {
    if (!browser) {
      return {
        sequencesViewed: 0,
        sequencesCreated: 0,
        modulesVisited: [],
        sessionCount: 0,
        firstSeen: new Date().toISOString(),
      };
    }

    try {
      const stored = localStorage.getItem(METRICS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("[AttributionPromptTrigger] Failed to load metrics:", error);
    }

    return {
      sequencesViewed: 0,
      sequencesCreated: 0,
      modulesVisited: [],
      sessionCount: 0,
      firstSeen: new Date().toISOString(),
    };
  }

  private saveMetrics(metrics: StoredMetrics): void {
    if (!browser) return;

    try {
      // Ensure modulesVisited is serializable
      const toSave = {
        ...metrics,
        modulesVisited: Array.isArray(metrics.modulesVisited)
          ? metrics.modulesVisited
          : Array.from(metrics.modulesVisited),
      };
      localStorage.setItem(METRICS_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.warn("[AttributionPromptTrigger] Failed to save metrics:", error);
    }
  }

  private savePromptState(state: AttributionPromptState): void {
    if (!browser) return;

    try {
      localStorage.setItem(PROMPT_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("[AttributionPromptTrigger] Failed to save prompt state:", error);
    }
  }
}
