import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The scene package's `PerformerRig` still publishes its effects snippet
 * payload under the historical blue/red names. Viewer3DScene renames them at
 * the seam so `EffectOrchestrator3D` receives real prop states. Destructuring
 * the app-side left/right names directly leaves both `undefined`, which
 * disables every 3D effect for every viewer host without a single error.
 */
const RIG = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/dist/lib/components/PerformerRig.svelte"
  ),
  "utf8"
);
const SCENE = readFileSync(
  resolve("src/lib/shared/3d/components/Viewer3DScene.svelte"),
  "utf8"
);

function effectsSlotPayloadKeys(source: string): string[] {
  const match = source.match(
    /effectsSlot\?: Snippet<\s*\[\s*\{([\s\S]*?)\},?\s*\]\s*>/
  );
  if (!match) throw new Error("PerformerRig effectsSlot type not found");
  return [...match[1].matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1]);
}

function sceneSnippetParams(source: string): string {
  const match = source.match(/\{#snippet effectsSlot\(\{([\s\S]*?)\}\)\}/);
  if (!match) throw new Error("Viewer3DScene effectsSlot snippet not found");
  return match[1];
}

describe("Viewer3DScene effectsSlot payload contract", () => {
  const rigKeys = effectsSlotPayloadKeys(RIG);
  const params = sceneSnippetParams(SCENE);

  it("PerformerRig publishes prop state under blue/red names", () => {
    expect(rigKeys).toEqual(
      expect.arrayContaining([
        "bluePropState",
        "redPropState",
        "blueHandPos",
        "redHandPos",
      ])
    );
  });

  it("renames every rig payload key it consumes from the rig's own names", () => {
    const consumed = [...params.matchAll(/(\w+)\s*(?::\s*(\w+))?\s*(?:,|$)/gm)]
      .map((m) => m[1])
      .filter(Boolean);
    for (const key of consumed) {
      expect(rigKeys, `"${key}" is not a PerformerRig effectsSlot key`).toContain(
        key
      );
    }
  });

  it("feeds the orchestrator left/right prop states from the blue/red payload", () => {
    expect(params).toMatch(/bluePropState\s*:\s*leftPropState/);
    expect(params).toMatch(/redPropState\s*:\s*rightPropState/);
    expect(params).toMatch(/blueHandPos\s*:\s*leftHandPos/);
    expect(params).toMatch(/redHandPos\s*:\s*rightHandPos/);
  });
});
