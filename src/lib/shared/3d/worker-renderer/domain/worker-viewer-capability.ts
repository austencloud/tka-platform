import type { WorkerEnvironmentKey } from "./worker-renderer-protocol";

export type WorkerCameraCapability =
  | "orbit"
  | "fly"
  | "walk"
  | "choreography"
  | "reframe";

export type WorkerViewerFallbackReason =
  | "offscreen-canvas-unavailable"
  | "environment-not-migrated"
  | "prop-family-not-migrated"
  | "locomotion-not-migrated"
  | "effects-not-migrated"
  | "scene-markers-not-migrated"
  | "performer-badges-not-migrated"
  | "audience-not-migrated"
  | "world-children-not-migrated"
  | "retained-environments-not-migrated"
  | "camera-mode-not-migrated"
  | "capture-not-migrated"
  | "renderer-handle-required";

export interface WorkerViewerCapabilitySnapshot {
  offscreenCanvasAvailable: boolean;
  environment: string;
  migratedEnvironments: ReadonlySet<WorkerEnvironmentKey>;
  performerPropsSupported: boolean;
  locomotionActive: boolean;
  effectsActive: boolean;
  sceneMarkersVisible: boolean;
  performerBadgesVisible: boolean;
  audienceVisible: boolean;
  hasWorldChildren: boolean;
  retainsEnvironments: boolean;
  cameraMode: WorkerCameraCapability;
  captureActive: boolean;
  requiresRendererHandle: boolean;
}

export interface WorkerViewerCapabilityDecision {
  backend: "worker" | "legacy";
  fallbackReasons: readonly WorkerViewerFallbackReason[];
}

/**
 * Decide whether the complete viewer frame can move to the worker without
 * dropping a visible or interactive production capability.
 *
 * This gate is intentionally fail-closed. New viewer features remain on the
 * legacy renderer until their worker owner is implemented and the associated
 * condition is removed here. The fast path must never earn its speed by
 * silently rendering less than the viewer asked for.
 */
export function decideWorkerViewerCapability(
  snapshot: WorkerViewerCapabilitySnapshot,
): WorkerViewerCapabilityDecision {
  const fallbackReasons: WorkerViewerFallbackReason[] = [];

  if (!snapshot.offscreenCanvasAvailable) {
    fallbackReasons.push("offscreen-canvas-unavailable");
  }
  if (
    !snapshot.migratedEnvironments.has(
      snapshot.environment as WorkerEnvironmentKey,
    )
  ) {
    fallbackReasons.push("environment-not-migrated");
  }
  if (!snapshot.performerPropsSupported) {
    fallbackReasons.push("prop-family-not-migrated");
  }
  if (snapshot.locomotionActive) {
    fallbackReasons.push("locomotion-not-migrated");
  }
  if (snapshot.effectsActive) {
    fallbackReasons.push("effects-not-migrated");
  }
  if (snapshot.sceneMarkersVisible) {
    fallbackReasons.push("scene-markers-not-migrated");
  }
  if (snapshot.performerBadgesVisible) {
    fallbackReasons.push("performer-badges-not-migrated");
  }
  if (snapshot.audienceVisible) {
    fallbackReasons.push("audience-not-migrated");
  }
  if (snapshot.hasWorldChildren) {
    fallbackReasons.push("world-children-not-migrated");
  }
  if (snapshot.retainsEnvironments) {
    fallbackReasons.push("retained-environments-not-migrated");
  }
  if (snapshot.cameraMode !== "orbit") {
    fallbackReasons.push("camera-mode-not-migrated");
  }
  if (snapshot.captureActive) {
    fallbackReasons.push("capture-not-migrated");
  }
  if (snapshot.requiresRendererHandle) {
    fallbackReasons.push("renderer-handle-required");
  }

  return {
    backend: fallbackReasons.length === 0 ? "worker" : "legacy",
    fallbackReasons,
  };
}
