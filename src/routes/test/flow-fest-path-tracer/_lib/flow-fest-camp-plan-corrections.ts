import type {
  FlowFestCampPlan,
  FlowFestCampPlanEvidence,
} from "../../flow-fest-sim/flow-fest-camp-plan";
import { FLOW_FEST_IMAGE, type WorldPoint } from "./flow-fest-trace";

export const FLOW_FEST_PLAN_CORRECTION_SCHEMA_VERSION = 1 as const;

export type FlowFestPlanCorrectionTargetKind = "landmark" | "region-center";

export interface FlowFestEditablePlanFeature {
  id: string;
  label: string;
  targetKind: FlowFestPlanCorrectionTargetKind;
  evidence: FlowFestCampPlanEvidence;
  originalWorld: WorldPoint;
}

export interface FlowFestPlanCorrectionProposal {
  featureId: string;
  targetKind: FlowFestPlanCorrectionTargetKind;
  label: string;
  originalWorld: WorldPoint;
  proposedWorld: WorldPoint;
  evidence: "austen-annotated";
  note: string;
}

export interface FlowFestPlanCorrectionSubmission {
  schemaVersion: typeof FLOW_FEST_PLAN_CORRECTION_SCHEMA_VERSION;
  sceneId: "flow-fest-sim-earth";
  capturedAt: string;
  coordinateFrame: "world metres; x east, z south";
  coordinateFingerprint: string;
  source: {
    path: typeof FLOW_FEST_IMAGE.sourcePath;
    sha256: typeof FLOW_FEST_IMAGE.sourceSha256;
    annotationAuthority: "austen-annotated";
  };
  proposals: FlowFestPlanCorrectionProposal[];
}

export type FlowFestPlanCorrectionValidation =
  | { valid: true; value: FlowFestPlanCorrectionSubmission }
  | { valid: false; error: string };

function copyPoint(point: WorldPoint): WorldPoint {
  return { x: point.x, z: point.z };
}

function samePoint(left: WorldPoint, right: WorldPoint): boolean {
  return (
    Math.abs(left.x - right.x) <= 0.001 && Math.abs(left.z - right.z) <= 0.001
  );
}

function pointInsideTerrain(point: WorldPoint): boolean {
  const maxX =
    FLOW_FEST_IMAGE.worldMinX +
    FLOW_FEST_IMAGE.width * FLOW_FEST_IMAGE.pixelSizeMeters;
  const maxZ =
    FLOW_FEST_IMAGE.worldMinZ +
    FLOW_FEST_IMAGE.height * FLOW_FEST_IMAGE.pixelSizeMeters;
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.z) &&
    point.x >= FLOW_FEST_IMAGE.worldMinX &&
    point.x <= maxX &&
    point.z >= FLOW_FEST_IMAGE.worldMinZ &&
    point.z <= maxZ
  );
}

export function listEditableFlowFestPlanFeatures(
  plan: FlowFestCampPlan
): FlowFestEditablePlanFeature[] {
  const landmarks = plan.landmarks
    .filter((landmark) => landmark.id !== "selected-camp")
    .map((landmark) => ({
      id: landmark.id,
      label: landmark.label,
      targetKind: "landmark" as const,
      evidence: landmark.evidence,
      originalWorld: copyPoint(landmark.position),
    }));
  const regions = plan.regions.flatMap((region) =>
    region.center
      ? [
          {
            id: region.id,
            label: `${region.label} center`,
            targetKind: "region-center" as const,
            evidence: region.evidence,
            originalWorld: copyPoint(region.center),
          },
        ]
      : []
  );
  return [...landmarks, ...regions];
}

export function upsertFlowFestPlanCorrection(
  proposals: readonly FlowFestPlanCorrectionProposal[],
  feature: FlowFestEditablePlanFeature,
  proposedWorld: WorldPoint,
  note = ""
): FlowFestPlanCorrectionProposal[] {
  if (!pointInsideTerrain(proposedWorld)) return [...proposals];
  const proposal: FlowFestPlanCorrectionProposal = {
    featureId: feature.id,
    targetKind: feature.targetKind,
    label: feature.label,
    originalWorld: copyPoint(feature.originalWorld),
    proposedWorld: copyPoint(proposedWorld),
    evidence: "austen-annotated",
    note: note.trim(),
  };
  return [
    ...proposals.filter(
      (candidate) =>
        candidate.featureId !== feature.id ||
        candidate.targetKind !== feature.targetKind
    ),
    proposal,
  ];
}

