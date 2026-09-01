import { describe, expect, it } from "vitest";
import mushroomLayout from "../../../../../../../../../scripts/autumn-mushroom-layout.json";
import { AUTUMN_MAGIC_HABITATS } from "./autumn-magic-habitat-layout";

describe("Autumn magic habitat layout", () => {
  it("derives every runtime target from the Blender-authored mushroom source", () => {
    const authored = [
      mushroomLayout.fairyChampignonArc,
      ...mushroomLayout.amethystDeceiverDrifts,
      ...mushroomLayout.honeyFungusColonies,
    ];

    expect(AUTUMN_MAGIC_HABITATS).toHaveLength(authored.length);
    expect(AUTUMN_MAGIC_HABITATS).toEqual(
      authored.map((habitat) => ({
        id: habitat.id,
        position: [habitat.center[0], -habitat.center[1]],
        radius: habitat.auraRadius,
        color: habitat.auraColor,
      }))
    );
  });
});
