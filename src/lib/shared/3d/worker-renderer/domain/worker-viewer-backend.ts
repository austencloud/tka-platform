import { BackgroundType } from "@austencloud/backgrounds";
import {
  getSceneEnvironmentRendererKey,
  type SceneEnvironmentId,
} from "../../environments/domain/scene-environment";
import {
  decideWorkerViewerCapability,
  type WorkerCameraCapability,
  type WorkerViewerCapabilitySnapshot,
  type WorkerViewerFallbackReason,
} from "./worker-viewer-capability";
import type { WorkerEnvironmentKey } from "./worker-renderer-protocol";

/**
 * Every production environment appears here, including environments that must
 * still use the original renderer. That makes adding a scene a compile-time
 * decision instead of letting an unknown scene quietly lose artwork.
 */
export const WORKER_ENVIRONMENT_BY_BACKGROUND = {
  [BackgroundType.WINTER]: "winter",
  [BackgroundType.COSMIC]: "cosmic",
  [BackgroundType.PRIDE]: "rainbow",
  [BackgroundType.OCEAN]: "ocean",
  [BackgroundType.EMBER]: null,
  [BackgroundType.BLOSSOM]: "blossom",
  [BackgroundType.FOREST]: "forest",
  [BackgroundType.AUTUMN]: null,
  [BackgroundType.CELESTIAL]: "celestial",
  [BackgroundType.VOID]: "void",
} as const satisfies Readonly<
  Record<BackgroundType, WorkerEnvironmentKey | null>
>;

function isWorkerEnvironmentKey(
  value: WorkerEnvironmentKey | null
): value is WorkerEnvironmentKey {
  return value !== null;
}

export const MIGRATED_WORKER_ENVIRONMENTS: ReadonlySet<WorkerEnvironmentKey> =
  new Set(
    Object.values(WORKER_ENVIRONMENT_BY_BACKGROUND).filter(
      isWorkerEnvironmentKey
    )
  );

export interface WorkerViewerActualConditions {
  offscreenCanvasAvailable: boolean;
  visibleSceneMarkerCount: number;
  visibleAudienceMemberCount: number;
  worldChildCount: number;
  retainedEnvironmentCount: number;
  cameraMode: WorkerCameraCapability;
  captureInProgress: boolean;
  rendererHandleConsumerCount: number;
}

export interface WorkerViewerResolvedFeatures {
  performerPropsSupported: boolean;
  locomotionActive: boolean;
  effectSourceCount: number;
}

export interface WorkerViewerBackendInput {
  environmentId: SceneEnvironmentId;
  conditions: WorkerViewerActualConditions;
  features: WorkerViewerResolvedFeatures;
}

export type WorkerViewerBackendDecision =
  | {
      backend: "worker";
      environment: WorkerEnvironmentKey;
      fallbackReasons: readonly [];
    }
  | {
      backend: "legacy";
      environment: null;
      fallbackReasons: readonly WorkerViewerFallbackReason[];
    };

export function getWorkerEnvironmentKey(
  environmentId: SceneEnvironmentId
): WorkerEnvironmentKey | null {
  return WORKER_ENVIRONMENT_BY_BACKGROUND[
    getSceneEnvironmentRendererKey(environmentId)
  ];
}

export function createWorkerViewerCapabilitySnapshot(
  input: WorkerViewerBackendInput
): WorkerViewerCapabilitySnapshot {
  const workerEnvironment = getWorkerEnvironmentKey(input.environmentId);
  const rendererEnvironment = getSceneEnvironmentRendererKey(
    input.environmentId
  );

  return {
    offscreenCanvasAvailable: input.conditions.offscreenCanvasAvailable,
    environment: workerEnvironment ?? rendererEnvironment,
    migratedEnvironments: MIGRATED_WORKER_ENVIRONMENTS,
    performerPropsSupported: input.features.performerPropsSupported,
    locomotionActive: input.features.locomotionActive,
    effectsActive: input.features.effectSourceCount > 0,
    sceneMarkersVisible: input.conditions.visibleSceneMarkerCount > 0,
    audienceVisible: input.conditions.visibleAudienceMemberCount > 0,
    hasWorldChildren: input.conditions.worldChildCount > 0,
    retainsEnvironments: input.conditions.retainedEnvironmentCount > 0,
    cameraMode: input.conditions.cameraMode,
    captureActive: input.conditions.captureInProgress,
    requiresRendererHandle: input.conditions.rendererHandleConsumerCount > 0,
  };
}

/**
 * Choose the worker only when it can draw the entire frame the viewer asked
 * for. Unsupported scenes and visible features keep the original renderer,
 * along with the exact reasons the worker was rejected.
 */
export function decideWorkerViewerBackend(
  input: WorkerViewerBackendInput
): WorkerViewerBackendDecision {
  const environment = getWorkerEnvironmentKey(input.environmentId);
  const decision = decideWorkerViewerCapability(
    createWorkerViewerCapabilitySnapshot(input)
  );

  if (decision.backend === "legacy" || environment === null) {
    return {
      backend: "legacy",
      environment: null,
      fallbackReasons: decision.fallbackReasons,
    };
  }

  return {
    backend: "worker",
    environment,
    fallbackReasons: [],
  };
}
