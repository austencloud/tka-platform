/**
 * HMR Debug Utilities
 *
 * Provides debugging tools for Hot Module Replacement issues
 * and container state management during development.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HMRDebugInfo {
  timestamp: number;
  containerInitialized: boolean;
  globalContainerExists: boolean;
  hmrActive: boolean;
  backupCount: number;
  lastError?: string;
}

// ============================================================================
// HMR DEBUG UTILITIES
// ============================================================================

export class HMRDebugger {
  private static instance: HMRDebugger | null = null;
  private logs: HMRDebugInfo[] = [];
  private maxLogs = 50;

  static getInstance(): HMRDebugger {
    if (!HMRDebugger.instance) {
      HMRDebugger.instance = new HMRDebugger();
    }
    return HMRDebugger.instance;
  }

  /**
   * Log current HMR state
   */
  logState(error?: string): void {
    if (!import.meta.env.DEV) return;

    const info: HMRDebugInfo = {
      timestamp: Date.now(),
      containerInitialized: this.checkContainerInitialized(),
      globalContainerExists: this.checkGlobalContainer(),
      hmrActive: this.checkHMRActive(),
      backupCount: this.getBackupCount(),
      ...(error !== undefined && { lastError: error }),
    };

    this.logs.push(info);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log removed - data still tracked for debugging
  }

  /**
   * Get recent HMR logs
   */
  getLogs(): HMRDebugInfo[] {
    return [...this.logs];
  }

  /**
   * Clear debug logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Check if container is initialized
   */
  private checkContainerInitialized(): boolean {
    return (
      typeof globalThis !== "undefined" &&
      globalThis.__TKA_CONTAINER_INITIALIZED__ === true
    );
  }

  /**
   * Check if global container exists
   */
  private checkGlobalContainer(): boolean {
    return globalThis.__TKA_CONTAINER__ !== undefined;
  }

  /**
   * Check if HMR is active
   */
  private checkHMRActive(): boolean {
    return import.meta.hot !== undefined;
  }

  /**
   * Count HMR backup entries in localStorage
   */
  private getBackupCount(): number {
    if (typeof localStorage === "undefined") return 0;

    const keys = Object.keys(localStorage);
    return keys.filter((key) => key.startsWith("hmr-backup-")).length;
  }

  /**
   * Generate comprehensive debug report
   */
  generateReport(): string {
    const report = [
      "🔍 HMR Debug Report",
      "==================",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Environment: ${import.meta.env.MODE}`,
      `HMR Active: ${this.checkHMRActive()}`,
      `Container Initialized: ${this.checkContainerInitialized()}`,
      `Global Container Exists: ${this.checkGlobalContainer()}`,
      `Backup Count: ${this.getBackupCount()}`,
      "",
      "Recent Logs:",
      "------------",
    ];

    this.logs.slice(-10).forEach((log, index) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      report.push(
        `${index + 1}. [${time}] Container: ${log.containerInitialized}, Global: ${log.globalContainerExists}, HMR: ${log.hmrActive}, Backups: ${log.backupCount}`
      );
      if (log.lastError) {
        report.push(`   Error: ${log.lastError}`);
      }
    });

    return report.join("\n");
  }

  /**
   * Export debug data for sharing
   */
  exportDebugData(): object {
    return {
      timestamp: Date.now(),
      environment: import.meta.env.MODE,
      hmrActive: this.checkHMRActive(),
      containerState: {
        initialized: this.checkContainerInitialized(),
        globalExists: this.checkGlobalContainer(),
      },
      backupCount: this.getBackupCount(),
      recentLogs: this.logs.slice(-20),
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick debug log for HMR state
 */
export function debugHMR(_message?: string, error?: string): void {
  if (!import.meta.env.DEV) return;

  const hmrDebugger = HMRDebugger.getInstance();
  // Verbose logging removed, data still tracked
  hmrDebugger.logState(error);
}

/**
 * Log HMR error with context
 */
export function debugHMRError(error: Error | string, context?: string): void {
  if (!import.meta.env.DEV) return;

  const errorMessage = error instanceof Error ? error.message : error;
  const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;

  debugHMR("Error occurred", fullMessage);
}

/**
 * Generate and log debug report
 */
export function logHMRReport(): void {
  if (!import.meta.env.DEV) return;

  const hmrDebugger = HMRDebugger.getInstance();
  hmrDebugger.generateReport();
}

/**
 * Clear all HMR debug data
 */
export function clearHMRDebug(): void {
  if (!import.meta.env.DEV) return;

  const hmrDebugger = HMRDebugger.getInstance();
  hmrDebugger.clearLogs();
}

// ============================================================================
// GLOBAL DEBUG ACCESS
// ============================================================================

// Make debug utilities available globally in development
if (import.meta.env.DEV && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TKA_HMR_DEBUG__ = {
    instance: HMRDebugger.getInstance(),
    debug: debugHMR,
    error: debugHMRError,
    report: logHMRReport,
    clear: clearHMRDebug,
    inspectState: () => {
      console.log("HMR Debugger State:", HMRDebugger.getInstance());
    },
    clearState: () => {
      clearHMRDebug();
    },
  };

  // HMR debug utilities available silently
}
