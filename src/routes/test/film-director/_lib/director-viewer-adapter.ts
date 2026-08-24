import { Plane } from "@austencloud/scene-3d";
import type { PerspectiveCamera } from "three";

import { getRegistration } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
import { getSceneUndoManager } from "$lib/shared/3d/undo/get-scene-undo-manager";
import type {
  Viewer3DState,
  Viewer3DStateSeed,
} from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import type { EffectsConfig } from "$lib/shared/effects/domain/effects-config";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

import type { DirectorCameraFrame } from "./director-camera-track";
import type { ResolvedDirectorShot } from "./film-director-schema";
import { resolveDirectorPerformerPoolSize } from "./film-director-performance-policy";

interface ApplyDirectorShotOptions {
  /** Keep a stable rig pool so a cut never destroys and rebuilds half the cast. */
  reservedPerformerCount?: number;
  /**
   * Performer id → the sequence that performer spins in this shot, from
   * `director-sequence-library`. A performer with no entry — or a shot applied
   * before the library has finished generating — falls back to the film's
   * shared sequence.
   */
  sequences?: ReadonlyMap<string, SequenceData>;
}

export function buildDirectorViewerSeed(
  shot: ResolvedDirectorShot
): Viewer3DStateSeed {
  const camera = shot.camera.keyframes[0]!;
  return {
    renderMode: "3d",
    environmentId: shot.scene.environmentId,
    camera: {
      position: {
        x: camera.position[0],
        y: camera.position[1],
        z: camera.position[2],
      },
      target: {
        x: camera.target[0],
        y: camera.target[1],
        z: camera.target[2],
      },
      rotation: { x: 0, y: 0, z: 0 },
      fov: camera.fovDeg,
      timestamp: 0,
    },
    performers: shot.performance.performers.map((performer) => ({
      position: { ...performer.position },
      facingAngle: performer.facingAngle,
      customBluePlane: performer.bluePlane,
      customRedPlane: performer.redPlane,
      name: performer.name,
      settings: {
        prop: performer.prop,
        effortId: performer.effort,
        effect: performer.effect,
        staffLengthCm: performer.staffLengthCm,
      },
    })),
    selectedPerformerIndex: null,
    activeFormation: shot.performance.formation,
    defaultProp: PropType.STAFF,
    oceanVariant: "abyss",
    navMode: "orbit",
    activePreset: null,
    activeCameraPreset: "director",
    showGridLabels: false,
    visiblePlanes: shot.scene.visiblePlanes,
    effectToggles: {},
  };
}

export function applyDirectorShotToViewer(
  viewer: Viewer3DState,
  shot: ResolvedDirectorShot,
  options: ApplyDirectorShotOptions = {}
): void {
  const manager = viewer.performerManager;
  const performerPoolSize = resolveDirectorPerformerPoolSize(
    shot.performance.performers.length,
    options.reservedPerformerCount
  );
  viewer.setEnvironmentId(shot.scene.environmentId);

  getSceneUndoManager().withoutUndo(() => {
    manager.ensurePerformerCount(performerPoolSize);
    while (manager.performers.length > performerPoolSize) {
      manager.removePerformer(manager.performers.length - 1);
    }
    manager.cancelFormationTransition();

    // `ensurePerformerCount` above can create pooled performers that were
    // never part of the sequence load `enter3D` ran at mount (that call only
    // reaches the performers that already existed at that moment - the first
    // shot's cast). `performer-manager`'s `addPerformer` never calls
    // `loadSequence` itself, so without this backfill any such performer's
    // `setStepHandPlane` below would silently no-op forever:
    // `applyBeatPlaneOverrides` bails out whenever `loadedSequence` is null.
    // Load once, the first time each pooled performer is touched.
    const sequenceData = viewer.currentSequenceData;
    if (sequenceData) {
      for (const performer of manager.performers) {
        if (!performer.hasSequence) performer.loadSequence(sequenceData);
      }
    }

    // Wipe every pooled performer's leftover per-step overrides before this
    // shot's own `stepPlanes` go on below. A performer reused from an
    // earlier shot - or a pool member that shot never cast - must never
    // carry a stale per-step plane forward onto a cut that doesn't repeat it.
    for (const performer of manager.performers) {
      performer.clearStepPlaneOverrides();
    }

    shot.performance.performers.forEach((directed, index) => {
      const performer = manager.performers[index];
      if (!performer) return;
      performer.position.x = directed.position.x;
      performer.position.z = directed.position.z;
      performer.snapFacingAngle(directed.facingAngle);
      performer.setDisplayName(directed.name);
      performer.setAvatarModel(directed.avatarId);
      performer.setProp(directed.prop);
      performer.setEffect(directed.effect);
      performer.setEffort(directed.effort);
      performer.setStaffLengthCm(directed.staffLengthCm);

      // Before the planes, not after: `loadSequence` rebuilds this performer's
      // step configs from whatever plane assignment is current and wipes their
      // per-step overrides, so a load that lands after `setHandPlane` would
      // discard both. Identity-compared because the library hands back the
      // same cached object every shot — reloading would reset playback.
      const directedSequence =
        options.sequences?.get(directed.id) ?? sequenceData;
      if (directedSequence && performer.loadedSequence !== directedSequence) {
        performer.loadSequence(directedSequence);
      }

      performer.setHandPlane("blue", directed.bluePlane);
      performer.setHandPlane("red", directed.redPlane);
      for (const entry of directed.stepPlanes) {
        performer.setStepHandPlane(entry.step, entry.hand, entry.plane);
      }
    });

    viewer.hideAllPlanes();
    for (const plane of shot.scene.visiblePlanes) {
      viewer.togglePlane(plane);
    }
  });
}

export function applyDirectorEffectPresets(
  state: EffectsConfigState,
  shot: ResolvedDirectorShot
): void {
  const config = structuredClone(DEFAULT_EFFECTS_CONFIG) as EffectsConfig;
  const mutable = config as unknown as Record<string, unknown>;

  for (const [effectId, presetId] of Object.entries(shot.effectPresets)) {
    const registration = getRegistration(effectId);
    const preset = registration?.presetGroup.presets.find(
      (candidate) => candidate.id === presetId
    );
    if (!registration || !preset?.patch) continue;

    mutable[effectId] = {
      ...(mutable[effectId] as Record<string, unknown>),
      ...preset.patch,
    };
    config.activePresets[
      registration.presetGroup.effectType as keyof typeof config.activePresets
    ] = presetId;
  }

  for (const [effectId, patch] of Object.entries(shot.effectOverrides)) {
    mutable[effectId] = {
      ...(mutable[effectId] as Record<string, unknown>),
      ...patch,
    };
  }

  state.replace(config);
}

export function applyDirectorCameraFrame(
  viewer: Viewer3DState,
  frame: DirectorCameraFrame,
  previewFovDeg = frame.fovDeg
): void {
  viewer.snapCameraTo(
    { x: frame.position[0], y: frame.position[1], z: frame.position[2] },
    { x: frame.target[0], y: frame.target[1], z: frame.target[2] },
    undefined,
    false
  );

  const camera = viewer.threlteCamera as PerspectiveCamera | null;
  if (!camera || Math.abs(camera.fov - previewFovDeg) < 0.001) return;
  camera.fov = previewFovDeg;
  camera.updateProjectionMatrix();
}
