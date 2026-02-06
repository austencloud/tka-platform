/**
 * Migration State Management
 *
 * Tracks user's migration notification state using localStorage.
 * Handles reminder counting, timing, and determining what to show.
 */

import {
  MIGRATION_CONFIG,
  getDaysUntilDeadline,
  getMigrationSeverity,
  isOnOldDomain,
} from "../config/migration-config";

interface MigrationStorageState {
  /** How many reminders have been shown */
  remindersShown: number;
  /** Timestamp of last reminder */
  lastReminderAt: number | null;
  /** Whether user has completed migration (installed on new domain) */
  migrationCompleted: boolean;
  /** First time user saw migration notice */
  firstSeenAt: number | null;
}

const DEFAULT_STATE: MigrationStorageState = {
  remindersShown: 0,
  lastReminderAt: null,
  migrationCompleted: false,
  firstSeenAt: null,
};

/**
 * Load state from localStorage
 */
function loadState(): MigrationStorageState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const stored = localStorage.getItem(MIGRATION_CONFIG.STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load migration state:", e);
  }
  return DEFAULT_STATE;
}

/**
 * Save state to localStorage
 */
function saveState(state: MigrationStorageState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(MIGRATION_CONFIG.STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save migration state:", e);
  }
}

// Reactive state
let storedState = $state<MigrationStorageState>(DEFAULT_STATE);

/**
 * Initialize state (call on mount)
 */
function initialize(): void {
  storedState = loadState();
}

/**
 * Check if enough time has passed since last reminder
 */
function canShowReminder(): boolean {
  if (!storedState.lastReminderAt) return true;

  const hoursSinceLastReminder =
    (Date.now() - storedState.lastReminderAt) / (1000 * 60 * 60);
  return hoursSinceLastReminder >= MIGRATION_CONFIG.MIN_HOURS_BETWEEN_REMINDERS;
}

/**
 * Record that a reminder was shown
 */
function recordReminderShown(): void {
  const newState: MigrationStorageState = {
    ...storedState,
    remindersShown: storedState.remindersShown + 1,
    lastReminderAt: Date.now(),
    firstSeenAt: storedState.firstSeenAt || Date.now(),
  };
  storedState = newState;
  saveState(newState);
}

/**
 * Mark migration as completed (user went to new domain)
 */
function markMigrationCompleted(): void {
  const newState: MigrationStorageState = {
    ...storedState,
    migrationCompleted: true,
  };
  storedState = newState;
  saveState(newState);
}

/**
 * Reset state (for testing)
 */
function resetState(): void {
  storedState = DEFAULT_STATE;
  if (typeof window !== "undefined") {
    localStorage.removeItem(MIGRATION_CONFIG.STORAGE_KEY);
  }
}

/**
 * Centralized migration state
 */
export const migrationState = {
  // Initialization
  initialize,
  resetState,

  // Core state getters (reactive)
  get isEnabled() {
    return MIGRATION_CONFIG.ENABLED;
  },

  get isOnOldDomain() {
    return isOnOldDomain();
  },

  get remindersShown() {
    return storedState.remindersShown;
  },

  get remindersRemaining() {
    return Math.max(
      0,
      MIGRATION_CONFIG.TOTAL_REMINDERS - storedState.remindersShown
    );
  },

  get totalReminders() {
    return MIGRATION_CONFIG.TOTAL_REMINDERS;
  },

  get daysUntilDeadline() {
    return getDaysUntilDeadline();
  },

  get severity() {
    return getMigrationSeverity(getDaysUntilDeadline());
  },

  get migrationCompleted() {
    return storedState.migrationCompleted;
  },

  get isFirstReminder() {
    return storedState.remindersShown === 0;
  },

  get isFinalReminder() {
    return storedState.remindersShown >= MIGRATION_CONFIG.TOTAL_REMINDERS - 1;
  },

  get isDeadlinePassed() {
    return getDaysUntilDeadline() <= 0;
  },

  /**
   * Should we show any migration notice?
   */
  get shouldShowNotice(): boolean {
    // Not enabled
    if (!MIGRATION_CONFIG.ENABLED) return false;

    // Not on old domain
    if (!isOnOldDomain()) return false;

    // Already completed migration
    if (storedState.migrationCompleted) return false;

    // All reminders exhausted and deadline hasn't passed
    if (
      storedState.remindersShown >= MIGRATION_CONFIG.TOTAL_REMINDERS &&
      getDaysUntilDeadline() > 0
    ) {
      return false;
    }

    // Check timing between reminders
    if (!canShowReminder()) return false;

    return true;
  },

  /**
   * Should we show the full modal (first time or critical)?
   */
  get shouldShowModal(): boolean {
    if (!this.shouldShowNotice) return false;

    // First reminder always gets modal
    if (storedState.remindersShown === 0) return true;

    // Critical severity gets modal
    if (getMigrationSeverity(getDaysUntilDeadline()) === "critical")
      return true;

    // Final reminder gets modal
    if (storedState.remindersShown >= MIGRATION_CONFIG.TOTAL_REMINDERS - 1)
      return true;

    return false;
  },

  /**
   * Should we show the banner (subsequent reminders)?
   */
  get shouldShowBanner(): boolean {
    if (!this.shouldShowNotice) return false;
    return !this.shouldShowModal;
  },

  // Actions
  recordReminderShown,
  markMigrationCompleted,
};
