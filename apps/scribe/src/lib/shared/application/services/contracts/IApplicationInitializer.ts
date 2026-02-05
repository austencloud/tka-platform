/**
 * Application Initializer Interface
 *
 * Handles application startup and initialization logic.
 */

export interface IApplicationInitializer {
  /**
   * Initialize the application
   */
  initialize(): Promise<void>;

  /**
   * Get initialization status
   */
  isInitialized(): boolean;

  /**
   * Shutdown the application gracefully
   */
  shutdown(): Promise<void>;
}
