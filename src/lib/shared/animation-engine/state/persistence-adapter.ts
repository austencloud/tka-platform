/** Where a scope's settings live. */
export type PersistenceMode = "ephemeral" | "local" | "account";

/**
 * A scope holds state and emits debounced deltas; the adapter decides what is
 * persisted. This is the seam that makes "landing = ephemeral, app = local,
 * user = account" a one-line construction choice rather than scattered behavior.
 */
export interface PersistenceAdapter {
  /** Seed values on scope construction (incl. any migration). Null = use defaults. */
  load(): Record<string, unknown> | null;
  /** Persist a partial change. Implementations debounce as needed. */
  save(delta: Record<string, unknown>): void;
}

/** Nothing persists. Landing, thumbnails, embedded previews. */
export const ephemeralAdapter: PersistenceAdapter = {
  load: () => null,
  save: () => {},
};

/** Backing-store adapter used by tests and as the base for localStorage. */
export function createMemoryAdapter(
  store: Record<string, unknown>,
): PersistenceAdapter {
  return {
    load: () => ({ ...store }),
    save: (delta) => Object.assign(store, delta),
  };
}

/** Persists to a localStorage key. App default. */
export function createLocalStorageAdapter(key: string): PersistenceAdapter {
  return {
    load: () => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    },
    save: (delta) => {
      try {
        const raw = localStorage.getItem(key);
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem(key, JSON.stringify({ ...current, ...delta }));
      } catch {
        /* ignore quota / serialization errors */
      }
    },
  };
}

/**
 * Account (Firestore-synced) adapter. CONTRACT ONLY for this build — see the
 * follow-up account-sync spec. Falls back to no persistence so it is safe to
 * construct before the implementation exists.
 */
export function createAccountAdapter(_userId: string): PersistenceAdapter {
  // TODO(account-sync spec): Firestore load/save with conflict policy.
  return ephemeralAdapter;
}
