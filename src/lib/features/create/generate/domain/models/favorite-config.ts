import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export interface FavoriteConfig {
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  setAt: Date;
}

export interface CommunityFavorite {
  userId: string;
  displayName: string;
  avatar?: string;
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  setAt: Date;
}
