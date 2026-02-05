/**
 * Resource Tracker Interface
 *
 * Monitors application resource usage and performance.
 */

export interface IResourceTracker {
  /**
   * Start tracking resources
   */
  startTracking(): void;

  /**
   * Stop tracking resources
   */
  stopTracking(): void;

  /**
   * Get current resource usage
   */
  getCurrentUsage(): {
    memoryUsage: number;
    cpuUsage?: number;
    activeConnections: number;
  };

  /**
   * Get resource usage history
   */
  getUsageHistory(): Array<{
    timestamp: Date;
    memoryUsage: number;
    cpuUsage?: number;
  }>;
}
