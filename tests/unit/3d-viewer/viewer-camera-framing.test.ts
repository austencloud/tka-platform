// @vitest-environment jsdom

import { BackgroundType } from "@austencloud/backgrounds";
import { describe, expect, it, vi } from "vitest";

import {
  computeViewerAlignedCamera,
  isValidViewerCameraPose,
  isValidViewerCameraSnapshot,
} from "$lib/shared/3d/camera/viewer-camera-framing";

function rect(
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("viewer camera framing", () => {
  it("uses the canonical front-stage fallback without a 2D canvas", () => {
    const camera = computeViewerAlignedCamera({
      environmentId: BackgroundType.OCEAN,
      fov: 50,
      document: null,
    });

    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0);
    expect(camera.position.z).toBeGreaterThan(1);
    expect(camera.target).toEqual({ x: 0, y: 0, z: 0.3 });
  });

  it("matches the 3D opening shot to the neighboring square Choreo card", () => {
    document.body.innerHTML = `
      <section class="animation-pane">
        <canvas></canvas>
      </section>
    `;
    const pane = document.querySelector(".animation-pane") as HTMLElement;
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(
      rect(100, 50, 800, 600)
    );
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      rect(200, 150, 500, 500)
    );

    const camera = computeViewerAlignedCamera({
      environmentId: BackgroundType.OCEAN,
      fov: 50,
      document,
    });

    expect(camera.position.z).toBeGreaterThan(1);
    expect(camera.position.y).not.toBe(0);
    expect(camera.target).toEqual({ x: 0, y: 0, z: 0.3 });
  });

  it("accepts only finite, controllable persisted poses", () => {
    expect(
      isValidViewerCameraPose(
        { x: 0, y: 2, z: 8 },
        { x: 0, y: 0, z: 0.3 },
        50
      )
    ).toBe(true);
    expect(
      isValidViewerCameraPose(
        { x: 0, y: 0, z: 0.5 },
        { x: 0, y: 0, z: 0 },
        50
      )
    ).toBe(false);
    expect(
      isValidViewerCameraSnapshot({
        position: { x: 0, y: 2, z: Number.POSITIVE_INFINITY },
        rotation: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0.3 },
        fov: 50,
        timestamp: 1,
      })
    ).toBe(false);
  });
});
