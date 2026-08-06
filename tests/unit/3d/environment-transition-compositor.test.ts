import { describe, expect, it, vi } from "vitest";
import { Color, Fog, Group, PerspectiveCamera, Scene } from "three";

import {
  BASE_SCENE_LAYER,
  EnvironmentTransitionCompositor,
  PROTECTED_PERFORMER_LAYER,
  protectPerformerTree,
} from "$lib/shared/3d/environments/rendering/environment-transition-compositor";

describe("environment transition compositor", () => {
  it("adds declarative and imperative performer descendants to both passes", () => {
    const root = new Group();
    const declarativeChild = new Group();
    const imperativeEffect = new Group();
    declarativeChild.add(imperativeEffect);
    root.add(declarativeChild);

    protectPerformerTree(root);

    for (const object of [root, declarativeChild, imperativeEffect]) {
      expect(object.layers.isEnabled(BASE_SCENE_LAYER)).toBe(true);
      expect(object.layers.isEnabled(PROTECTED_PERFORMER_LAYER)).toBe(true);
    }
  });

  it("draws veil then performer and restores shared renderer state", () => {
    const compositor = new EnvironmentTransitionCompositor();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const background = new Color(0x123456);
    const fog = new Fog(0x654321, 1, 20);
    scene.background = background;
    scene.fog = fog;
    camera.layers.enable(3);

    const calls: string[] = [];
    const renderer = {
      autoClear: true,
      clearDepth: vi.fn(() => calls.push("clearDepth")),
      render: vi.fn((renderedScene: Scene) => {
        calls.push(renderedScene === scene ? "performer" : "veil");
        if (renderedScene === scene) {
          expect(scene.background).toBeNull();
          expect(scene.fog).toBeNull();
          expect(camera.layers.isEnabled(PROTECTED_PERFORMER_LAYER)).toBe(true);
          expect(camera.layers.isEnabled(BASE_SCENE_LAYER)).toBe(false);
        }
      }),
    } as unknown as import("three").WebGLRenderer;

    const originalMask = camera.layers.mask;
    compositor.render(renderer, scene, camera, 0.88);

    expect(calls).toEqual(["veil", "clearDepth", "performer"]);
    expect(renderer.autoClear).toBe(true);
    expect(camera.layers.mask).toBe(originalMask);
    expect(scene.background).toBe(background);
    expect(scene.fog).toBe(fog);
    compositor.dispose();
  });

  it("does no extra rendering when the transition is invisible", () => {
    const compositor = new EnvironmentTransitionCompositor();
    const renderer = {
      autoClear: true,
      clearDepth: vi.fn(),
      render: vi.fn(),
    } as unknown as import("three").WebGLRenderer;

    compositor.render(renderer, new Scene(), new PerspectiveCamera(), 0);

    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.clearDepth).not.toHaveBeenCalled();
    compositor.dispose();
  });
});
