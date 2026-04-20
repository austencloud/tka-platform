/**
 * Debug Logger Utility
 * Provides conditional logging that can be enabled/disabled globally or per component
 */

interface DebugConfig {
  enabled: boolean;
  components: Record<string, boolean>;
}

interface TKADebugAPI {
  enable: () => void;
  disable: () => void;
  enableComponent: (component: string) => void;
  disableComponent: (component: string) => void;
  getConfig: () => DebugConfig;
  reset: () => void;
  help: () => void;
}

declare global {
  interface Window {
    __TKA_DEBUG__?: TKADebugAPI;
  }
}

class DebugLogger {
  private config: DebugConfig = {
    enabled: false, // Disabled by default in production
    components: {},
  };

  constructor() {
    // Debug logging disabled by default - use __TKA_DEBUG__.enable() to turn on
    this.config.enabled = false;

    // Load debug config from localStorage if available
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem("tka-debug-config");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DebugConfig>;
        // Only restore per-component overrides. `enabled` is always off on
        // load so a long-forgotten `__TKA_DEBUG__.enable()` doesn't pollute
        // every future session.
        if (parsed.components) this.config.components = parsed.components;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem("tka-debug-config", JSON.stringify(this.config));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Enable/disable debug logging globally
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  /**
   * Enable/disable debug logging for a specific component
   */
  setComponentEnabled(component: string, enabled: boolean): void {
    this.config.components[component] = enabled;
    this.saveConfig();
  }

  /**
   * Check if logging is enabled for a component
   */
  isEnabled(component?: string): boolean {
    if (!this.config.enabled) return false;
    if (!component) return true;

    // If component-specific setting exists, use it
    if (component in this.config.components) {
      return this.config.components[component] ?? true;
    }

    // Otherwise use global setting
    return true;
  }

  /**
   * Log a debug message if enabled
   */
  log(component: string, message: string, ...args: unknown[]): void {
    if (this.isEnabled(component)) {
      console.log(`🔍 ${component}: ${message}`, ...args);
    }
  }

  /**
   * Log an error message (always enabled)
   */
  error(component: string, message: string, ...args: unknown[]): void {
    console.error(`❌ ${component}: ${message}`, ...args);
  }

  /**
   * Log a warning message (always enabled)
   */
  warn(component: string, message: string, ...args: unknown[]): void {
    console.warn(`⚠️ ${component}: ${message}`, ...args);
  }

  /**
   * Log an info message if enabled
   */
  info(component: string, message: string, ...args: unknown[]): void {
    if (this.isEnabled(component)) {
      console.info(`ℹ️ ${component}: ${message}`, ...args);
    }
  }

  /**
   * Log a success message if enabled
   */
  success(component: string, message: string, ...args: unknown[]): void {
    if (this.isEnabled(component)) {
      console.log(`✅ ${component}: ${message}`, ...args);
    }
  }

  /**
   * Get current debug configuration
   */
  getConfig(): DebugConfig {
    return { ...this.config };
  }

  /**
   * Reset debug configuration to defaults
   */
  reset(): void {
    this.config = {
      enabled: false,
      components: {},
    };
    this.saveConfig();
  }
}

// Create singleton instance
export const debugLogger = new DebugLogger();

// Export convenience functions for common components
export const createComponentLogger = (componentName: string) => ({
  log: (message: string, ...args: unknown[]) =>
    debugLogger.log(componentName, message, ...args),
  error: (message: string, ...args: unknown[]) =>
    debugLogger.error(componentName, message, ...args),
  warn: (message: string, ...args: unknown[]) =>
    debugLogger.warn(componentName, message, ...args),
  info: (message: string, ...args: unknown[]) =>
    debugLogger.info(componentName, message, ...args),
  success: (message: string, ...args: unknown[]) =>
    debugLogger.success(componentName, message, ...args),
  isEnabled: () => debugLogger.isEnabled(componentName),
});

// Export debug control functions for browser console
if (typeof window !== "undefined") {
  window.__TKA_DEBUG__ = {
    enable: () => debugLogger.setEnabled(true),
    disable: () => debugLogger.setEnabled(false),
    enableComponent: (component: string) =>
      debugLogger.setComponentEnabled(component, true),
    disableComponent: (component: string) =>
      debugLogger.setComponentEnabled(component, false),
    getConfig: () => debugLogger.getConfig(),
    reset: () => debugLogger.reset(),
    help: () => {
      console.log(`
TKA Debug Logger Commands:
- __TKA_DEBUG__.enable() - Enable all debug logging
- __TKA_DEBUG__.disable() - Disable all debug logging
- __TKA_DEBUG__.enableComponent('ComponentName') - Enable logging for specific component
- __TKA_DEBUG__.disableComponent('ComponentName') - Disable logging for specific component
- __TKA_DEBUG__.getConfig() - Show current configuration
- __TKA_DEBUG__.reset() - Reset to defaults
      `);
    },
  };
}
