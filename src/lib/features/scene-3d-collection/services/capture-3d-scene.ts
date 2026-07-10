import type { Viewer3DState } from "$lib/shared/3d/context/viewer-3d-context";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { captureTunnelPoster } from "$lib/shared/sequence-viewer/tunnel/tunnel-poster";
import type { Scene3DSnapshot, StoredPerformerSnapshot } from "../domain/scene-3d-collection-types";

const SCENE_FEATURES_STORAGE_KEY = "tka-scene-features";

function readSceneFeatures(): Record<string, boolean> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SCENE_FEATURES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, boolean>;
    return {};
  } catch {
    return {};
  }
}

/**
 * Aggregate the four 3D state owners into one reproducible snapshot:
 * per-mount viewer-3d-state (getters), the global settingsService background +
 * prop types, and the persisted scene-feature toggles. Effect toggles are
 * captured for display but are not restored on open (the app never persists
 * them — see the design's Deferred section).
 */
export function captureScene3DSnapshot(viewer3DState: Viewer3DState): Scene3DSnapshot {
  const performers: StoredPerformerSnapshot[] = viewer3DState.performerManager.performers.map(
    (p) => ({
      position: { x: p.position.x, z: p.position.z },
      facingAngle: p.facingAngle,
      customBluePlane: String(p.customBluePlane),
      customRedPlane: String(p.customRedPlane),
      name: p.displayName ?? null,
    }),
  );

  const d = viewer3DState.defaultSettings;
  const settings = settingsService.settings;

  return {
    version: 1,
    scene: {
      backgroundType: String(settings.backgroundType),
      oceanVariant: String(viewer3DState.oceanVariant),
    },
    camera: viewer3DState.persistedCamera ?? null,
    performers,
    selectedPerformerIndex: viewer3DState.selectedPerformerIndex,
    activeFormation: String(viewer3DState.activeFormation),
    propSizeLinked: viewer3DState.propSizeLinked,
    defaultSettings: {
      prop: String(d.prop),
      effortId: String(d.effortId),
      planeMode: String(d.planeMode),
      customBluePlane: String(d.customBluePlane),
      customRedPlane: String(d.customRedPlane),
    },
    visiblePlanes: [...viewer3DState.visiblePlanes].map(String),
    showGridLabels: viewer3DState.showGridLabels,
    navMode: viewer3DState.navMode,
    activePreset: viewer3DState.activePreset,
    activeCameraPreset: viewer3DState.activeCameraPreset,
    stageGroundOffset: viewer3DState.stageGroundOffset,
    effectToggles: { ...viewer3DState.effectToggles },
    sceneFeatures: readSceneFeatures(),
    props: {
      bluePropType: settings.bluePropType ? String(settings.bluePropType) : undefined,
      redPropType: settings.redPropType ? String(settings.redPropType) : undefined,
    },
  };
}

/** Grab a ~200px WebP poster off the live WebGL canvas (preserveDrawingBuffer is
 *  already enabled on the renderer, so the buffer is readable). "" if unavailable. */
export function captureScene3DPoster(viewer3DState: Viewer3DState): string {
  const canvas = viewer3DState.webglCanvas;
  if (!canvas) return "";
  return captureTunnelPoster(canvas);
}
