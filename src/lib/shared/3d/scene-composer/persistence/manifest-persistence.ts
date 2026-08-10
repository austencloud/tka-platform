import type { ComposerPlacement } from "../types";
import type { PlacementPersistence } from "./types";

export interface ComposerPlacementManifest {
  version: 1;
  coordinateFrame: "runtime-x-y-z-metres";
  placements: ComposerPlacement[];
}

export function serializeComposerPlacementManifest(
  placements: ComposerPlacement[]
): string {
  const manifest: ComposerPlacementManifest = {
    version: 1,
    coordinateFrame: "runtime-x-y-z-metres",
    placements,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export class ManifestPersistence implements PlacementPersistence {
  async save(sceneId: string, placements: ComposerPlacement[]): Promise<void> {
    const response = await fetch(`/__composer-placements/${sceneId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serializeComposerPlacementManifest(placements),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to write placement manifest: ${response.status} ${response.statusText}`
      );
    }
  }
}
