/**
 * Creators Routing (Social module)
 *
 * Self-contained list<->profile routing for the Creators section, which lives
 * in the Social module (relocated from Browse, 2026-07-08). Owns the URL/history
 * sync so any host that mounts CreatorsPanel gets shareable, refresh-safe,
 * back/forward-correct creator profile deep links — with no help from the host.
 *
 * URL sync: a creator profile view is reflected as /social/creators/[userId] so
 * refreshing restores the profile and browser Back returns to the list. Legacy
 * /browse/creators/[userId] links are rewritten to /social/... at boot by the
 * navigation coordinator's parsePathNavigation redirect.
 *
 * The panel drives exactly one state singleton (creatorsViewState); nothing in
 * Browse touches it anymore, so there is no second host to fight the URL.
 */

import { browser } from "$app/environment";
import {
  pushState as svelteKitPushState,
  replaceState as svelteKitReplaceState,
} from "$app/navigation";
import type { ModuleId } from "$lib/shared/navigation/domain/types";
import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
import { creatorsViewState } from "./creators-view-state.svelte";

// The history-state payload the navigation coordinator's popstate handler reads
// to keep the module/section in sync as the user goes back/forward.
const CREATORS_HISTORY_STATE = {
  moduleId: "social",
  sectionId: "creators",
} as const;

/**
 * Read the creator ID from the current URL path.
 * Canonical form: /social/creators/[userId]. Also accepts the legacy
 * /browse/creators/[userId] form defensively, in case a link is followed before
 * the coordinator's boot redirect has rewritten the address bar. Returns null on
 * any other path (safe during SSR).
 */
export function getCreatorIdFromURL(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  // Expect: social|browse / creators / [userId]
  if (
    (parts[0] === "social" || parts[0] === "browse") &&
    parts[1] === "creators" &&
    parts[2]
  ) {
    return decodeURIComponent(parts[2]);
  }
  return null;
}

/** Whether the address bar currently sits under the creators section. */
function onCreatorsPath(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p.startsWith("/social/creators") || p.startsWith("/browse/creators");
}

/**
 * Push /social/creators/[userId] onto the history stack. Skips the push if the
 * URL already reflects this creator (e.g., a refresh-restore that re-derives the
 * profile from the URL should not add a duplicate entry).
 */
function pushCreatorProfileURL(userId: string): void {
  if (!browser) return;
  if (getCreatorIdFromURL() === userId && onCreatorsPath()) return;
  const url = new URL(window.location.href);
  url.pathname = `/social/creators/${encodeURIComponent(userId)}`;
  url.hash = "";
  svelteKitPushState(url.toString(), { ...CREATORS_HISTORY_STATE });
}

/**
 * Replace the current history entry with /social/creators (the list view).
 * Only acts when already in the creators subtree, so it never clobbers an
 * unrelated URL.
 */
function replaceCreatorsListURL(): void {
  if (!browser) return;
  if (!onCreatorsPath()) return;
  const url = new URL(window.location.href);
  url.pathname = "/social/creators";
  url.hash = "";
  svelteKitReplaceState(url.toString(), { ...CREATORS_HISTORY_STATE });
}

/**
 * Open a creator's profile from anywhere in the app.
 *
 * - If we are not already on Social > Creators (a cross-module jump from a
 *   collection card, the sequence viewer, an inbox notification), switch there
 *   first with skipHistory so the coordinator does not push its own
 *   /social/creators list entry that would clobber the profile URL below.
 * - Then set the view state and push /social/creators/[userId]. The mounted
 *   panel renders UserProfilePanel reactively; a later mount re-derives the same
 *   profile from the URL, so both entry paths converge.
 */
export async function openCreatorProfile(
  userId: string,
  _displayName?: string
): Promise<void> {
  const onCreators =
    navigationState.currentModule === "social" &&
    navigationState.activeTab === "creators";
  if (!onCreators) {
    await handleModuleChange("social" as ModuleId, "creators", {
      skipHistory: true,
    });
  }
  creatorsViewState.viewUserProfile(userId);
  pushCreatorProfileURL(userId);
}

/**
 * Return from a profile to the creators list (the profile's in-page Back
 * button). Resets the view state and replaces the URL in place, so it is always
 * safe (never navigates the browser out of the app). The browser Back button
 * still walks the full pushed history, including profile -> profile.
 */
export function backToCreatorsList(): void {
  creatorsViewState.reset();
  replaceCreatorsListURL();
}

/**
 * Boot / mount: derive the view state from the URL. A /social/creators/[id] deep
 * link (fresh load, refresh, or a redirected legacy /browse link) opens that
 * profile; the plain list URL resets to the list. Makes mount idempotent with
 * whatever openCreatorProfile already set.
 */
export function restoreCreatorProfileFromURL(): void {
  const id = getCreatorIdFromURL();
  if (id) {
    creatorsViewState.viewUserProfile(id);
  } else {
    creatorsViewState.reset();
  }
}

/**
 * Browser Back/Forward within the creators subtree. The URL changed already;
 * mirror the view state to it. Handles list <-> profile and profile -> profile.
 */
export function syncCreatorsViewFromURL(): void {
  const id = getCreatorIdFromURL();
  if (id) {
    if (creatorsViewState.viewingUserId !== id) {
      creatorsViewState.viewUserProfile(id);
    }
  } else if (onCreatorsPath()) {
    if (creatorsViewState.currentView !== "list") {
      creatorsViewState.reset();
    }
  }
}
