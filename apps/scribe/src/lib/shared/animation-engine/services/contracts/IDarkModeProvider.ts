/**
 * IDarkModeProvider - Contract for reactive Dark Mode state access
 *
 * Provides a clean DI interface to the global Dark Mode setting.
 * Components can subscribe to changes instead of polling.
 */

export interface IDarkModeProvider {
  /**
   * Get the current Dark Mode state
   */
  isDarkMode(): boolean;

  /**
   * Subscribe to Dark Mode state changes
   * Returns an unsubscribe function
   */
  subscribe(callback: (darkMode: boolean) => void): () => void;

  /**
   * Set the Dark Mode state
   */
  setDarkMode(value: boolean): void;
}
