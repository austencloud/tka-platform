/**
 * Storage Service Contract
 *
 * Provides safe wrappers around localStorage and sessionStorage
 * to prevent JSON parsing errors and undefined value issues.
 */

export interface IStorageManager {
  /**
   * Safely get and parse a value from sessionStorage
   */
  safeSessionStorageGet<T>(key: string, defaultValue?: T | null): T | null;

  /**
   * Safely set a value to sessionStorage
   */
  safeSessionStorageSet<T>(key: string, value: T): void;

  /**
   * Safely get and parse a value from localStorage
   */
  safeLocalStorageGet<T>(key: string, defaultValue?: T | null): T | null;

  /**
   * Safely set a value to localStorage
   */
  safeLocalStorageSet<T>(key: string, value: T): void;

  /**
   * Remove a key from sessionStorage
   */
  removeSessionStorageItem(key: string): void;

  /**
   * Remove a key from localStorage
   */
  removeLocalStorageItem(key: string): void;

  /**
   * Clear all sessionStorage
   */
  clearSessionStorage(): void;

  /**
   * Clear all localStorage
   */
  clearLocalStorage(): void;
}
