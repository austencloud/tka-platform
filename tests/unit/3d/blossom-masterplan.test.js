import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  connectedCirculationNodes,
  resolveLanternPosition,
  validateBlossomMasterplan,
} from "../../../scripts/blossom-masterplan-rules.mjs";

const planPath = resolve(
  process.cwd(),
  "docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json"
);
const plan = JSON.parse(readFileSync(planPath, "utf8"));

function validateMutation(change) {
  const mutated = structuredClone(plan);
  change(mutated);
  return validateBlossomMasterplan(mutated);
}

describe("Blossom R2.1 adversarial spatial contract", () => {
  it("records the R2.1 rejection and blocks new production authoring", () => {
    const result = validateBlossomMasterplan(plan);

    expect(result.valid).toBe(true);
    expect(result.failures).toEqual([]);
    expect(plan.planId).toBe("blossom-masterplan-r2.1");
    expect(plan.status).toBe("rejected-visual-review");
    expect(plan.approvalGate.productionChangesAllowed).toBe(false);
    expect(result.measurements.sightlineRayCount).toBe(171);
  });

  it("derives credible capacity instead of trusting declared totals", () => {
    const result = validateMutation((mutated) => {
      mutated.audience.zones[0].capacity = 90;
      mutated.audience.capacity = 154;
    });

    expect(result.valid).toBe(false);
    expect(
      result.failures.some((failure) =>
        failure.includes("usable area supports")
      )
    ).toBe(true);
  });

  it("requires physical route endpoints and compliant slopes", () => {
    const endpointResult = validateMutation((mutated) => {
      mutated.circulation.paths[0].centerline[0][0] += 2;
    });
    const slopeResult = validateMutation((mutated) => {
      mutated.circulation.paths.find(
        (path) => path.id === "bridge-crossing"
      ).centerline[1][2] = 2;
    });

    expect(
      endpointResult.failures.some((failure) =>
        failure.includes("does not physically start")
      )
    ).toBe(true);
    expect(
      slopeResult.failures.some((failure) =>
        failure.includes("accessible running slope")
      )
    ).toBe(true);
  });

  it("connects every required destination through real path endpoints", () => {
    const publicPaths = plan.circulation.paths.filter(
      (path) => path.kind === "primary-accessible"
    );
    const connected = connectedCirculationNodes(publicPaths, "southwest-entry");

    expect([...connected].sort()).toEqual(
      [...plan.circulation.requiredPublicNodes].sort()
    );
  });

  it("keeps lantern pads outside paths and bridge landings", () => {
    for (const lantern of plan.lanterns) {
      expect(resolveLanternPosition(plan, lantern)).not.toBeNull();
    }

    const result = validateMutation((mutated) => {
      mutated.lanterns[0].attachment.pathEdgeClearance = 0;
    });

    expect(result.failures).toContain(
      "lantern-arrival-01 pad enters its walking surface"
    );
  });

  it("rejects a tree that blocks a bridge landing or a 3D sightline", () => {
    const bridgeResult = validateMutation((mutated) => {
      mutated.grove.trees[0].position = [-15, 9.5];
      mutated.grove.trees[0].canopyRadius = 4;
    });
    const sightlineResult = validateMutation((mutated) => {
      mutated.grove.trees[0].position = [0, -7];
      mutated.grove.trees[0].canopyRadius = 1;
      mutated.grove.trees[0].canopyBottom = 1.2;
    });

    expect(
      bridgeResult.failures.some((failure) => failure.includes("bridge"))
    ).toBe(true);
    expect(
      sightlineResult.failures.some((failure) =>
        failure.includes("blocks a 3D sightline")
      )
    ).toBe(true);
  });

  it("contains the complete koi footprint inside authored widened water", () => {
    const result = validateMutation((mutated) => {
      mutated.water.fishHabitats[0].radius = 5;
    });

    expect(result.failures).toContain(
      "west-koi-pool extends outside its widened water surface"
    );
  });

  it("covers the complete legal camera orbit instead of preset positions only", () => {
    const result = validateMutation((mutated) => {
      mutated.site.terrainBounds = {
        minX: -70,
        maxX: 70,
        minY: -60,
        maxY: 72,
      };
    });

    expect(result.failures).toContain(
      "The legal camera orbit can expose the terrain edge"
    );
  });

  it("enforces flow-arts prop reach and overhead safety volumes", () => {
    const reachResult = validateMutation((mutated) => {
      mutated.stage.operations.supportedModes[1].maximumPropReachRadius = 6;
    });
    const heightResult = validateMutation((mutated) => {
      mutated.stage.performanceEnvelope.maxZ = 4;
    });

    expect(
      reachResult.failures.some((failure) =>
        failure.includes("prop reach escapes")
      )
    ).toBe(true);
    expect(
      heightResult.failures.some((failure) =>
        failure.includes("overhead safety volume")
      )
    ).toBe(true);
  });

  it("rejects cloned hero groves and any return to Meshy trees", () => {
    const repetitionResult = validateMutation((mutated) => {
      mutated.grove.trees[2].variantSlot = "open-crown-s19";
      mutated.grove.trees[3].variantSlot = "open-crown-s19";
    });
    const sourceResult = validateMutation((mutated) => {
      mutated.grove.assetPolicy.meshyTreesAllowed = true;
    });

    expect(
      repetitionResult.failures.some((failure) =>
        failure.includes("repeats too many times")
      )
    ).toBe(true);
    expect(sourceResult.failures).toContain(
      "The tree asset policy permits a rejected tree source"
    );
  });
});
