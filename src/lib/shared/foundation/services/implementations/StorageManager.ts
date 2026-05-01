import type { IStorageManager } from "../contracts/IStorageManager";

export class StorageManager implements IStorageManager {
  safeSessionStorageGet<T>(
    key: string,
    defaultValue: T | null = null
  ): T | null {
    try {
      const stored = sessionStorage.getItem(key);

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

  safeLocalStorageGet<T>(key: string, defaultValue: T | null = null): T | null {
    try {
      const stored = localStorage.getItem(key);

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

  safeLocalStorageSet<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to set localStorage value for key "${key}":`, error);
    }
  }

  removeSessionStorageItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove sessionStorage key "${key}":`, error);
    }
  }

  removeLocalStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage key "${key}":`, error);
    }
  }

  clearSessionStorage(): void {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.warn("Failed to clear sessionStorage:", error);
    }
  }

  clearLocalStorage(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn("Failed to clear localStorage:", error);
    }
  }
}
