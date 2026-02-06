/**
 * Storage Service Implementation
 *
 * Provides safe wrappers around localStorage and sessionStorage
 * to prevent JSON parsing errors and undefined value issues.
 */

import type { IStorageManager } from "../contracts/IStorageManager";

export class StorageManager implements IStorageManager {
  /**
   * Safely get and parse a value from sessionStorage
   */
  safeSessionStorageGet<T>(
    key: string,
    defaultValue: T | null = null
  ): T | null {
    try {
      const stored = sessionStorage.getItem(key);

      // Check for undefined, null, or empty string values
      if (
        !stored ||
        stored === "undefined" ||
        stored === "null" ||
        stored.trim() === ""
      ) {
        return defaultValue;
      }

      return JSON.parse(stored) as T;
    } catch (error) {
      console.warn(
        `Failed to parse sessionStorage value for key "${key}":`,
        error
      );
      return defaultValue;
    }
  }

  /**
   * Safely set a value to sessionStorage
   */
  safeSessionStorageSet<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(
        `Failed to set sessionStorage value for key "${key}":`,
        error
      );
    }
  }

  /**
   * Safely get and parse a value from localStorage
   */
  safeLocalStorageGet<T>(key: string, defaultValue: T | null = null): T | null {
    try {
      const stored = localStorage.getItem(key);

      // Check for undefined, null, or empty string values
      if (
        !stored ||
        stored === "undefined" ||
        stored === "null" ||
        stored.trim() === ""
      ) {
        return defaultValue;
      }

      return JSON.parse(stored) as T;
    } catch (error) {
      console.warn(
        `Failed to parse localStorage value for key "${key}":`,
        error
      );
      return defaultValue;
    }
  }

  /**
   * Safely set a value to localStorage
   */
  safeLocalStorageSet<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to set localStorage value for key "${key}":`, error);
    }
  }

  /**
   * Remove a key from sessionStorage
   */
  removeSessionStorageItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove sessionStorage key "${key}":`, error);
    }
  }

  /**
   * Remove a key from localStorage
   */
  removeLocalStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage key "${key}":`, error);
    }
  }

  /**
   * Clear all sessionStorage
   */
  clearSessionStorage(): void {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.warn("Failed to clear sessionStorage:", error);
    }
  }

  /**
   * Clear all localStorage
   */
  clearLocalStorage(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn("Failed to clear localStorage:", error);
    }
  }
}
