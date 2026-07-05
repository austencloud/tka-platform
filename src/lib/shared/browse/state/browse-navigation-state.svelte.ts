/**
 * Browse Navigation State
 *
 * Unified, persistent navigation state for the Browse module.
 * Handles all navigation within Gallery, Collections, and Creators tabs
 * with full back/forward support and localStorage persistence.
 *
 * URL sync: creator profile views are reflected in the URL as
 * /browse/creators/[userId] so refreshing the page restores the profile.
 */

import { browser } from "$app/environment";
import {
  pushState as svelteKitPushState,
  replaceState as svelteKitReplaceState,
} from "$app/navigation";

// Tab types matching the Browse module structure
export type BrowseTab = "gallery" | "collections" | "creators";
export type BrowseView = "list" | "detail" | "profile";

/**
 * Represents a location within the Browse module
 */
export interface BrowseLocation {
  tab: BrowseTab;
  view: BrowseView;
  contextId?: string; // userId, collectionId, sequenceId
  filter?: {
    // For filtered views (e.g., creator's sequences)
    type: string;
    value: string;
    displayName?: string; // For UI display
  };
}

interface BrowseNavigationStateData {
  history: BrowseLocation[];
  currentIndex: number;
}

const STORAGE_KEY = "tka-browse-nav-state";
const MAX_HISTORY_SIZE = 50;

// ============================================================================
// URL Sync Helpers
// ============================================================================

/**
 * Read the creator ID from the current URL path.
 * Expects paths like /browse/creators/[userId] - returns userId or null.
 * Safe to call on non-creators paths (returns null).
 */
export function getCreatorIdFromURL(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  // Expect: browse / creators / [userId]
  if (parts[0] === "browse" && parts[1] === "creators" && parts[2]) {
    return decodeURIComponent(parts[2]);
  }
  return null;
}

/**
 * A collection deep link: /browse/collections/[collectionId], optionally with
 * ?scan=1. This is the URL a phone lands on after scanning the desktop scan
 * sheet's handoff QR — it opens that collection, and the scan flag asks the
 * detail view to open the card scanner immediately.
 */
export interface CollectionScanTarget {
  collectionId: string;
  scan: boolean;
}

/**
 * Read a collection deep link from the current URL. Returns null on any other
 * path. Safe to call anywhere (returns null during SSR).
 */
export function getCollectionScanTargetFromURL(): CollectionScanTarget | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  // Expect: browse / collections / [collectionId]
  if (parts[0] === "browse" && parts[1] === "collections" && parts[2]) {
    const scan =
      new URLSearchParams(window.location.search).get("scan") === "1";
    return { collectionId: decodeURIComponent(parts[2]), scan };
  }
  return null;
}

/**
 * Push /browse/creators/[userId] into the browser history stack.
 * Skips the push if the URL already reflects this creator (e.g., on initial load).
 */
function pushCreatorProfileURL(userId: string): void {
  if (!browser) return;
  // If the URL already points at this creator, don't duplicate the history entry.
  const existingId = getCreatorIdFromURL();
  if (existingId === userId) return;
  const url = new URL(window.location.href);
  url.pathname = `/browse/creators/${encodeURIComponent(userId)}`;
  url.hash = "";
  svelteKitPushState(url.toString(), {
    moduleId: "browse",
    sectionId: "creators",
  });
}

/**
 * Replace the current history entry with /browse/creators (the list view).
 * Called when navigating back to the creators list so the URL reflects the view.
 */
function replaceCreatorsListURL(): void {
  if (!browser) return;
  const url = new URL(window.location.href);
  // Only act when we're already in the creators subtree
  if (!url.pathname.startsWith("/browse/creators")) return;
  url.pathname = "/browse/creators";
  url.hash = "";
  svelteKitReplaceState(url.toString(), {
    moduleId: "browse",
    sectionId: "creators",
  });
}

/**
 * Check if two locations are equivalent (to prevent duplicate entries)
 */
function locationsEqual(a: BrowseLocation, b: BrowseLocation): boolean {
  return (
    a.tab === b.tab &&
    a.view === b.view &&
    a.contextId === b.contextId &&
    a.filter?.type === b.filter?.type &&
    a.filter?.value === b.filter?.value
  );
}

