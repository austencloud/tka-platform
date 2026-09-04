import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { warmWorkerRenderer } from "$lib/shared/3d/worker-renderer/services/worker-renderer-warmup";
import { primeWorkerRenderer } from "$lib/shared/3d/worker-renderer/services/worker-renderer-warmup";

describe("worker renderer warm-up", () => {
  it("prepares one distinct program per turn so the visible worker keeps drawing", async () => {
    const scene = new Scene();
    const shared = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const duplicate = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const distinct = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    scene.add(shared, duplicate, distinct);
    const compileAsync = vi.fn(async () => undefined);
    const yieldBetween = vi.fn(async () => undefined);
    const progress: number[] = [];

    const metrics = await warmWorkerRenderer(
      {
        renderer: { compileAsync } as never,
        scene,
        camera: {} as never,
      },
      {
        yieldBetween,
        onProgress: (fraction) => progress.push(fraction),
      }
    );

    expect(compileAsync).toHaveBeenCalledTimes(2);
    expect(compileAsync.mock.calls.map(([target]) => target)).toEqual([
      shared,
      distinct,
    ]);
    expect(yieldBetween).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([0.5, 1]);
    expect(metrics.map(({ label }) => label)).toEqual([
      "MeshBasicMaterial",
      "MeshStandardMaterial",
    ]);
    expect(metrics.every(({ durationMs }) => durationMs >= 0)).toBe(true);
  });

  it("restores a hidden target after its program is prepared", async () => {
    const scene = new Scene();
    const hidden = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    hidden.visible = false;
    scene.add(hidden);

    await warmWorkerRenderer({
      renderer: { compileAsync: vi.fn(async () => undefined) } as never,
      scene,
      camera: {} as never,
    });

    expect(hidden.visible).toBe(false);
  });

  it("primes one visible renderable per turn and restores the complete scene", async () => {
    const scene = new Scene();
    const first = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const second = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    first.name = "first";
    second.name = "second";
    scene.add(first, second);
    const visiblePerDraw: string[][] = [];
    const render = vi.fn(() => {
      const visible: string[] = [];
      scene.traverseVisible((object) => {
        if ((object as Mesh).isMesh) visible.push(object.name);
      });
      visiblePerDraw.push(visible);
    });
    const yieldBetween = vi.fn(async () => undefined);

    const count = await primeWorkerRenderer(
      {
        renderer: { render } as never,
        scene,
        camera: {} as never,
      },
      { yieldBetween }
    );

    expect(count).toBe(2);
    expect(visiblePerDraw).toEqual([["first"], ["second"]]);
    expect(yieldBetween).toHaveBeenCalledTimes(1);
    expect(first.visible).toBe(true);
    expect(second.visible).toBe(true);
  });
});
