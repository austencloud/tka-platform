/**
 * Clear Firebase Cache Utility
 *
 * Clears all Firebase-related browser storage to fix authentication issues.
 * Use this when auth state is corrupted or sessions aren't persisting.
 */

/**
 * Clears all Firebase-related storage from the browser
 * This includes:
 * - IndexedDB databases (firebaseLocalStorage, firestore)
 * - localStorage keys (firebase:*)
 * - sessionStorage keys (firebase:*)
 */
export async function clearAllFirebaseCache(): Promise<void> {

  // ============================================================================
  // 1. Clear IndexedDB
  // ============================================================================
  try {
    if (!window.indexedDB.databases) {
      return;
    }
    const databases = await window.indexedDB.databases();

    for (const db of databases) {
      if (db.name) {
        // Delete Firebase and Firestore databases
        if (
          db.name.includes("firebase") ||
          db.name.includes("firestore") ||
          db.name.includes("the-kinetic")
        ) {
          const deleteRequest = window.indexedDB.deleteDatabase(db.name);

          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => {
              resolve(null);
            };
            deleteRequest.onerror = () => {
              reject(deleteRequest.error);
            };
            deleteRequest.onblocked = () => {
              // Resolve anyway - user may need to close tabs
              resolve(null);
            };
          }).catch(() => {
            // Continue with other databases
          });
        }
      }
    }
  } catch (error) {
    // IndexedDB listing failed
  }

  // ============================================================================
  // 2. Clear localStorage
  // ============================================================================
  try {
    const localStorageKeys = Object.keys(localStorage);

    const firebaseKeys = localStorageKeys.filter(
      (key) =>
        key.includes("firebase") ||
        key.includes("FIREBASE") ||
        key.includes("the-kinetic")
    );

    for (const key of firebaseKeys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    // localStorage clear failed
  }

  // ============================================================================
  // 3. Clear sessionStorage
  // ============================================================================
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);

    const firebaseKeys = sessionStorageKeys.filter(
      (key) =>
        key.includes("firebase") ||
        key.includes("FIREBASE") ||
        key.includes("the-kinetic")
    );

    for (const key of firebaseKeys) {
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    // sessionStorage clear failed
  }
}

/**
 * Clear cache and reload the page
 * Call this when auth state seems corrupted or stale
 */
export async function clearCacheAndReload(): Promise<void> {
  await clearAllFirebaseCache();
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}