function createBrowseNavigationState() {
  // Initialize with default state
  const state = $state<BrowseNavigationStateData>({
    history: [],
    currentIndex: -1,
  });

  // Flag to prevent pushing during restore or programmatic navigation
  let isNavigating = $state(false);

  // Derived values
  const canGoBack = $derived(state.currentIndex > 0);
  const canGoForward = $derived(state.currentIndex < state.history.length - 1);
  const currentLocation = $derived<BrowseLocation | null>(
    state.currentIndex >= 0 && state.currentIndex < state.history.length
      ? (state.history[state.currentIndex] ?? null)
      : null
  );

  /**
   * Persist state to localStorage
   */
  function persistState() {
    try {
      const data: BrowseNavigationStateData = {
        history: state.history,
        currentIndex: state.currentIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("[BrowseNav] Failed to persist state:", error);
    }
  }

  /**
   * Restore state from localStorage
   */
  function restoreState(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      const data = JSON.parse(stored) as BrowseNavigationStateData;
      if (
        data.history &&
        Array.isArray(data.history) &&
        data.history.length > 0
      ) {
        state.history = data.history;
        state.currentIndex = Math.min(
          data.currentIndex,
          data.history.length - 1
        );
        return true;
      }
    } catch (error) {
      console.warn("[BrowseNav] Failed to restore state:", error);
    }
    return false;
  }

  return {
    // Getters
    get canGoBack() {
      return canGoBack;
    },
    get canGoForward() {
      return canGoForward;
    },
    get currentLocation() {
      return currentLocation;
    },
    get historyLength() {
      return state.history.length;
    },
    get isNavigating() {
      return isNavigating;
    },

    /**
     * Navigate to a new location (pushes to history)
     */
    navigateTo(location: BrowseLocation) {
      // Don't push duplicate consecutive entries
      const current = state.history[state.currentIndex];
      if (current && locationsEqual(current, location)) {
        return;
      }

      // Clear forward history when navigating to new location
      const newHistory = state.history.slice(0, state.currentIndex + 1);
      newHistory.push(location);

      // Trim if exceeded max size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        state.history = newHistory;
        state.currentIndex = newHistory.length - 1;
      } else {
        state.history = newHistory;
        state.currentIndex = newHistory.length - 1;
      }

      persistState();
    },

    /**
     * Go back in history.
     * Returns the location navigated to, or null if can't go back.
     * Also updates the browser URL to reflect the destination view.
     */
    goBack(): BrowseLocation | null {
      if (state.currentIndex <= 0) return null;

      isNavigating = true;
      state.currentIndex--;
      const location = state.history[state.currentIndex];
      persistState();

      // Sync URL with the destination view
      if (location) {
        if (location.tab === "creators" && location.view === "profile" && location.contextId) {
          pushCreatorProfileURL(location.contextId);
        } else if (location.tab === "creators" && location.view === "list") {
          replaceCreatorsListURL();
        }
      }

      // Reset flag after a tick
      setTimeout(() => {
        isNavigating = false;
      }, 0);

      return location ?? null;
    },

    /**
     * Go forward in history
     * Returns the location navigated to, or null if can't go forward
     */
    goForward(): BrowseLocation | null {
      if (state.currentIndex >= state.history.length - 1) return null;

      isNavigating = true;
      state.currentIndex++;
      const location = state.history[state.currentIndex];
      persistState();

      // Reset flag after a tick
      setTimeout(() => {
        isNavigating = false;
      }, 0);

      return location ?? null;
    },

    /**
     * Replace current location without adding to history
     * Useful for updating view state without creating new history entry
     */
    replace(location: BrowseLocation) {
      if (state.currentIndex >= 0) {
        state.history[state.currentIndex] = location;
        persistState();
      } else {
        this.navigateTo(location);
      }
    },

    // ========================================================================
    // Convenience Navigation Methods
    // ========================================================================

    /**
     * Navigate to a creator's profile.
     * Also updates the browser URL to /browse/creators/[userId] so the
     * profile survives a page refresh.
     */
    viewCreatorProfile(userId: string, displayName?: string) {
      this.navigateTo({
        tab: "creators",
        view: "profile",
        contextId: userId,
        filter: displayName
          ? { type: "displayName", value: displayName }
          : undefined,
      });
      pushCreatorProfileURL(userId);
    },

    /**
     * Navigate to collection detail view
     */
    viewCollectionDetail(collectionId: string, collectionName?: string) {
      this.navigateTo({
        tab: "collections",
        view: "detail",
        contextId: collectionId,
        filter: collectionName
          ? { type: "collectionName", value: collectionName }
          : undefined,
      });
    },

    /**
     * Navigate to sequence detail view
     */
    viewSequenceDetail(sequenceId: string) {
      this.navigateTo({
        tab: "gallery",
        view: "detail",
        contextId: sequenceId,
      });
    },

    /**
     * Navigate to gallery filtered by creator's sequences
     */
    viewCreatorSequences(userId: string, displayName?: string) {
      this.navigateTo({
        tab: "gallery",
        view: "list",
        filter: {
          type: "creator",
          value: userId,
          displayName: displayName,
        },
      });
    },

    /**
     * Navigate to gallery list view (default)
     */
    viewGallery() {
      this.navigateTo({
        tab: "gallery",
        view: "list",
      });
    },

    /**
     * Navigate to collections list view
     */
    viewCollections() {
      this.navigateTo({
        tab: "collections",
        view: "list",
      });
    },

    /**
     * Navigate to creators list view.
     * Restores the URL to /browse/creators when leaving a profile.
     */
    viewCreators() {
      this.navigateTo({
        tab: "creators",
        view: "list",
      });
      replaceCreatorsListURL();
    },

    // ========================================================================
    // Lifecycle Methods
    // ========================================================================

    /**
     * Initialize state - call on module mount
     * Restores from localStorage or initializes with default location
     */
    initialize(defaultTab: BrowseTab = "gallery") {
      const restored = restoreState();
      if (!restored) {
        // Initialize with default location
        this.navigateTo({
          tab: defaultTab,
          view: "list",
        });
      }
    },

    /**
     * Clear all history
     */
    clearHistory() {
      state.history = [];
      state.currentIndex = -1;
      localStorage.removeItem(STORAGE_KEY);
    },

    /**
     * Set navigating flag (for external coordination)
     */
    setNavigating(value: boolean) {
      isNavigating = value;
    },
  };
}

// Export singleton instance
export const browseNavigationState = createBrowseNavigationState();
