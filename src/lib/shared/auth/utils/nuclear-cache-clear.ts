/**
 * NUCLEAR CACHE CLEAR - Complete Firebase/Auth Storage Wipeout
 *
 * This utility COMPLETELY removes ALL Firebase-related storage.
 * Use this to fix auth issues caused by old cached data.
 */

export interface CacheDiagnostics {
  indexedDBDatabases: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  cookies: string[];
}

/**
 * Diagnose what's currently in browser storage
 * This shows EXACTLY what databases and keys exist
 */
export async function diagnoseCacheState(): Promise<CacheDiagnostics> {
  const diagnostics: CacheDiagnostics = {
    indexedDBDatabases: [],
    localStorageKeys: [],
    sessionStorageKeys: [],
    cookies: [],
  };

  // 1. List ALL IndexedDB databases
  try {
    if (window.indexedDB.databases) {
      const databases = await window.indexedDB.databases();
      diagnostics.indexedDBDatabases = databases
        .map((db) => db.name || "unnamed")
        .filter(Boolean);
    } else {
      diagnostics.indexedDBDatabases = ["indexedDB.databases not supported"];
    }

  } catch {
    // IndexedDB listing failed
  }

  // 2. List ALL localStorage keys
  try {
    diagnostics.localStorageKeys = Object.keys(localStorage);
  } catch {
    // localStorage listing failed
  }

  // 3. List ALL sessionStorage keys
  try {
    diagnostics.sessionStorageKeys = Object.keys(sessionStorage);
  } catch {
    // sessionStorage listing failed
  }

  // 4. List ALL cookies
  try {
    diagnostics.cookies = document.cookie
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter((name): name is string => !!name);
  } catch {
    // cookie listing failed
  }

  return diagnostics;
}

/**
 * NUCLEAR OPTION: Delete EVERYTHING Firebase/Auth related
 * This is the most aggressive cache clearing possible
 */
export async function nuclearCacheClear(): Promise<void> {

  // 1. DELETE ALL INDEXEDDB DATABASES (not just Firebase ones)
  try {
    if (window.indexedDB.databases) {
      const databases = await window.indexedDB.databases();

      for (const db of databases) {
        const dbName = db.name;
        if (!dbName) continue;

        // Delete ALL databases (Firebase, Firestore, everything)
        try {
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = window.indexedDB.deleteDatabase(dbName);

            deleteRequest.onsuccess = () => {
              resolve();
            };

            deleteRequest.onerror = () => {
              reject(new Error(`Failed to delete IndexedDB: ${dbName}`));
            };

            deleteRequest.onblocked = () => {
              // Resolve anyway - we'll retry on next load
              resolve();
            };
          });
        } catch {
          // Continue with other databases
        }
      }
    }
  } catch {
    // IndexedDB listing failed
  }

  // ============================================================================
  // 2. CLEAR ALL LOCALSTORAGE
  // ============================================================================
  try {
    localStorage.clear();
  } catch {
    // localStorage clear failed
  }

  // ============================================================================
  // 3. CLEAR ALL SESSIONSTORAGE
  // ============================================================================
  try {
    sessionStorage.clear();
  } catch {
    // sessionStorage clear failed
  }

  // ============================================================================
  // 4. DELETE ALL COOKIES
  // ============================================================================
  try {
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
      const cookieName = cookie.split("=")[0]?.trim();
      if (!cookieName) continue;
      // Delete for all possible domains and paths
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    }
  } catch {
    // cookie deletion failed
  }

  // ============================================================================
  // 5. CLEAR CACHE STORAGE (Service Worker caches)
  // ============================================================================
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }
  } catch {
    // cache storage clear failed
  }
}

/**
 * Show diagnostics in a user-friendly alert
 */
export async function showCacheDiagnostics(): Promise<void> {
  const diagnostics = await diagnoseCacheState();

  const message = `
📦 CACHE DIAGNOSTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IndexedDB Databases (${diagnostics.indexedDBDatabases.length}):
${diagnostics.indexedDBDatabases.map((db) => `  • ${db}`).join("\n") || "  (none)"}

localStorage Keys (${diagnostics.localStorageKeys.length}):
${diagnostics.localStorageKeys
  .slice(0, 10)
  .map((key) => `  • ${key}`)
  .join("\n")}
${diagnostics.localStorageKeys.length > 10 ? `  ... and ${diagnostics.localStorageKeys.length - 10} more` : ""}

sessionStorage Keys (${diagnostics.sessionStorageKeys.length}):
${diagnostics.sessionStorageKeys.map((key) => `  • ${key}`).join("\n") || "  (none)"}

Cookies (${diagnostics.cookies.length}):
${diagnostics.cookies
  .slice(0, 10)
  .map((c) => `  • ${c}`)
  .join("\n")}
${diagnostics.cookies.length > 10 ? `  ... and ${diagnostics.cookies.length - 10} more` : ""}
  `.trim();

  alert(message);
}
