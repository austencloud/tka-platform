import type { FavoriteConfig, CommunityFavorite } from "../../domain/models/favorite-config";
import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export interface IFavoriteConfigRepository {
  getMyFavorite(userId: string): Promise<FavoriteConfig | null>;
  setMyFavorite(
    userId: string,
    config: UIGenerationConfig,
    startEndOptions?: StartEndOptions | null
  ): Promise<void>;
  clearMyFavorite(userId: string): Promise<void>;
  getCommunityFavorites(limit?: number): Promise<CommunityFavorite[]>;
}
