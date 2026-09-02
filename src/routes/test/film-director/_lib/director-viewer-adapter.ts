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

import type { DirectorBlockingFrame } from "./director-blocking-track";
import type { DirectorCameraFrame } from "./director-camera-track";
import type { ResolvedDirectorScene } from "./film-director-schema";
import { resolveDirectorPerformerPoolSize } from "./film-director-performance-policy";
import { isIdleSequence } from "./sequence-language";

interface ApplyDirectorSceneOptions {
  /** Keep a stable rig pool so a cut never destroys and rebuilds half the cast. */
  reservedPerformerCount?: number;
  /**
   * Performer id → the sequence that performer spins in this scene, from
   * `director-sequence-library`. A performer with no entry — or a scene applied
   * before the library has finished generating — falls back to the film's
   * shared sequence. The one exception is a performer whose scene sequence is
   * `{source: "none"}`: they are skipped by name rather than falling back,
   * because they are standing and watching rather than waiting on a load.
   */
  sequences?: ReadonlyMap<string, SequenceData>;
}

/**
 * Cast slots that spin nothing this scene. Their performers must be left with
 * no loaded sequence: both the pooled backfill and the per-performer load
 * below otherwise hand every performer the film's shared sequence, which is
 * the right default for a performer whose own sequence has not resolved yet
 * and exactly wrong for one who is standing and watching.
 */
export function idlePerformerIndices(
  scene: ResolvedDirectorScene
): ReadonlySet<number> {
  const idle = new Set<number>();
  scene.performance.performers.forEach((performer, index) => {
    if (isIdleSequence(performer.sequence)) idle.add(index);
  });
  return idle;
}

export function buildDirectorViewerSeed(
  scene: ResolvedDirectorScene
): Viewer3DStateSeed {
  const camera = scene.camera.keyframes[0]!;
  return {
    renderMode: "3d",
    environmentId: scene.location.environmentId,
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
    performers: scene.performance.performers.map((performer) => ({
      characterId: performer.characterId,
      position: { ...performer.position },
      facingAngle: performer.facingAngle,
      customLeftPlane: performer.leftPlane,
      customRightPlane: performer.rightPlane,
      name: performer.name,
      settings: {
        prop: performer.prop,
        effortId: performer.effort,
        effect: performer.effect,
        staffLengthCm: performer.staffLengthCm,
      },
    })),
    selectedPerformerIndex: null,
    activeFormation: scene.performance.formation,
    defaultProp: PropType.STAFF,
    oceanVariant: "abyss",
    navMode: "orbit",
    activePreset: null,
    activeCameraPreset: "director",
    showGridLabels: false,
    visiblePlanes: scene.location.visiblePlanes,
    effectToggles: {},
  };
}

