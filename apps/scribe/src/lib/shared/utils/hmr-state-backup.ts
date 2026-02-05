/**
 * HMR State Backup Utility
 *
 * Provides automatic state backup to localStorage during development
 * to preserve application state across HMR reloads.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HMRStateBackupOptions {
  key: string;
  enabled?: boolean;
  debounceMs?: number;
}

export interface BackupState<T = unknown> {
  timestamp: number;
  data: T;
  version: string;
}

// ============================================================================
// HMR STATE BACKUP CLASS
// ============================================================================

export class HMRStateBackup<T = unknown> {
  private key: string;
  private enabled: boolean;
  private debounceMs: number;
  private debounceTimer: number | null = null;
  private version: string = "1.0.0";

  constructor(options: HMRStateBackupOptions) {
    this.key = `hmr-backup-${options.key}`;
    this.enabled = options.enabled ?? import.meta.env.DEV ?? false;
    this.debounceMs = options.debounceMs ?? 500;
  }

  /**
   * Save state to localStorage with debouncing
   */
  save(state: T): void {
    if (!this.enabled || typeof localStorage === "undefined") {
      return;
    }

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the save operation
    this.debounceTimer = setTimeout(() => {
      try {
        const backupState: BackupState<T> = {
          timestamp: Date.now(),
          data: state,
          version: this.version,
        };

        localStorage.setItem(this.key, JSON.stringify(backupState));
      } catch (error) {
        console.warn(
          `⚠️ HMR: Failed to backup state for key: ${this.key}`,
          error
        );
      }
    }, this.debounceMs) as unknown as number;
  }

  /**
   * Load state from localStorage
   */
  load(): T | null {
    if (!this.enabled || typeof localStorage === "undefined") {
      return null;
    }

    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) {
        return null;
      }

      const backupState: BackupState = JSON.parse(stored);

      // Check if backup is recent (within last hour)
      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (backupState.timestamp < hourAgo) {
        this.clear();
        return null;
      }

      return backupState.data as T | null;
    } catch (error) {
      console.warn(
        `⚠️ HMR: Failed to load backup state for key: ${this.key}`,
        error
      );
      return null;
    }
  }

  /**
   * Clear backup from localStorage
   */
  clear(): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.warn(
        `⚠️ HMR: Failed to clear backup for key: ${this.key}`,
        error
      );
    }
  }

  /**
   * Check if backup exists
   */
  hasBackup(): boolean {
    if (!this.enabled || typeof localStorage === "undefined") {
      return false;
    }

    return localStorage.getItem(this.key) !== null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a simple HMR state backup instance
 */
export function createHMRBackup<T>(
  key: string,
  options?: Partial<HMRStateBackupOptions>
): HMRStateBackup<T> {
  return new HMRStateBackup<T>({
    key,
    ...options,
  });
}

/**
 * Create a reactive state with automatic HMR backup
 */
export function createBackedUpState<T>(
  key: string,
  initialValue: T,
  options?: Partial<HMRStateBackupOptions>
): {
  backup: HMRStateBackup<T>;
  getInitialValue: () => T;
  save: (value: T) => void;
  load: () => T | null;
  clear: () => void;
} {
  const backup = createHMRBackup<T>(key, options);

  return {
    backup,
    getInitialValue: () => backup.load() ?? initialValue,
    save: (value: T) => backup.save(value),
    load: () => backup.load(),
    clear: () => backup.clear(),
  };
}

// ============================================================================
// SVELTE INTEGRATION HELPERS
// ============================================================================

/**
 * Create a Svelte rune state with HMR backup
 * Usage in component:
 *
 * const { state, saveState } = createHMRState('my-form', { step: 1, data: {} });
 *
 * $effect(() => {
 *   saveState(state);
 * });
 */
export function createHMRState<T>(
  key: string,
  initialValue: T,
  options?: Partial<HMRStateBackupOptions>
) {
  const backup = createHMRBackup<T>(key, options);
  const restoredValue = backup.load() ?? initialValue;

  return {
    initialValue: restoredValue,
    saveState: (value: T) => backup.save(value),
    clearBackup: () => backup.clear(),
    hasBackup: () => backup.hasBackup(),
  };
}

/**
 * Clear all HMR backups (useful for cleanup)
 */
export function clearAllHMRBackups(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const keys = Object.keys(localStorage);
  const hmrKeys = keys.filter((key) => key.startsWith("hmr-backup-"));

  hmrKeys.forEach((key) => {
    localStorage.removeItem(key);
  });
}
