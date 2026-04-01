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
import { Plane } from "../domain/enums/Plane";
import {
  createAvatarInstanceState,
  type AvatarInstanceState,
} from "./avatar-instance-state.svelte";

// ============================================
// Persistence
// ============================================

const STORAGE_KEY_MODE = "tka-viewer3d-renderMode";
const STORAGE_KEY_CAMERA = "tka-viewer3d-camera";
const STORAGE_KEY_VISIBLE_PLANES = "tka-viewer3d-visiblePlanes";
const STORAGE_KEY_PRESET = "tka-viewer3d-activePreset";

function loadPersistedMode(): "2d" | "3d" {
  if (typeof localStorage === "undefined") return "2d";
  try {
    const v = localStorage.getItem(STORAGE_KEY_MODE);
    return v === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

function persistMode(mode: "2d" | "3d") {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  } catch {
    // Storage full or unavailable
  }
}

function loadPersistedCamera(): CameraStateSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAMERA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistCamera(snapshot: CameraStateSnapshot) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CAMERA, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable
  }
}

// ============================================
// Plane Persistence
// ============================================

function loadPersistedPlanes(): Set<Plane> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISIBLE_PLANES);
    if (!raw) return null;
    const arr = JSON.parse(raw) as string[];
    // Validate each entry is a known Plane value
    const validValues = new Set<string>(Object.values(Plane));
    const planes = arr.filter((v) => validValues.has(v)) as Plane[];
    return new Set(planes);
  } catch {
    return null;
  }
}

function persistPlanes(planes: Set<Plane>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_VISIBLE_PLANES, JSON.stringify([...planes]));
  } catch {
    // Storage full or unavailable
  }
}

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
  const _persistedMode = _webgl2Available ? loadPersistedMode() : "2d";
  const _persistedCamera = loadPersistedCamera();

  let renderMode = $state<"2d" | "3d">("2d"); // Actual restore happens via enter3D call from orchestrator
  let avatarState = $state<AvatarInstanceState | null>(null);
  let effectToggles = $state<Record<string, boolean>>({
    fire: false,
    led: false,
    trails: false,
    charcoal: false,
  });
  let cameraSnapshot = $state<CameraStateSnapshot | null>(null);
  let activePreset = $state<string | null>((() => {
    if (typeof localStorage === "undefined") return "behind";
    try { return localStorage.getItem(STORAGE_KEY_PRESET) || "behind"; } catch { return "behind"; }
  })());
  // visiblePlanes: which grid planes are currently shown. Empty set = grid hidden.
  // On first visit, default to null (no planes shown). When the user enables the
  // grid for the first time, we auto-select only the planes the sequence uses.
  let visiblePlanes = $state<Set<Plane>>(loadPersistedPlanes() ?? new Set());

  // Camera snap callback — registered by Viewer3DCamera, called by Viewer3DViewPresets
  let _snapToFn: ((position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) => void) | null = null;

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
    persistMode("3d");
  }

  /**
   * Return to 2D render mode (avatar instance is kept alive to avoid
   * re-allocating WebGL resources if the user flips back).
   */
  function exit3D() {
    renderMode = "2d";
    persistMode("2d");
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
    persistCamera(snapshot);
  }

  /**
   * Release all resources held by the avatar instance.
   * Call when the viewer component is unmounted.
   */
  function dispose() {
    avatarState?.destroy();
    avatarState = null;
  }

  /**
   * Register the snap-to callback from Viewer3DCamera so preset buttons
   * can animate the camera without direct coupling to Three.js objects.
   */
  function registerSnapTo(
    fn: (position: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) => void
  ) {
    _snapToFn = fn;
  }

  /**
   * Animate the camera to a new position/target. No-ops if the camera
   * hasn't registered its snap callback yet.
   */
  function snapCameraTo(
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number }
  ) {
    _snapToFn?.(position, target);
  }

  return {
    get webgl2Available() {
      return _webgl2Available;
    },
    get preferredMode() {
      return _persistedMode;
    },
    get persistedCamera() {
      return _persistedCamera;
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
    get visiblePlanes() {
      return visiblePlanes;
    },
    get showGrid() {
      return visiblePlanes.size > 0;
    },
    get activePreset() {
      return activePreset;
    },
    setActivePreset(id: string | null) {
      activePreset = id;
      try { localStorage.setItem(STORAGE_KEY_PRESET, id ?? ""); } catch {}
    },
    /**
     * Toggle a single grid plane on or off.
     */
    togglePlane(plane: Plane) {
      const next = new Set(visiblePlanes);
      if (next.has(plane)) next.delete(plane);
      else next.add(plane);
      visiblePlanes = next;
      persistPlanes(visiblePlanes);
    },
    /**
     * Show all three grid planes at once.
     */
    showAllPlanes() {
      visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]);
      persistPlanes(visiblePlanes);
    },
    /**
     * Hide all grid planes.
     */
    hideAllPlanes() {
      visiblePlanes = new Set();
      persistPlanes(visiblePlanes);
    },
    /**
     * Toggle between "all planes visible" and "no planes visible".
     * When turning on for the first time (or after hide-all), defaults to
     * wall-only since all current sequences use the wall plane.
     */
    toggleGrid(sequenceData?: SequenceData | null) {
      if (visiblePlanes.size > 0) {
        // Already showing something — turn off everything
        visiblePlanes = new Set();
      } else {
        // Turn on — show only the planes the sequence actually uses.
        // Currently every sequence uses the wall plane, so we default to that.
        // When multi-plane sequences exist, read sequenceData.gridMode here.
        const defaultPlane = Plane.WALL;
        visiblePlanes = new Set([defaultPlane]);
      }
      persistPlanes(visiblePlanes);
    },
    enter3D,
    exit3D,
    toggleEffect,
    updateCameraSnapshot,
    registerSnapTo,
    snapCameraTo,
    dispose,
  };
}
