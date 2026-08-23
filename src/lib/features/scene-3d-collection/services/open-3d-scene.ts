import type { Collected3DScene, StoredPerformerSettings } from "../domain/scene-3d-collection-types";
import {
  getScene3DEnvironmentId,
  isGroupSaved,
} from "../domain/scene-3d-collection-types";
import {
  markViewer3DPresetIntent,
  writeViewer3DConfig,
} from "$lib/shared/3d/state/viewer-3d-state.svelte";
import type { Viewer3DPersistConfig } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { persistViewerMode } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
import { createSequenceData, type SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ViewerNavMode } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import {
  captureSettingsCheckpoint,
} from "$lib/shared/collections/settings-checkpoint.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

const SCENE_FEATURES_STORAGE_KEY = "tka-scene-features";

/** Legacy one-shot tempo handoff retained for Sequence Viewer compatibility. */
export const SCENE_BPM_INTENT_KEY = "tka_scene_bpm";
const SCENE_STUDIO_HANDOFF_KEY = "tka_scene_studio_handoff";

export interface SceneStudioHandoff {
  sequence: SequenceData;
  bpm: number | null;
}

/**
 * Apply a saved scene's LOOK: seed the viewer-3d localStorage keys, the
 * scene-feature toggles, and global prop defaults — but ONLY for
 * the packing-list groups the save included (`snapshot.groups`; absent = all).
 * A fresh viewer mount reads these seeds (same mechanism as
 * open-tunnel-in-viewer). This does NOT open a sequence.
 *
 * `captureSettingsCheckpoint` snapshots the pre-apply state as the very first
 * act so the collection's standalone "Apply look" action can offer Undo.
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
    config.environmentId = getScene3DEnvironmentId(snap);
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

  // 3. Prop defaults remain app preferences. The environment above is viewer
  //    state and never repaints the application.
  if (saved("props")) {
    const propUpdate: Record<string, PropType> = {};
    if (snap.props.bluePropType) propUpdate.bluePropType = snap.props.bluePropType as PropType;
    if (snap.props.redPropType) propUpdate.redPropType = snap.props.redPropType as PropType;
    if (Object.keys(propUpdate).length > 0) void settingsService.updateSettings(propUpdate);
  }

  // 4. Viewer boots into 3D (a fresh createViewerState reads this via
  //    loadViewerMode(); wants3D derives from "animation-3d").
  persistViewerMode("animation-3d");

  // 5. Tell the next viewer mount this open was preset-sourced, so it restores
  //    prop identity verbatim instead of re-seeding it from the app prop.
  markViewer3DPresetIntent();
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
 * Reproduce a saved scene as a performance in the dedicated Scene workspace.
 * The handoff is one-shot so reopening 3D Studio later returns to its own
 * current source instead of replaying an old Browse action.
 */
export function openScene3DInStudio(scene: Collected3DScene): void {
  applyScene3DLook(scene);

  const steps = scene.steps ?? [];
  const sequence: SequenceData = createSequenceData({
    id: scene.id,
    name: scene.name,
    word: scene.name,
    steps: [...steps],
    gridMode: steps.find((s) => s.gridMode)?.gridMode,
  });

  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(
        SCENE_STUDIO_HANDOFF_KEY,
        JSON.stringify({
          sequence,
          bpm:
            isGroupSaved(scene.snapshot, "performance") &&
            typeof scene.snapshot.bpm === "number"
              ? scene.snapshot.bpm
              : null,
        } satisfies SceneStudioHandoff)
      );
    } catch {
      // Navigation still succeeds; Scene Studio will show its source picker.
    }
  }

  showToast({
    message: `Opening "${scene.name}" in 3D Studio`,
    type: "success",
    duration: 4000,
  });
  void handleModuleChange("stage", "scene");
}

export function consumeSceneStudioHandoff(): SceneStudioHandoff | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCENE_STUDIO_HANDOFF_KEY);
    sessionStorage.removeItem(SCENE_STUDIO_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SceneStudioHandoff>;
    if (!parsed.sequence || !Array.isArray(parsed.sequence.steps)) return null;
    return {
      sequence: parsed.sequence,
      bpm: typeof parsed.bpm === "number" ? parsed.bpm : null,
    };
  } catch {
    return null;
  }
}

/** Whether this saved scene carries a reproducible performance. */
export function scene3DHasSteps(scene: Collected3DScene): boolean {
  return (
    isGroupSaved(scene.snapshot, "performance") &&
    Array.isArray(scene.steps) &&
    scene.steps.length > 0
  );
}
