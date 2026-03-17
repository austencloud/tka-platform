/**
 * Offline Cache Context
 *
 * Set once in browse module root, consumed by any descendant
 * that needs offline cache status.
 */

import { getContext, setContext } from "svelte";
import type { OfflineCacheState } from "../state/offline-cache-state.svelte";

const OFFLINE_CACHE_KEY = Symbol("offline-cache");

export function setOfflineCacheContext(state: OfflineCacheState): void {
  setContext(OFFLINE_CACHE_KEY, state);
}

export function getOfflineCacheContext(): OfflineCacheState {
  return getContext<OfflineCacheState>(OFFLINE_CACHE_KEY);
}
