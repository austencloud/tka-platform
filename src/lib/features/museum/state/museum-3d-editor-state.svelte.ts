/**
 * Museum 3D Editor State
 *
 * Reactive state for the museum scene editor mode.
 * F2 toggles editor mode. Click objects to select.
 * TransformControls gizmo appears on selected object.
 * Camera position persists across HMR via sessionStorage.
 */
import { Vector3, type Object3D } from "three";
import type CameraControls from "camera-controls";
import type { PlaceableObjectDef } from '../domain/placeable-object-registry';

const _tempVec = new Vector3();
const _panVec = new Vector3();

const EDITOR_CAMERA_KEY = "museum-editor-camera";

interface EditorCamera {
  x: number; y: number; z: number;
  targetX: number; targetY: number; targetZ: number;
}

let editorActive = $state(false);
let selectedObject: Object3D | null = $state(null);
let gizmoMode: "translate" | "rotate" | "scale" = $state("translate");
let orbitControls: CameraControls | null = null;
let placementDef: PlaceableObjectDef | null = $state(null);
let ghostValid = $state(false);

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
  get placementDef() { return placementDef; },
  get ghostValid() { return ghostValid; },

  select(obj: Object3D) {
    selectedObject = obj;
    // Smoothly glide orbit target to selected object. camera-controls'
    // internal smoothTime handles the easing - no hand-rolled rAF lerp.
    if (orbitControls && obj) {
      obj.getWorldPosition(_tempVec);
      orbitControls.setTarget(_tempVec.x, _tempVec.y, _tempVec.z, true);
    }
  },

  deselect() {
    selectedObject = null;
  },

  setMode(mode: "translate" | "rotate" | "scale") {
    gizmoMode = mode;
  },

  startPlacement(def: PlaceableObjectDef) {
    placementDef = def;
    ghostValid = false;
    selectedObject = null;
  },

  stopPlacement() {
    placementDef = null;
    ghostValid = false;
  },

  setGhostValid(valid: boolean) {
    ghostValid = valid;
  },

  toggle() {
    editorActive = !editorActive;
    if (!editorActive) {
      selectedObject = null;
      gizmoMode = "translate";
      placementDef = null;
      ghostValid = false;
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

  /** Store reference to the CameraControls instance so we can retarget it. */
  setOrbitControls(controls: CameraControls | null) {
    orbitControls = controls;
  },

  /** Focus orbit on a specific world point with smooth animation. */
  focusOnPoint(x: number, y: number, z: number) {
    orbitControls?.setTarget(x, y, z, true);
  },

  /** Move orbit target by a delta (for WASD panning - no animation). */
  panTarget(dx: number, dy: number, dz: number) {
    if (!orbitControls) return;
    orbitControls.getTarget(_panVec);
    orbitControls.setTarget(
      _panVec.x + dx,
      _panVec.y + dy,
      _panVec.z + dz,
      false,
    );
  },

  loadCamera: loadEditorCamera,
  saveCamera: saveEditorCamera,
};
