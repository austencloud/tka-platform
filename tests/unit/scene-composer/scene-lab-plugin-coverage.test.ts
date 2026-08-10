import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SCENE_OPTIONS } from "$lib/features/lab/tabs/scene-lab/domain/scene-lab-types";
import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
import "$lib/shared/3d/scene-composer/register-scene-lab-composer-plugins";

describe("Scene Lab composer coverage", () => {
  it("registers every Scene Lab scene exactly once", () => {
    const expected = SCENE_OPTIONS.map((option) => option.id).sort();
    const actual = composerRegistry.composableSceneIds().sort();

    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
  });

  it("uses catalog model paths that exist on disk", () => {
    for (const plugin of composerRegistry.list()) {
      for (const item of plugin.catalog.allItems()) {
        if (!item.modelPath) continue;
        expect(
          existsSync(resolve("static", item.modelPath.replace(/^\//, ""))),
          `${plugin.sceneId}/${item.key}: ${item.modelPath}`
        ).toBe(true);
      }
    }
  });

  it("resolves every saved placement to a current catalog item", () => {
    for (const plugin of composerRegistry.list()) {
      for (const placement of plugin.getDefaults()) {
        if (placement.source === "native") continue;
        expect(
          plugin.catalog.getDefinition(placement.objectKey),
          `${plugin.sceneId}/${placement.id}: ${placement.objectKey}`
        ).toBeDefined();
      }
    }
  });
});
