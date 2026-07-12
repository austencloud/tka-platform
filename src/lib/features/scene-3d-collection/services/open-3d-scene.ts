import type { Collected3DScene, StoredPerformerSettings } from "../domain/scene-3d-collection-types";
import { isGroupSaved } from "../domain/scene-3d-collection-types";
import { writeViewer3DConfig } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import type { Viewer3DPersistConfig } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
import { openSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
import { createSequenceData, type SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { BackgroundType } from "@austencloud/backgrounds";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ViewerNavMode } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import {
  captureSettingsCheckpoint,
  revertSettingsCheckpoint,
} from "$lib/shared/collections/settings-checkpoint.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { closeSequenceOverlay } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";

const SCENE_FEATURES_STORAGE_KEY = "tka-scene-features";

/** One-shot intent: seeds the viewer's playback tempo on the next mount
 *  (consumed by ArtPane, same pattern as the tunnel auto-export intent). */
export const SCENE_BPM_INTENT_KEY = "tka_scene_bpm";

/**
 * Apply a saved scene's LOOK: seed the viewer-3d localStorage keys, the
 * scene-feature toggles, and the global background + prop types — but ONLY for
 * the packing-list groups the save included (`snapshot.groups`; absent = all).
 * A fresh viewer mount reads these seeds (same mechanism as
 * open-tunnel-in-viewer). This does NOT open a sequence.
 *
 * Rewrites the global `backgroundType` when the scene group is saved, which
 * also changes the 2D background theme — accepted (documented in the design).
 *
 * Every write below overwrites settings the user configured for themselves.
 * `captureSettingsCheckpoint` snapshots the pre-apply state as the very first
 * act so a caller can offer Undo afterward (see `openScene3DInViewer` below
 * and `Scene3DCollectionModule`'s standalone "Apply look" action).
 */
export function applyScene3DLook(scene: Collected3DScene): void {
  const snap = scene.snapshot;
  const saved = (g: Parameters<typeof isGroupSaved>[1]) => isGroupSaved(snap, g);

  captureSettingsCheckpoint(scene.name);

  // 1. Viewer-3d persistence keys, filtered by group. Per-performer cascade
  //    overrides are split across groups: strip the fields whose group is off
  //    so applying "performers only" doesn't smuggle prop/effort/effect data in.
  const config: Partial<Viewer3DPersistConfig> = {};

  if (saved("performers")) {
    config.performers = snap.performers.map((p) => ({
      position: p.position,
      facingAngle: p.facingAngle,
      // Stored plane strings are the Plane enum's string values; the viewer
      // reads them back through the same untyped JSON path.
      customBluePlane: p.customBluePlane as never,
      customRedPlane: p.customRedPlane as never,
      name: p.name ?? null,
      ...(p.settings ? { settings: filterPerformerSettings(p.settings, saved) } : {}),
    }));
    config.selectedPerformerIndex = snap.selectedPerformerIndex;
    config.activeFormation = snap.activeFormation as never;
  }
  if (saved("props")) {
    config.defaultProp = snap.defaultSettings.prop;
  }
  if (saved("effects")) {
    config.effectToggles = snap.effectToggles;
  }
  if (saved("scene")) {
    config.oceanVariant = snap.scene.oceanVariant;
  }
  if (saved("camera")) {
    config.camera = snap.camera;
    config.navMode = snap.navMode as ViewerNavMode;
    config.activePreset = snap.activePreset;
    config.activeCameraPreset = snap.activeCameraPreset;
    config.showGridLabels = snap.showGridLabels;
    config.visiblePlanes = snap.visiblePlanes;
  }
  writeViewer3DConfig(config);

  // 2. Scene-feature toggles (a fresh createSceneFeatureState reads this key).
  if (saved("scene") && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SCENE_FEATURES_STORAGE_KEY, JSON.stringify(snap.sceneFeatures));
    } catch {
      // Quota / unavailable — viewer still opens with existing feature toggles.
    }
  }

  // 3. Global background theme + prop types (settingsService applies theme +
  //    body background internally).
  if (saved("scene")) {
    void settingsService.updateSetting(
      "backgroundType",
      snap.scene.backgroundType as BackgroundType,
    );
  }
  if (saved("props")) {
    const propUpdate: Record<string, PropType> = {};
    if (snap.props.bluePropType) propUpdate.bluePropType = snap.props.bluePropType as PropType;
    if (snap.props.redPropType) propUpdate.redPropType = snap.props.redPropType as PropType;
    if (Object.keys(propUpdate).length > 0) void settingsService.updateSettings(propUpdate);
  }

  // 4. Viewer boots into 3D (a fresh createViewerState reads this via
  //    loadViewerMode(); wants3D derives from "animation-3d").
  persistViewerMode("animation-3d");
}

function filterPerformerSettings(
  settings: StoredPerformerSettings,
  saved: (g: "props" | "efforts" | "effects") => boolean,
): StoredPerformerSettings {
  return {
    prop: saved("props") ? settings.prop : null,
    staffLengthCm: saved("props") ? settings.staffLengthCm : null,
    effortId: saved("efforts") ? settings.effortId : null,
    effect: saved("effects") ? settings.effect : null,
  };
}

/**
 * Reproduce a saved scene AS A PERFORMANCE: apply the look, then open the viewer
 * overlay with the stored sequence in 3D. Only meaningful when the performance
 * group was saved with steps; the module gates "Open in Viewer" on that.
 *
 * This is the one call site where an apply is immediately followed by opening
 * the viewer, so the Undo toast's action undoes the whole gesture — settings
 * AND the overlay it opened — not just the settings.
 */
export function openScene3DInViewer(scene: Collected3DScene): void {
  applyScene3DLook(scene);

  if (
    isGroupSaved(scene.snapshot, "performance") &&
    typeof scene.snapshot.bpm === "number" &&
    typeof sessionStorage !== "undefined"
  ) {
    try {
      sessionStorage.setItem(SCENE_BPM_INTENT_KEY, String(scene.snapshot.bpm));
    } catch {
      // Best-effort — viewer opens at its default tempo.
    }
  }

  const steps = scene.steps ?? [];
  const sequence: SequenceData = createSequenceData({
    id: scene.id,
    name: scene.name,
    word: scene.name,
    steps: [...steps],
    gridMode: steps.find((s) => s.gridMode)?.gridMode,
  });

  openSequenceOverlay(sequence);

  showToast({
    message: `Viewer now using "${scene.name}"`,
    type: "success",
    duration: 8000,
    action: {
      label: "Undo",
      onClick: () => {
        revertSettingsCheckpoint();
        closeSequenceOverlay();
      },
    },
  });
}

/** Whether this saved scene carries a reproducible performance. */
export function scene3DHasSteps(scene: Collected3DScene): boolean {
  return (
    isGroupSaved(scene.snapshot, "performance") &&
    Array.isArray(scene.steps) &&
    scene.steps.length > 0
  );
}