export function createFlowFestPlanCorrectionSubmission(
  proposals: readonly FlowFestPlanCorrectionProposal[],
  coordinateFingerprint: string,
  capturedAt = new Date().toISOString()
): FlowFestPlanCorrectionSubmission {
  return {
    schemaVersion: FLOW_FEST_PLAN_CORRECTION_SCHEMA_VERSION,
    sceneId: "flow-fest-sim-earth",
    capturedAt,
    coordinateFrame: "world metres; x east, z south",
    coordinateFingerprint,
    source: {
      path: FLOW_FEST_IMAGE.sourcePath,
      sha256: FLOW_FEST_IMAGE.sourceSha256,
      annotationAuthority: "austen-annotated",
    },
    proposals: proposals.map((proposal) => ({
      ...proposal,
      originalWorld: copyPoint(proposal.originalWorld),
      proposedWorld: copyPoint(proposal.proposedWorld),
    })),
  };
}

export function validateFlowFestPlanCorrectionSubmission(
  value: unknown,
  plan: FlowFestCampPlan,
  expectedFingerprint: string
): FlowFestPlanCorrectionValidation {
  if (!value || typeof value !== "object") {
    return { valid: false, error: "Expected a camp-plan correction object." };
  }
  const submission = value as Partial<FlowFestPlanCorrectionSubmission>;
  if (
    submission.schemaVersion !== FLOW_FEST_PLAN_CORRECTION_SCHEMA_VERSION ||
    submission.sceneId !== "flow-fest-sim-earth" ||
    submission.coordinateFrame !== "world metres; x east, z south"
  ) {
    return { valid: false, error: "Camp-plan metadata is not recognized." };
  }
  if (submission.coordinateFingerprint !== expectedFingerprint) {
    return {
      valid: false,
      error: "The camp plan changed after these corrections were started.",
    };
  }
  if (
    submission.source?.path !== FLOW_FEST_IMAGE.sourcePath ||
    submission.source.sha256 !== FLOW_FEST_IMAGE.sourceSha256 ||
    submission.source.annotationAuthority !== "austen-annotated"
  ) {
    return {
      valid: false,
      error: "Correction imagery is not the pinned NAIP source.",
    };
  }
  if (
    typeof submission.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(submission.capturedAt))
  ) {
    return { valid: false, error: "Correction capture time is invalid." };
  }
  if (
    !Array.isArray(submission.proposals) ||
    submission.proposals.length === 0
  ) {
    return {
      valid: false,
      error: "Move at least one camp-plan feature first.",
    };
  }
  if (submission.proposals.length > 64) {
    return { valid: false, error: "The correction set has too many features." };
  }

  const editable = listEditableFlowFestPlanFeatures(plan);
  const seen = new Set<string>();
  for (const proposal of submission.proposals) {
    const feature = editable.find(
      (candidate) =>
        candidate.id === proposal.featureId &&
        candidate.targetKind === proposal.targetKind
    );
    if (!feature) {
      return {
        valid: false,
        error: `Unknown editable feature: ${proposal.featureId}`,
      };
    }
    const key = `${proposal.targetKind}:${proposal.featureId}`;
    if (seen.has(key)) {
      return { valid: false, error: `Duplicate correction: ${proposal.label}` };
    }
    seen.add(key);
    if (
      proposal.evidence !== "austen-annotated" ||
      proposal.label !== feature.label ||
      !samePoint(proposal.originalWorld, feature.originalWorld) ||
      !pointInsideTerrain(proposal.proposedWorld) ||
      typeof proposal.note !== "string" ||
      proposal.note.length > 500
    ) {
      return { valid: false, error: `Invalid correction: ${feature.label}` };
    }
  }
  return {
    valid: true,
    value: submission as FlowFestPlanCorrectionSubmission,
  };
}

export function previewFlowFestPlanCorrections(
  plan: FlowFestCampPlan,
  proposals: readonly FlowFestPlanCorrectionProposal[]
): FlowFestCampPlan {
  const correctionFor = (
    targetKind: FlowFestPlanCorrectionTargetKind,
    featureId: string
  ) =>
    proposals.find(
      (candidate) =>
        candidate.targetKind === targetKind && candidate.featureId === featureId
    );
  return {
    ...plan,
    landmarks: plan.landmarks.map((landmark) => {
      const correction = correctionFor("landmark", landmark.id);
      return correction
        ? { ...landmark, position: copyPoint(correction.proposedWorld) }
        : { ...landmark, position: copyPoint(landmark.position) };
    }),
    regions: plan.regions.map((region) => {
      const correction = correctionFor("region-center", region.id);
      return correction
        ? { ...region, center: copyPoint(correction.proposedWorld) }
        : {
            ...region,
            center: region.center ? copyPoint(region.center) : undefined,
            points: region.points?.map(copyPoint),
          };
    }),
  };
}
