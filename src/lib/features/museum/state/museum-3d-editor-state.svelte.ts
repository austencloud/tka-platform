/**
 * Museum 3D Editor State
 *
 * Reactive state for the museum scene editor mode.
 * F2 toggles editor mode. Click objects to select.
 * TransformControls gizmo appears on selected object.
 * Camera position persists across HMR via sessionStorage.
 */
import { Vector3, type Object3D } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const _tempVec = new Vector3();

const EDITOR_CAMERA_KEY = "museum-editor-camera";

interface EditorCamera {
  x: number; y: number; z: number;
  targetX: number; targetY: number; targetZ: number;
}

let editorActive = $state(false);
let selectedObject: Object3D | null = $state(null);
let gizmoMode: "translate" | "rotate" | "scale" = $state("translate");
let orbitControls: OrbitControls | null = null;
let targetAnimationId: number | null = null;

/** Smoothly animate the orbit target to a new position over ~300ms */
function animateOrbitTarget(x: number, y: number, z: number) {
  if (!orbitControls) return;

  // Cancel any in-flight animation
  if (targetAnimationId !== null) cancelAnimationFrame(targetAnimationId);

  const start = { x: orbitControls.target.x, y: orbitControls.target.y, z: orbitControls.target.z };
  const startTime = performance.now();
  const duration = 300; // ms

  function tick() {
    if (!orbitControls) return;
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Ease-out cubic for a smooth deceleration
    const ease = 1 - Math.pow(1 - t, 3);

    orbitControls.target.set(
      start.x + (x - start.x) * ease,
      start.y + (y - start.y) * ease,
      start.z + (z - start.z) * ease,
    );
    orbitControls.update();

    if (t < 1) {
      targetAnimationId = requestAnimationFrame(tick);
    } else {
      targetAnimationId = null;
    }
  }

  targetAnimationId = requestAnimationFrame(tick);
}

function loadEditorCamera(): EditorCamera | null {
  try {
    const raw = sessionStorage.getItem(EDITOR_CAMERA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveEditorCamera(cam: EditorCamera): void {
  try {
    sessionStorage.setItem(EDITOR_CAMERA_KEY, JSON.stringify(cam));
  } catch { /* non-critical */ }
}

export const museum3dEditorState = {
  get editorActive() { return editorActive; },
  get selectedObject() { return selectedObject; },
  get gizmoMode() { return gizmoMode; },

  select(obj: Object3D) {
    selectedObject = obj;
    // Smoothly glide orbit target to selected object
    if (orbitControls && obj) {
      obj.getWorldPosition(_tempVec);
      animateOrbitTarget(_tempVec.x, _tempVec.y, _tempVec.z);
    }
  },

  deselect() {
    selectedObject = null;
  },

  setMode(mode: "translate" | "rotate" | "scale") {
    gizmoMode = mode;
  },

  toggle() {
    editorActive = !editorActive;
    if (!editorActive) {
      selectedObject = null;
      gizmoMode = "translate";
    }
  },

  /** Restore to active (used by HMR restore) */
  setActive(active: boolean) {
    editorActive = active;
    if (!active) {
      selectedObject = null;
      gizmoMode = "translate";
    }
  },

  /** Store reference to OrbitControls so we can update its target */
  setOrbitControls(controls: OrbitControls | null) {
    orbitControls = controls;
  },

  /** Focus orbit on a specific world point with smooth animation */
  focusOnPoint(x: number, y: number, z: number) {
    animateOrbitTarget(x, y, z);
  },

  loadCamera: loadEditorCamera,
  saveCamera: saveEditorCamera,
};
