import type { ComposerPlacement } from "../types";

export interface PlacementPersistence {
	save(sceneId: string, placements: ComposerPlacement[]): Promise<void>;
}
