/**
 * Performance Metrics State Factory
 *
 * Tracks application performance metrics using Svelte 5 runes.
 * Clean separation of performance tracking from other concerns.
 */

import type { UIPerformanceMetrics } from "../../foundation/ui/UITypes";
import type { IPerformanceMetricsState } from "./IPerformanceMetricsState";

/**
 * Factory function to create performance metrics state
 * Uses Svelte 5 runes for reactivity
 */
export function createPerformanceMetricsState(): IPerformanceMetricsState {
  // Performance metrics state using $state rune
  const performanceMetrics = $state<UIPerformanceMetrics>({
    initializationTime: 0,
    lastRenderTime: 0,
    memoryUsage: 0,
  });

  return {
    // ============================================================================
    // GETTERS
    // ============================================================================

    get performanceMetrics() {
      return performanceMetrics;
    },

    // ============================================================================
    // ACTIONS
    // ============================================================================

    updateInitializationTime(time: number): void {
      performanceMetrics.initializationTime = time;
    },

    updateLastRenderTime(time: number): void {
      performanceMetrics.lastRenderTime = time;
    },

    updateMemoryUsage(): void {
      if (typeof performance !== "undefined" && "memory" in performance) {
        const memory = (performance as { memory: { usedJSHeapSize: number } })
          .memory;
        performanceMetrics.memoryUsage = Math.round(
          memory.usedJSHeapSize / 1048576
        );
      }
    },

    resetMetrics(): void {
      performanceMetrics.initializationTime = 0;
      performanceMetrics.lastRenderTime = 0;
      performanceMetrics.memoryUsage = 0;
    },
  };
}

// Export the factory function for DI container binding
// Singleton instance will be managed by the DI container
