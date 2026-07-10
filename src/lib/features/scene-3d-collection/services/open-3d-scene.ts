import type { Collected3DScene } from "../domain/scene-3d-collection-types";
import { writeViewer3DConfig } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
import { createSequenceData, type SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { BackgroundType } from "@austencloud/backgrounds";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ViewerNavMode } from "$lib/shared/3d/state/viewer-3d-state.svelte";

const SCENE_FEATURES_STORAGE_KEY = "tka-scene-features";

/**
 * Apply a saved scene's LOOK: seed the scattered viewer-3d localStorage keys,
 * the scene-feature toggles, and the global background + prop types. A fresh
 * viewer mount reads these seeds (same mechanism as open-tunnel-in-viewer). This
 * does NOT open a sequence — it's the "make my next 3D view look like this" path.
 *
 * Rewrites the global `backgroundType`, which also changes the 2D background
 * theme — accepted (documented in the design). Effect toggles are intentionally
 * not applied (the app never persists them).
 */
export function applyScene3DLook(scene: Collected3DScene): void {
  const snap = scene.snapshot;

  // 1. Viewer-3d persistence keys (camera, performers, formation, planes, …) +
  //    force render mode to "3d".
  writeViewer3DConfig({
    camera: snap.camera,
    performers: snap.performers.map((p) => ({
      position: p.position,
      facingAngle: p.facingAngle,
      // The stored plane strings are the Plane enum's string values; the viewer
      // reads them back through the same untyped JSON path, so pass through.
      customBluePlane: p.customBluePlane as never,
      customRedPlane: p.customRedPlane as never,
      name: p.name ?? null,
    })),
    selectedPerformerIndex: snap.selectedPerformerIndex,
    activeFormation: snap.activeFormation as never,
    defaultProp: snap.defaultSettings.prop,
    oceanVariant: snap.scene.oceanVariant,
    navMode: snap.navMode as ViewerNavMode,
    activePreset: snap.activePreset,
    activeCameraPreset: snap.activeCameraPreset,
    showGridLabels: snap.showGridLabels,
    visiblePlanes: snap.visiblePlanes,
  });

  // 2. Scene-feature toggles (a fresh createSceneFeatureState reads this key).
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SCENE_FEATURES_STORAGE_KEY, JSON.stringify(snap.sceneFeatures));
    } catch {
      // Quota / unavailable — viewer still opens with existing feature toggles.
    }
  }

  // 3. Global background theme + prop types (settingsService applies theme +
  //    body background internally). backgroundType is the BackgroundType enum
  //    whose values are these strings.
  void settingsService.updateSetting("backgroundType", snap.scene.backgroundType as BackgroundType);
  const propUpdate: Record<string, PropType> = {};
  if (snap.props.bluePropType) propUpdate.bluePropType = snap.props.bluePropType as PropType;
  if (snap.props.redPropType) propUpdate.redPropType = snap.props.redPropType as PropType;
  if (Object.keys(propUpdate).length > 0) void settingsService.updateSettings(propUpdate);

  // 4. Viewer boots into 3D (a fresh createViewerState reads this via
  //    loadViewerMode(); wants3D derives from "animation-3d").
  persistViewerMode("animation-3d");
}

/**
 * Reproduce a saved scene AS A PERFORMANCE: apply the look, then open the viewer
 * overlay with the stored sequence in 3D. Only meaningful when `steps` were
 * captured; the module gates the "Open in Viewer" action on their presence.
 */
export function openScene3DInViewer(scene: Collected3DScene): void {
  applyScene3DLook(scene);

  const steps = scene.steps ?? [];
  const sequence: SequenceData = createSequenceData({
    id: scene.id,
    name: scene.name,
    word: scene.name,
    steps: [...steps],
    gridMode: steps.find((s) => s.gridMode)?.gridMode,
  });

  openSequenceOverlay(sequence);
}

/** Whether this saved scene carries a sequence (enables "Open in Viewer"). */
export function scene3DHasSteps(scene: Collected3DScene): boolean {
  return Array.isArray(scene.steps) && scene.steps.length > 0;
}
