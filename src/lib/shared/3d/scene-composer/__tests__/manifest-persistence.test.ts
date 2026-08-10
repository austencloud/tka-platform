import { describe, expect, it } from "vitest";
import { serializeComposerPlacementManifest } from "../persistence/manifest-persistence";
import type { ComposerPlacement } from "../types";

describe("serializeComposerPlacementManifest", () => {
  it("round-trips stable IDs and complete native transforms", () => {
    const placements: ComposerPlacement[] = [
      {
        id: "winter:conifer:winter-base-near-middle-fir-000",
        objectKey: "conifer",
        position: [12.5, -0.4, -8.25],
        rotation: [0, 0.3827, 0, 0.9239],
        scale: [1.1, 0.9, 1.1],
        source: "native",
        visible: false,
      },
    ];

    const manifest = JSON.parse(serializeComposerPlacementManifest(placements));

    expect(manifest).toEqual({
      version: 1,
      coordinateFrame: "runtime-x-y-z-metres",
      placements,
    });
  });
});
