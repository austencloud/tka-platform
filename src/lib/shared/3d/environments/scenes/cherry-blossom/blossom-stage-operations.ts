import masterplanJson from "../../../../../../../static/models/blossom/amphitheatre-plan.json";

interface BlossomStageOperationsPlan {
  status: string;
  approvalGate: { productionChangesAllowed: boolean };
  stage: {
    center: [number, number];
    width: number;
    depth: number;
    deckTop: number;
    performanceEnvelope: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      minZ: number;
      maxZ: number;
    };
    protectedClearance: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
    operations: {
      minimumAudienceSetbackFromDeck: number;
      backstageAccessSide: "east" | "west";
      backstageServicePathId: string;
      backstageStagingArea: Rectangle;
      propStorageArea: Rectangle;
      technicalPosition: Rectangle & { accessPathId: string };
      emergencyCorridors: Array<Rectangle & { id: string }>;
    };
  };
}

interface Rectangle {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const plan = masterplanJson as unknown as BlossomStageOperationsPlan;

// "rejected-visual-review" renders the preserved build for comparison only.
if (
  plan.status !== "authored" &&
  plan.status !== "approved-for-production" &&
  plan.status !== "rejected-visual-review"
) {
  throw new Error(
    "Blossom stage operations are not at a recognized runtime gate"
  );
}

export function getBlossomStageFootprint(): {
  center: [number, number];
  width: number;
  depth: number;
  deckTop: number;
} {
  return {
    center: [...plan.stage.center],
    width: plan.stage.width,
    depth: plan.stage.depth,
    deckTop: plan.stage.deckTop,
  };
}

export function getBlossomPerformanceEnvelope(): BlossomStageOperationsPlan["stage"]["performanceEnvelope"] {
  return { ...plan.stage.performanceEnvelope };
}

export function getBlossomStageProtectedClearance(): BlossomStageOperationsPlan["stage"]["protectedClearance"] {
  return { ...plan.stage.protectedClearance };
}

export function getBlossomStageOperations(): BlossomStageOperationsPlan["stage"]["operations"] {
  return plan.stage.operations;
}