export function applyDirectorSceneToViewer(
  viewer: Viewer3DState,
  scene: ResolvedDirectorScene,
  options: ApplyDirectorSceneOptions = {}
): void {
  const manager = viewer.performerManager;
  const performerPoolSize = resolveDirectorPerformerPoolSize(
    scene.performance.performers.length,
    options.reservedPerformerCount
  );
  viewer.setEnvironmentId(scene.location.environmentId);
  const idle = idlePerformerIndices(scene);

  getSceneUndoManager().withoutUndo(() => {
    manager.ensurePerformerCount(performerPoolSize);
    while (manager.performers.length > performerPoolSize) {
      manager.removePerformer(manager.performers.length - 1);
    }
    manager.cancelFormationTransition();

    // `ensurePerformerCount` above can create pooled performers that were
    // never part of the sequence load `enter3D` ran at mount (that call only
    // reaches the performers that already existed at that moment - the first
    // scene's cast). `performer-manager`'s `addPerformer` never calls
    // `loadSequence` itself, so without this backfill any such performer's
    // `setStepHandPlane` below would silently no-op forever:
    // `applyBeatPlaneOverrides` bails out whenever `loadedSequence` is null.
    // Load once, the first time each pooled performer is touched.
    const sequenceData = viewer.currentSequenceData;
    if (sequenceData) {
      for (const [index, performer] of manager.performers.entries()) {
        if (idle.has(index)) continue;
        if (!performer.hasSequence) performer.loadSequence(sequenceData);
      }
    }

    // Wipe every pooled performer's leftover per-step overrides before this
    // scene's own `stepPlanes` go on below. A performer reused from an
    // earlier scene - or a pool member that scene never cast - must never
    // carry a stale per-step plane forward onto a cut that doesn't repeat it.
    for (const performer of manager.performers) {
      performer.clearStepPlaneOverrides();
    }

    scene.performance.performers.forEach((directed, index) => {
      const performer = manager.performers[index];
      if (!performer) return;
      performer.position.x = directed.position.x;
      performer.position.z = directed.position.z;
      performer.snapFacingAngle(directed.facingAngle);
      performer.setDisplayName(directed.name);
      performer.setCharacter(directed.characterId);
      performer.setProp(directed.prop, { equipBuild: false });
      performer.setEffect(directed.effect, { equipBuild: false });
      performer.setEffort(directed.effort);
      performer.setStaffLengthCm(directed.staffLengthCm);

      // Before the planes, not after: `loadSequence` rebuilds this performer's
      // step configs from whatever plane assignment is current and wipes their
      // per-step overrides, so a load that lands after `setHandPlane` would
      // discard both. Identity-compared because the library hands back the
      // same cached object every scene — reloading would reset playback.
      //
      // Skipping the load is not enough for a watcher: `enter3D` hands the
      // film's shared sequence to every performer at mount, and a performer
      // reused from an earlier scene carries whatever they spun there. Clear
      // it so the body idles and the props stop rendering.
      if (idle.has(index)) {
        if (performer.hasSequence) performer.clearSequence();
      } else {
        const directedSequence =
          options.sequences?.get(directed.id) ?? sequenceData;
        if (directedSequence && performer.loadedSequence !== directedSequence) {
          performer.loadSequence(directedSequence);
        }
      }

      performer.setHandPlane("left", directed.leftPlane);
      performer.setHandPlane("right", directed.rightPlane);
      for (const entry of directed.stepPlanes) {
        performer.setStepHandPlane(entry.step, entry.hand, entry.plane);
      }
    });

    viewer.hideAllPlanes();
    for (const plane of scene.location.visiblePlanes) {
      viewer.togglePlane(plane);
    }
  });
}

export function applyDirectorEffectPresets(
  state: EffectsConfigState,
  scene: ResolvedDirectorScene
): void {
  const config = structuredClone(DEFAULT_EFFECTS_CONFIG) as EffectsConfig;
  const mutable = config as unknown as Record<string, unknown>;

  for (const [effectId, presetId] of Object.entries(scene.effectPresets)) {
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

  for (const [effectId, patch] of Object.entries(scene.effectOverrides)) {
    mutable[effectId] = {
      ...(mutable[effectId] as Record<string, unknown>),
      ...patch,
    };
  }

  state.replace(config);
}

/**
 * Drives the cast's staging for one frame: where each performer stands, which
 * way they face, and what the locomotion animator needs to keep their feet on
 * the ground while they travel.
 *
 * Facing snaps rather than lerps because the blocking track has already eased
 * it — the rig's own rotation lerp would fight that curve and lag the walk.
 */
export function applyDirectorPerformerMotion(
  viewer: Viewer3DState,
  motion: readonly DirectorBlockingFrame[]
): void {
  const performers = viewer.performerManager.performers;
  motion.forEach((frame, index) => {
    const performer = performers[index];
    if (!performer) return;
    performer.position.x = frame.position.x;
    performer.position.z = frame.position.z;
    performer.snapFacingAngle(frame.facingAngle);
    performer.setTravel({
      direction: frame.moveDirection,
      speed: frame.moveSpeed,
      moving: frame.isMoving,
    });
  });
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

  // The viewer re-applies roll after its orbit controls update each frame;
  // writing the camera's quaternion here would be overwritten next tick.
  viewer.cameraRollDeg = frame.rollDeg;

  const camera = viewer.threlteCamera as PerspectiveCamera | null;
  if (!camera) return;

  if (Math.abs(camera.fov - previewFovDeg) >= 0.001) {
    camera.fov = previewFovDeg;
    camera.updateProjectionMatrix();
  }
}
