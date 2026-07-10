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
 * Build a reproducible snapshot from the viewer's own serialize() plus the two
 * owners outside it: the global settingsService background + prop types, and
 * the persisted scene-feature toggles (their context is scoped inside
 * Viewer3DCanvas, so the persisted key is read directly).
 */
export function captureScene3DSnapshot(viewer3DState: Viewer3DState): Scene3DSnapshot {
  const cfg = viewer3DState.serialize();
  const d = viewer3DState.defaultSettings;
  const settings = settingsService.settings;

  const performers: StoredPerformerSnapshot[] = cfg.performers.map((p) => ({
    position: { x: p.position.x, z: p.position.z },
    facingAngle: p.facingAngle,
    customBluePlane: String(p.customBluePlane),
    customRedPlane: String(p.customRedPlane),
    name: p.name ?? null,
  }));

  return {
    version: 1,
    scene: {
      backgroundType: String(settings.backgroundType),
      oceanVariant: cfg.oceanVariant,
    },
    camera: cfg.camera,
    performers,
    selectedPerformerIndex: cfg.selectedPerformerIndex,
    activeFormation: String(cfg.activeFormation),
    propSizeLinked: viewer3DState.propSizeLinked,
    defaultSettings: {
      prop: cfg.defaultProp,
      effortId: String(d.effortId),
      planeMode: String(d.planeMode),
      customBluePlane: String(d.customBluePlane),
      customRedPlane: String(d.customRedPlane),
    },
    visiblePlanes: cfg.visiblePlanes,
    showGridLabels: cfg.showGridLabels,
    navMode: cfg.navMode,
    activePreset: cfg.activePreset,
    activeCameraPreset: cfg.activeCameraPreset,
    stageGroundOffset: viewer3DState.stageGroundOffset,
    effectToggles: cfg.effectToggles ?? {},
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
