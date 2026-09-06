import masterplanJson from "../../../../../../../static/models/blossom/amphitheatre-plan.json";

export type BlossomGroundLifeTier = "base" | "medium" | "high";

interface BlossomGroundPlan {
  status: string;
  approvalGate: { productionChangesAllowed: boolean };
  site: {
    terrainBounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
  };
}

const plan = masterplanJson as unknown as BlossomGroundPlan;

// Authored scenes can be reviewed before the user accepts their visual design.
if (
  plan.status !== "authored" &&
  plan.status !== "approved-for-production" &&
  plan.status !== "rejected-visual-review"
) {
  throw new Error("Blossom ground is not at a recognized runtime gate");
}

export function getBlossomGroundMaskBounds(): {
  min: [number, number];
  size: [number, number];
} {
  const {
    minX,
    maxX,
    minY: minDepth,
    maxY: maxDepth,
  } = plan.site.terrainBounds;
  return {
    min: [minX, minDepth],
    size: [maxX - minX, maxDepth - minDepth],
  };
}

export function getBlossomStageContact(): {
  edgeInset: number;
  feather: number;
  noise: number;
  strength: number;
} {
  return { edgeInset: 0.4, feather: 1.8, noise: 0.18, strength: 0.72 };
}

export function getBlossomPlannedGrassClumps(): number {
  return 0;
}

export function getBlossomGroundLifeTier(
  identity: string,
  authoredTier?: unknown
): BlossomGroundLifeTier | null {
  if (
    authoredTier === "base" ||
    authoredTier === "medium" ||
    authoredTier === "high"
  ) {
    return authoredTier;
  }

  const match = identity.match(/Blossom(?:_| )Grass(?:_| )(Base|Medium|High)/i);
  return match ? (match[1]!.toLowerCase() as BlossomGroundLifeTier) : null;
}

const TIER_ORDER: Record<BlossomGroundLifeTier, number> = {
  base: 0,
  medium: 1,
  high: 2,
};

export function isBlossomGroundLifeTierVisible(
  grassTier: BlossomGroundLifeTier,
  qualityTier: BlossomGroundLifeTier
): boolean {
  return TIER_ORDER[grassTier] <= TIER_ORDER[qualityTier];
}
