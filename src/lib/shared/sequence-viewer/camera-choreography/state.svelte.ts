/**
 * Camera Choreography State (minimal v0)
 *
 * Tracks the active camera preset selected from the Export popover.
 * The recording driver that consumes this state lands in Phase 1 of the
 * camera-choreography plan (docs/superpowers/plans/2026-04-17-camera-choreography.md).
 * For now this module is purely the "which preset is selected" source of truth.
 */

export type CameraPresetId =
  | "free"
  | "auto-orbit"
  | "plane-wall"
  | "plane-wheel"
  | "plane-floor"
  | "quad-plane-tour"
  | "ensemble-focus";

export function createCameraChoreographyState() {
  let _activePresetId = $state<CameraPresetId>("free");

  return {
    get activePresetId() {
      return _activePresetId;
    },
    setPresetId(id: CameraPresetId) {
      _activePresetId = id;
    },
  };
}

export type CameraChoreographyState = ReturnType<typeof createCameraChoreographyState>;
