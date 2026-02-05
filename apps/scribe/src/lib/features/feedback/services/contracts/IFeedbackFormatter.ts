/**
 * IFeedbackFormatter
 *
 * Contract for formatting feedback display data (dates, times, labels).
 * Provides utilities for consistent formatting across feedback components.
 */

/**
 * Contract for feedback formatting operations
 */
export interface IFeedbackFormatter {
  /**
   * Format date as "Jan 15, 2024 at 3:45 PM"
   */
  formatDate(date: Date): string;

  /**
   * Format relative time as "Just now", "5 minutes ago", "Yesterday", etc.
   */
  formatRelativeTime(date: Date): string;

  /**
   * Get module label from module ID
   */
  getModuleLabel(moduleId: string): string;

  /**
   * Get tab label from module ID and tab ID
   */
  getTabLabel(moduleId: string, tabId: string): string;
}
