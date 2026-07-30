import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";

export interface FavoriteConfig {
  sourceSetupId?: string;
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

export interface SavedGeneratorSetup {
  id: string;
  name: string;
  config: UIGenerationConfig;
  startEndOptions: StartEndOptions | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedGeneratorFavorite {
  sourceSetupId: string;
  config: UIGenerationConfig;
  startEndOptions: StartEndOptions | null;
  setAt: Date;
}

export interface SavedSetupDraft {
  name: string;
  config: UIGenerationConfig;
  startEndOptions: StartEndOptions | null;
}

export interface PersonalSetupSnapshot {
  setups: SavedGeneratorSetup[];
  sharedSetupId: string | null;
}

export type ActiveSetupSource =
  | { kind: "setup"; setupId: string }
  | { kind: "community"; userId: string };

export type PendingSetupAction =
  | { kind: "create" }
  | {
      kind: "rename" | "update" | "share" | "delete";
      setupId: string;
    }
  | { kind: "unshare" };
