import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const loaderMock = vi.hoisted(() => ({
  loadAsync: vi.fn(),
}));

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("three/examples/jsm/loaders/GLTFLoader.js")
    >();
  return {
    ...original,
    GLTFLoader: class {
      loadAsync(url: string): Promise<GLTF> {
        return loaderMock.loadAsync(url);
      }
    },
  };
});

import {
  checkSharedAssetAvailability,
  clearSharedGltfCache,
  cloneSharedSkinnedScene,
  loadSharedAnimation,
  loadSharedGltf,
  prepareSharedGltf,
  schedulePerformerInitialization,
  schedulePerformerMount,
} from "../../node_modules/@austencloud/scene-3d/src/lib/services/shared-gltf-cache";

function createGltf(): GLTF {
  return {
    animations: [],
    asset: { version: "2.0" },
    cameras: [],
    parser: {},
    scene: new Group(),
    scenes: [],
    userData: {},
  } as unknown as GLTF;
}

describe("shared GLTF cache", () => {
  beforeEach(() => {
    clearSharedGltfCache();
    loaderMock.loadAsync.mockReset();
  });

  it("deduplicates concurrent parses of the same asset URL", async () => {
    const gltf = createGltf();
    let resolveLoad: ((value: GLTF) => void) | undefined;
    const pending = new Promise<GLTF>((resolve) => {
      resolveLoad = resolve;
    });
    loaderMock.loadAsync.mockReturnValue(pending);

    const first = loadSharedGltf("/models/x-bot.glb");
    const second = loadSharedGltf("/models/x-bot.glb");

    expect(second).toBe(first);
    expect(loaderMock.loadAsync).toHaveBeenCalledTimes(1);

    resolveLoad?.(gltf);
    await expect(first).resolves.toBe(gltf);
  });

  it("evicts a failed parse so the next performer can retry", async () => {
    const gltf = createGltf();
    loaderMock.loadAsync
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(gltf);

    await expect(loadSharedGltf("/models/x-bot.glb")).rejects.toThrow(
      "temporary failure"
    );
    await expect(loadSharedGltf("/models/x-bot.glb")).resolves.toBe(gltf);
    expect(loaderMock.loadAsync).toHaveBeenCalledTimes(2);
  });

  it("warms the same parsed avatar used by later performer clones", async () => {
    const gltf = createGltf();
    loaderMock.loadAsync.mockResolvedValue(gltf);

    await expect(
      prepareSharedGltf("/models/x-bot.glb")
    ).resolves.toBeUndefined();
    await expect(loadSharedGltf("/models/x-bot.glb")).resolves.toBe(gltf);
    expect(loaderMock.loadAsync).toHaveBeenCalledTimes(1);
  });

  it("retains only a shared clip for animation assets", async () => {
    const clip = new AnimationClip("idle", 1, []);
    loaderMock.loadAsync.mockResolvedValue({
      ...createGltf(),
      animations: [clip],
    });

    const first = loadSharedAnimation("/animations/idle.glb");
    const second = loadSharedAnimation("/animations/idle.glb");

    expect(second).toBe(first);
    await expect(first).resolves.toBe(clip);
    expect(loaderMock.loadAsync).toHaveBeenCalledTimes(1);
  });

  it("deduplicates optional animation availability probes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-type": "model/gltf-binary" },
      })
    );

    const first = checkSharedAssetAvailability("/animations/turn-left-90.glb");
    const second = checkSharedAssetAvailability("/animations/turn-left-90.glb");

    expect(second).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/animations/turn-left-90.glb", {
      method: "HEAD",
    });

    fetchMock.mockRestore();
  });

  it("serializes performer initialization across animation frames", async () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    const frameMock = vi.fn((callback: FrameRequestCallback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    vi.stubGlobal("requestAnimationFrame", frameMock);
    const order: string[] = [];

    const first = schedulePerformerInitialization(async () => {
      order.push("first");
      return 1;
    });
    const second = schedulePerformerInitialization(async () => {
      order.push("second");
      return 2;
    });

    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(0);
    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(16);
    await expect(first).resolves.toBe(1);
    expect(order).toEqual(["first"]);

    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(32);
    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(48);
    await expect(second).resolves.toBe(2);
    expect(order).toEqual(["first", "second"]);

    vi.unstubAllGlobals();
  });

  it("paints between expensive performer subtree mounts", async () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    const frameMock = vi.fn((callback: FrameRequestCallback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    vi.stubGlobal("requestAnimationFrame", frameMock);
    const order: string[] = [];

    const first = schedulePerformerMount(() => order.push("avatar"));
    const second = schedulePerformerMount(() => order.push("props"));

    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(0);
    expect(order).toEqual([]);

    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(16);
    await expect(first).resolves.toBeUndefined();
    expect(order).toEqual(["avatar"]);

    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(32);
    expect(order).toEqual(["avatar"]);

    await vi.waitFor(() => expect(scheduledFrames).toHaveLength(1));
    scheduledFrames.shift()?.(48);
    await expect(second).resolves.toBeUndefined();
    expect(order).toEqual(["avatar", "props"]);

    vi.unstubAllGlobals();
  });

  it("shares geometry but gives each performer mutable material state", () => {
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial({ color: "white" });
    const source = new Group();
    source.add(new Mesh(geometry, material));

    const cloned = cloneSharedSkinnedScene(source);
    const clonedMesh = cloned.children[0] as Mesh;

    expect(clonedMesh.geometry).toBe(geometry);
    expect(clonedMesh.material).not.toBe(material);

    (clonedMesh.material as MeshBasicMaterial).dispose();
    material.dispose();
    geometry.dispose();
  });
});
