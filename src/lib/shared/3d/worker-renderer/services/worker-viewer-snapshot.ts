import type { CharacterInstanceState } from "../../state/character-instance-state.svelte";
import type { SceneEnvironmentId } from "../../environments/domain/scene-environment";
import {
  decideWorkerViewerBackend,
  type WorkerViewerActualConditions,
} from "../domain/worker-viewer-backend";
import type { WorkerViewerFallbackReason } from "../domain/worker-viewer-capability";
import type {
  WorkerCameraSnapshot,
  WorkerEnvironmentKey,
  WorkerPerformerSnapshot,
  WorkerSceneEffectsSnapshot,
} from "../domain/worker-renderer-protocol";
import {
  createWorkerPerformerSnapshot,
  supportsWorkerPerformer,
  type WorkerPerformerSnapshotOptions,
} from "./worker-performer-snapshot";

export interface ResolvedWorkerPerformerInput {
  performer: CharacterInstanceState;
  options: WorkerPerformerSnapshotOptions;
}

export interface WorkerViewerSnapshotInput {
  environmentId: SceneEnvironmentId;
  camera: WorkerCameraSnapshot;
  performers: readonly ResolvedWorkerPerformerInput[];
  effects: WorkerSceneEffectsSnapshot;
  conditions: WorkerViewerActualConditions;
}

export interface WorkerViewerRenderSnapshot {
  environment: WorkerEnvironmentKey;
  camera: WorkerCameraSnapshot;
  performers: readonly WorkerPerformerSnapshot[];
  effects: WorkerSceneEffectsSnapshot;
}

export type WorkerViewerSnapshotDecision =
  | {
      backend: "worker";
      snapshot: WorkerViewerRenderSnapshot;
      fallbackReasons: readonly [];
    }
  | {
      backend: "legacy";
      snapshot: null;
      fallbackReasons: readonly WorkerViewerFallbackReason[];
    };

function cloneCamera(camera: WorkerCameraSnapshot): WorkerCameraSnapshot {
  return {
    position: [...camera.position],
    target: [...camera.target],
    fov: camera.fov,
    quaternion: camera.quaternion ? [...camera.quaternion] : undefined,
    up: camera.up ? [...camera.up] : undefined,
  };
}

/**
 * Build the worker payload from values the application has already resolved.
 * Choreo timing, prop choice, effects, selection, and camera policy stay with
 * their existing owners; this boundary only copies their render result into a
 * message-safe shape.
 */
export function createWorkerViewerSnapshot(
  input: WorkerViewerSnapshotInput
): WorkerViewerSnapshotDecision {
  const performerPropsSupported = input.performers.every(({ options }) =>
    supportsWorkerPerformer(options)
  );
  const locomotionActive = input.performers.some(
    ({ options }) => options.enableLocomotion === true
  );
  const backend = decideWorkerViewerBackend({
    environmentId: input.environmentId,
    conditions: input.conditions,
    features: {
      performerPropsSupported,
      locomotionActive,
      effectSourceCount: input.effects.sources.length,
    },
  });

  if (backend.backend === "legacy") {
    return {
      backend: "legacy",
      snapshot: null,
      fallbackReasons: backend.fallbackReasons,
    };
  }

  return {
    backend: "worker",
    snapshot: {
      environment: backend.environment,
      camera: cloneCamera(input.camera),
      performers: input.performers.map(({ performer, options }) =>
        createWorkerPerformerSnapshot(performer, options)
      ),
      effects: structuredClone(input.effects),
    },
    fallbackReasons: [],
  };
}
