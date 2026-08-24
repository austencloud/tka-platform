import masterplanJson from "../../../../../../../docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json";

export type BlossomPlanPoint2 = readonly [number, number];
export type BlossomPlanPoint3 = readonly [number, number, number];

export interface BlossomTerrainBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface BlossomCirculationPath {
  id: string;
  label: string;
  kind: "primary-accessible" | "restricted-service";
  width: number;
  from: string;
  to: string;
  crossSlopePercent: number;
  centerline: BlossomPlanPoint3[];
}

export interface BlossomAudienceZone {
  id: string;
  label: string;
  kind: string;
  capacity: number;
  polygon: BlossomPlanPoint2[];
  surface: string;
}

interface BlossomMasterplan {
  planId: string;
  status: string;
  activeProductionPhase: number;
  approvalGate: { productionChangesAllowed: boolean };
  site: {
    terrainBounds: BlossomTerrainBounds;
    playableClearingBounds: BlossomTerrainBounds;
    softHorizonBandMetres: number;
    gradeStrategy: {
      stageElevation: number;
      audienceLawnSlopePercent: number;
      northBankElevation: number;
      perimeterBermRange: [number, number];
    };
  };
  audience: { capacity: number; zones: BlossomAudienceZone[] };
  circulation: {
    paths: BlossomCirculationPath[];
  };
  camera: {
    default: {
      position: BlossomPlanPoint3;
      target: BlossomPlanPoint3;
      fov: number;
    };
    controls: {
      minimumDistance: number;
      maximumDistance: number;
      minimumPolarAngleDegrees: number;
      maximumPolarAngleDegrees: number;
      panTargetBounds: BlossomTerrainBounds;
    };
  };
}

const masterplan = masterplanJson as unknown as BlossomMasterplan;

// "rejected-visual-review" renders the preserved build for comparison only;
// new production authoring is blocked at the build script.
if (
  masterplan.status !== "approved-for-production" &&
  masterplan.status !== "rejected-visual-review"
) {
  throw new Error("Blossom R2.1 is not at a recognized runtime gate");
}

export function getBlossomMasterplanId(): string {
  return masterplan.planId;
}

export function getBlossomActiveProductionPhase(): number {
  return masterplan.activeProductionPhase;
}

export function getBlossomTerrainBounds(): BlossomTerrainBounds {
  return { ...masterplan.site.terrainBounds };
}

export function getBlossomPlayableBounds(): BlossomTerrainBounds {
  return { ...masterplan.site.playableClearingBounds };
}

export function getBlossomGradeStrategy(): BlossomMasterplan["site"]["gradeStrategy"] {
  return {
    ...masterplan.site.gradeStrategy,
    perimeterBermRange: [...masterplan.site.gradeStrategy.perimeterBermRange],
  };
}

export function getBlossomAudienceCapacity(): number {
  return masterplan.audience.capacity;
}

export function getBlossomAudienceZones(): readonly BlossomAudienceZone[] {
  return masterplan.audience.zones;
}

export function getBlossomCirculationPaths(): readonly BlossomCirculationPath[] {
  return masterplan.circulation.paths;
}

export function getBlossomCameraContract(): BlossomMasterplan["camera"] {
  return masterplan.camera;
}

/** Convert plan-space (X west/east, Y south/north, Z up) to Three.js space. */
export function blossomPlanToViewerPoint([
  x,
  depth,
  elevation,
]: BlossomPlanPoint3): [number, number, number] {
  return [-x, elevation, depth];
}
