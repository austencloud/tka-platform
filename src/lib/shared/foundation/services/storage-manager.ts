export function safeSessionStorageGet<T>(
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

export function safeSessionStorageSet<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(
      `Failed to set sessionStorage value for key "${key}":`,
      error
    );
  }
}

export function safeLocalStorageGet<T>(key: string, defaultValue: T | null = null): T | null {
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

export function safeLocalStorageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to set localStorage value for key "${key}":`, error);
  }
}

/**
 * Raw (non-JSON-encoded) localStorage.setItem, guarded against a throw
 * (QuotaExceededError in a full/private-browsing store). Use this - not
 * safeLocalStorageSet - for callers that already write/read plain strings
 * directly (flags like "true", ISO timestamps, numeric strings) rather than
 * JSON-encoded values; wrapping those in safeLocalStorageSet would change
 * the stored format and break every other localStorage.getItem() reading
 * the same key. See onboarding state modules for the primary caller.
 */
export function safeLocalStorageSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to set localStorage value for key "${key}":`, error);
  }
}

export function removeSessionStorageItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove sessionStorage key "${key}":`, error);
  }
}

export function removeLocalStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove localStorage key "${key}":`, error);
  }
}

export function clearSessionStorage(): void {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn("Failed to clear sessionStorage:", error);
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.warn("Failed to clear localStorage:", error);
  }
}
