import type { PWADismissalState } from "./types";

const STORAGE_KEY = "tka_pwa_dismissal";

// Progressive delay times in milliseconds
const DISMISSAL_DELAYS = {
  FIRST: 7 * 24 * 60 * 60 * 1000, // 7 days
  SECOND: 30 * 24 * 60 * 60 * 1000, // 30 days
  THIRD_PLUS: 90 * 24 * 60 * 60 * 1000, // 90 days
} as const;

/**
 * PWA Install Dismissal Tracking Service Implementation
 *
 * Tracks dismissals and enforces respectful timing between prompts.
 * Uses localStorage for persistence.
 */
export class PWAInstallDismissalManager {
  private state: PWADismissalState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): PWADismissalState {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return this.getDefaultState();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Failed to load PWA dismissal state:", error);
    }

    return this.getDefaultState();
  }

  private saveState(): void {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn("Failed to save PWA dismissal state:", error);
    }
  }

  private getDefaultState(): PWADismissalState {
    return {
      dismissCount: 0,
      lastDismissed: null,
      neverAskAgain: false,
      hasInstalled: false,
    };
  }

  recordDismissal(): void {
    this.state.dismissCount++;
    this.state.lastDismissed = Date.now();
    this.saveState();
  }

  recordInstallation(): void {
    this.state.hasInstalled = true;
    this.saveState();
  }

  recordNeverAskAgain(): void {
    this.state.neverAskAgain = true;
    this.saveState();
  }

  canShowPrompt(): boolean {
    // Never show if user opted out or already installed
    if (this.state.neverAskAgain || this.state.hasInstalled) {
      return false;
    }

    // Can show if never dismissed before
    if (this.state.dismissCount === 0 || this.state.lastDismissed === null) {
      return true;
    }

    // Calculate required delay based on dismissal count
    let requiredDelay: number;
    if (this.state.dismissCount === 1) {
      requiredDelay = DISMISSAL_DELAYS.FIRST;
    } else if (this.state.dismissCount === 2) {
      requiredDelay = DISMISSAL_DELAYS.SECOND;
    } else {
      requiredDelay = DISMISSAL_DELAYS.THIRD_PLUS;
    }

    // Check if enough time has passed
    const timeSinceLastDismissal = Date.now() - this.state.lastDismissed;
    return timeSinceLastDismissal >= requiredDelay;
  }

  getDaysUntilNextPrompt(): number {
    // Never show again
    if (this.state.neverAskAgain || this.state.hasInstalled) {
      return -1;
    }

    // Can show now
    if (this.state.dismissCount === 0 || this.state.lastDismissed === null) {
      return 0;
    }

    // Calculate required delay
    let requiredDelay: number;
    if (this.state.dismissCount === 1) {
      requiredDelay = DISMISSAL_DELAYS.FIRST;
    } else if (this.state.dismissCount === 2) {
      requiredDelay = DISMISSAL_DELAYS.SECOND;
    } else {
      requiredDelay = DISMISSAL_DELAYS.THIRD_PLUS;
    }

    // Calculate days remaining
    const timeSinceLastDismissal = Date.now() - this.state.lastDismissed;
    const timeRemaining = requiredDelay - timeSinceLastDismissal;

    if (timeRemaining <= 0) {
      return 0;
    }

    return Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
  }

  getState(): PWADismissalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.getDefaultState();
    this.saveState();
  }
}
