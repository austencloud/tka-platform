import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CameraStateSnapshot } from "@austencloud/scene-3d";
import { createPersistentViewerStateForTest } from "./viewer3d-camera-persistence-test-helper.svelte";

const CAMERA_KEY = "tka-viewer3d-camera";
const cameraSource = readFileSync(
  resolve("src/lib/shared/3d/components/Viewer3DCamera.svelte"),
  "utf8"
);
const stateSource = readFileSync(
  resolve("src/lib/shared/3d/state/viewer-3d-state.svelte.ts"),
  "utf8"
);

const disposals: Array<() => void> = [];

function makePersistentState() {
  const { state, dispose } = createPersistentViewerStateForTest();
  disposals.push(dispose);
  return state;
}

afterEach(() => {
  while (disposals.length) disposals.pop()!();
  localStorage.removeItem(CAMERA_KEY);
});

describe("Viewer 3D camera persistence", () => {
  it("round-trips the exact camera pose through the shared viewer state", () => {
    const pose: CameraStateSnapshot = {
      position: { x: -3.125, y: 4.75, z: 8.875 },
      rotation: { x: -0.375, y: 0.625, z: 0.125 },
      fov: 47.5,
      target: { x: 1.25, y: 0.875, z: -2.5 },
      timestamp: 123456,
    };

    makePersistentState().updateCameraSnapshot(pose);
    expect(JSON.parse(localStorage.getItem(CAMERA_KEY) ?? "null")).toEqual(
      pose
    );

    const restored = makePersistentState();
    expect(restored.persistedCamera).toEqual(pose);
  });

  it("captures movement and flushes the live pose at every teardown boundary", () => {
    expect(cameraSource).toContain("onchange={(c) => scheduleCameraSave(c)}");
    expect(cameraSource).toContain(
      'window.addEventListener("pagehide", onPageHide)'
    );
    expect(cameraSource).toContain("flushCameraSave(controlsInstance)");
    expect(cameraSource).toContain(
      "viewer3DState.updateCameraSnapshot(pendingSnapshot)"
    );
    expect(stateSource).toContain(
      "if (!_hasPlayedWelcome && !_persistedCamera)"
    );
  });
});
