/**
 * Scene3DRenderConfig - scene-wide 3D render modifiers.
 *
 * Lives alongside the per-tip unified EffectsConfig. Motion (blur +
 * speed lines) is a whole-scene post modifier, not a per-tip effect,
 * so it doesn't belong in the effect enum that both 2D and 3D share.
 *
 * Phase 2 of the 2D/3D effects unification (see
 * docs/superpowers/specs/2026-04-19-effects-engine-unification-design.md).
 */

import { getSceneUndoManager } from "../../undo/get-scene-undo-manager";

export interface MotionRenderConfig {
  /** Enable motion blur pass. */
  blur: boolean;
  /** Enable speed-line overlay. */
  speedLines: boolean;
  /** 0-1. Shared intensity scalar for both blur and speed lines. */
  intensity: number;
}

export interface Scene3DRenderConfig {
  motion: MotionRenderConfig;
}

export const DEFAULT_SCENE_3D_RENDER_CONFIG: Scene3DRenderConfig = {
  motion: {
    blur: false,
    speedLines: false,
    intensity: 0.5,
  },
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function createScene3DRenderState(
  initial: Scene3DRenderConfig = DEFAULT_SCENE_3D_RENDER_CONFIG,
) {
  let config = $state<Scene3DRenderConfig>({
    motion: { ...initial.motion },
  });

  const sceneUndo = getSceneUndoManager();
  sceneUndo.registerDomain("motion", {
    capture: () => structuredClone(config),
    restore: (snapshot) => { config = structuredClone(snapshot); },
  });

  function updateMotion(patch: Partial<MotionRenderConfig>) {
    sceneUndo.captureState("toggle-motion", "Update motion");
    const next: MotionRenderConfig = { ...config.motion, ...patch };
    if (patch.intensity !== undefined) {
      next.intensity = clamp01(patch.intensity);
    }
    config.motion = next;
    sceneUndo.commitStateCoalescing("motion-update");
  }

  function replace(next: Scene3DRenderConfig) {
    config = {
      motion: { ...next.motion, intensity: clamp01(next.motion.intensity) },
    };
  }

  return {
    get config() {
      return config;
    },
    get motion() {
      return config.motion;
    },
    updateMotion,
    replace,
  };
}

export type Scene3DRenderState = ReturnType<typeof createScene3DRenderState>;
