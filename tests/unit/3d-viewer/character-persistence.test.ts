import { afterEach, describe, expect, it } from "vitest";
import { Plane } from "@austencloud/scene-3d";

import { createViewer3DStateForTest } from "./viewer3d-test-helpers.svelte";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function makeState() {
  const result = createViewer3DStateForTest({ persistent: false });
  cleanups.push(result.dispose);
  return result.state;
}

describe("3D Studio character persistence", () => {
  it("serializes and restores the canonical characterId", () => {
    const source = makeState();
    source.performerManager.initialize();
    source.performerManager.performers[0]?.setCharacter("ch01");

    const config = source.serialize();
    expect(config.performers?.[0]?.characterId).toBe("ch01");

    const restored = makeState();
    restored.performerManager.initialize();
    restored.applyPersistConfig(config);
    expect(restored.performerManager.performers[0]?.characterId).toBe("ch01");
  });

  it("keeps older snapshots without a characterId loadable", () => {
    const state = makeState();
    state.performerManager.initialize();

    state.applyPersistConfig({
      performers: [
        {
          position: { x: 2, z: -1 },
          facingAngle: 0.5,
          customLeftPlane: Plane.WALL,
          customRightPlane: Plane.WALL,
        },
      ],
    });

    expect(state.performerManager.performers[0]?.position).toMatchObject({
      x: 2,
      z: -1,
    });
    expect(state.performerManager.performers[0]?.characterId).toBeTruthy();
  });
});
