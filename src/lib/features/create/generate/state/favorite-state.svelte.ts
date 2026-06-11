/**
 * Favorite state management for GeneratePanel
 *
 * Firebase-backed: each user has one favorite config.
 * Also loads community favorites for browsing.
 */

import {
  getMyFavorite,
  setMyFavorite,
  clearMyFavorite as clearMyFavoriteInDb,
  getCommunityFavorites,
} from "../services/favorite-config-repository";
import { getEffectiveUserId } from "$lib/shared/auth/state/auth-state.svelte";
import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import type { FavoriteConfig, CommunityFavorite } from "../domain/models/favorite-config";
import type { UIGenerationConfig } from "./generate-config.svelte";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";

export function createFavoriteState() {
  let myFavorite = $state<FavoriteConfig | null>(null);
  let communityFavorites = $state<CommunityFavorite[]>([]);
  let isLoading = $state(true);
  let activeFavoriteId = $state<string | null>(null);

  // "mine" = user's own favorite, any other string = a community user's ID
  const activeFavorite = $derived<FavoriteConfig | CommunityFavorite | null>(
    activeFavoriteId === "mine"
      ? myFavorite
      : activeFavoriteId
        ? communityFavorites.find((f) => f.userId === activeFavoriteId) ?? null
        : null
  );

  const hasMyFavorite = $derived(myFavorite !== null);

  // Load on creation
  loadFavorites();

  async function loadFavorites() {
    const userId = getEffectiveUserId();
    if (!userId) {
      isLoading = false;
      return;
    }

    try {
      const [myFav, community] = await Promise.all([
        getMyFavorite(userId),
        getCommunityFavorites(20),
      ]);

      myFavorite = myFav;
      // Filter out own favorite from community list
      communityFavorites = community.filter((f) => f.userId !== userId);
    } catch (error) {
      console.error("[FavoriteState] Error loading favorites:", error);
    } finally {
      isLoading = false;
    }
  }

  async function saveMyFavorite(
    config: UIGenerationConfig,
    startEndOptions?: StartEndOptions | null
  ): Promise<void> {
    const userId = getEffectiveUserId();
    if (!userId) return;

    try {
      await setMyFavorite(userId, config, startEndOptions);
      myFavorite = { config, startEndOptions: startEndOptions ?? null, setAt: new Date() };
    } catch (error) {
      console.error("[FavoriteState] Error saving favorite:", error);
      getErrorHandler().showUserError({
        message: "Couldn't save your favorite",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "create",
          tab: "generate",
          action: "saveMyFavorite",
        },
      });
    }
  }

  async function clearMyFavorite(): Promise<void> {
    const userId = getEffectiveUserId();
    if (!userId) return;

    try {
      await clearMyFavoriteInDb(userId);
      myFavorite = null;
      if (activeFavoriteId === "mine") {
        activeFavoriteId = null;
      }
    } catch (error) {
      console.error("[FavoriteState] Error clearing favorite:", error);
      getErrorHandler().showUserError({
        message: "Couldn't remove your favorite",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "create",
          tab: "generate",
          action: "clearMyFavorite",
        },
      });
    }
  }

  function activateFavorite(id: string): void {
    activeFavoriteId = id;
  }

  function deactivateFavorite(): void {
    activeFavoriteId = null;
  }

  return {
    get myFavorite() { return myFavorite; },
    get communityFavorites() { return communityFavorites; },
    get isLoading() { return isLoading; },
    get activeFavoriteId() { return activeFavoriteId; },
    get activeFavorite() { return activeFavorite; },
    get hasMyFavorite() { return hasMyFavorite; },

    loadFavorites,
    saveMyFavorite,
    clearMyFavorite,
    activateFavorite,
    deactivateFavorite,
  };
}
