/**
 * Viewer 3D State
 *
 * Top-level state factory for the 3D viewer feature.
 * Manages render mode (2D/3D), a single avatar instance, effect toggles,
 * and the last known camera snapshot.
 *
 * WebGL2 availability is detected once at factory creation time so callers
 * can gate "Enter 3D" before attempting any WebGL work.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IPropStateInterpolator } from "../services/contracts/IPropStateInterpolator";
import type { ISequenceConverter } from "../services/contracts/ISequenceConverter";
import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";
import {
  createAvatarInstanceState,
  type AvatarInstanceState,
} from "./avatar-instance-state.svelte";

// ============================================
// WebGL2 Detection
// ============================================

/**
 * Test for WebGL2 support by creating a throwaway canvas.
 * Runs once at factory creation, result is cached in the returned state.
 */
function detectWebGL2(): boolean {
  if (typeof document === "undefined") return false; // SSR guard
  const testCanvas = document.createElement("canvas");
  const gl = testCanvas.getContext("webgl2");
  const supported = !!gl;
  if (gl) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported;
}

// ============================================
// Factory
// ============================================

export function createViewer3DState(deps: {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
}) {
  const _webgl2Available = detectWebGL2();

  let renderMode = $state<"2d" | "3d">("2d");
  let avatarState = $state<AvatarInstanceState | null>(null);
  let effectToggles = $state<Record<string, boolean>>({
    fire: false,
    led: false,
    trails: false,
    charcoal: false,
  });
  let cameraSnapshot = $state<CameraStateSnapshot | null>(null);

  /**
   * Switch to 3D render mode and load a sequence for the viewer avatar.
   * No-ops silently when WebGL2 is unavailable so callers don't need to
   * guard every call site — they should just check webgl2Available before
   * showing the "Enter 3D" button.
   */
  function enter3D(sequenceData: SequenceData) {
    if (!_webgl2Available) return;
    if (!avatarState) {
      avatarState = createAvatarInstanceState(
        { id: "viewer", positionX: 0 },
        {
          propInterpolator: deps.propInterpolator,
          sequenceConverter: deps.sequenceConverter,
        }
      );
    }
    avatarState.loadSequence(sequenceData);
    renderMode = "3d";
  }

  /**
   * Return to 2D render mode (avatar instance is kept alive to avoid
   * re-allocating WebGL resources if the user flips back).
   */
  function exit3D() {
    renderMode = "2d";
  }

  /**
   * Toggle a named visual effect on or off.
   * Unknown effect names are added automatically with an initial `true` value.
   */
  function toggleEffect(name: string) {
    effectToggles[name] = !effectToggles[name];
  }

  /**
   * Record the latest camera snapshot so descendant components (e.g. the
   * mini-map or a screenshot tool) can read camera state without coupling
   * directly to Three.js objects.
   */
  function updateCameraSnapshot(snapshot: CameraStateSnapshot) {
    cameraSnapshot = snapshot;
  }

  /**
   * Release all resources held by the avatar instance.
   * Call when the viewer component is unmounted.
   */
  function dispose() {
    avatarState?.destroy();
    avatarState = null;
  }

  return {
    get webgl2Available() {
      return _webgl2Available;
    },
    get renderMode() {
      return renderMode;
    },
    get avatarState() {
      return avatarState;
    },
    get effectToggles() {
      return effectToggles;
    },
    get cameraSnapshot() {
      return cameraSnapshot;
    },
    enter3D,
    exit3D,
    toggleEffect,
    updateCameraSnapshot,
    dispose,
  };
}
