import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  createFlowFestCampPlan,
  identifyFlowFestPlanLocation,
} from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
import {
  createFlowFestPlanCorrectionSubmission,
  listEditableFlowFestPlanFeatures,
  previewFlowFestPlanCorrections,
  upsertFlowFestPlanCorrection,
  validateFlowFestPlanCorrectionSubmission,
} from "../../src/routes/test/flow-fest-path-tracer/_lib/flow-fest-camp-plan-corrections";
import {
  imagePointToWorld,
  worldPointToImage,
} from "../../src/routes/test/flow-fest-path-tracer/_lib/flow-fest-trace";

const contract = parseFlowFestRuntimeContract(
  JSON.parse(
    readFileSync(
      "static/data/flow-fest-sim/gate2-runtime-contract.json",
      "utf8"
    )
  )
);
const plan = createFlowFestCampPlan(contract, "lower-tent");
const fingerprint =
  contract.coordinateContentFingerprint.canonicalPayloadSha256;

describe("Flow Fest camp-plan corrections", () => {
  it("round-trips the pinned NAIP pixel and world coordinate frames", () => {
    const world = { x: 328.2557337440163, z: -98.15506248891917 };
    const restored = imagePointToWorld(worldPointToImage(world));
    expect(restored.x).toBeCloseTo(world.x, 1);
    expect(restored.z).toBeCloseTo(world.z, 1);
  });

  it("preserves the original plan coordinate while previewing a proposal", () => {
    const entrance = listEditableFlowFestPlanFeatures(plan).find(
      (feature) => feature.id === "camp-road-entrance"
    );
    expect(entrance).toBeDefined();
    const proposals = upsertFlowFestPlanCorrection(
      [],
      entrance!,
      { x: 320, z: -105 },
      "Austen correction"
    );
    const preview = previewFlowFestPlanCorrections(plan, proposals);
    expect(proposals[0]?.originalWorld).toEqual(entrance?.originalWorld);
    expect(
      preview.landmarks.find((landmark) => landmark.id === entrance?.id)
        ?.position
    ).toEqual({ x: 320, z: -105 });
    expect(
      plan.landmarks.find((landmark) => landmark.id === entrance?.id)?.position
    ).toEqual(entrance?.originalWorld);
  });

  it("accepts known corrections and rejects stale fingerprints or forged origins", () => {
    const lowerLevel = listEditableFlowFestPlanFeatures(plan).find(
      (feature) => feature.id === "lower-level"
    )!;
    const proposals = upsertFlowFestPlanCorrection([], lowerLevel, {
      x: 290,
      z: -140,
    });
    const submission = createFlowFestPlanCorrectionSubmission(
      proposals,
      fingerprint,
      "2026-08-27T12:00:00.000Z"
    );
    expect(
      validateFlowFestPlanCorrectionSubmission(submission, plan, fingerprint)
        .valid
    ).toBe(true);
    expect(
      validateFlowFestPlanCorrectionSubmission(
        { ...submission, coordinateFingerprint: "stale" },
        plan,
        fingerprint
      )
    ).toMatchObject({ valid: false });
    expect(
      validateFlowFestPlanCorrectionSubmission(
        {
          ...submission,
          proposals: [
            { ...submission.proposals[0], originalWorld: { x: 0, z: 0 } },
          ],
        },
        plan,
        fingerprint
      )
    ).toMatchObject({ valid: false });
  });

  describe("identifyFlowFestPlanLocation perf refactor (regression)", () => {
    it("breaks an exact landmark distance tie by priority, matching the pre-refactor stable-sort order", () => {
      // The "selected-camp" and "lower-level" landmarks share the same
      // lower-tent-zone center for the "lower-tent" branch plan, so a query
      // at that exact point is an exact distance tie. The manual scan that
      // replaced the map/filter/sort chain must still pick the higher
      // priority landmark ("camp" over "clearing"), same as the original
      // stable sort did.
      const lowerTentZone = contract.zones.find(
        (zone) => zone.id === "lower-tent-zone"
      )!;
      const location = identifyFlowFestPlanLocation(plan, lowerTentZone.center);
      expect(location.kind).toBe("landmark");
      expect(location.id).toBe("selected-camp");
    });

    it("returns identical results across repeated queries against the same cached plan", () => {
      const positions = [
        { x: 328.2557337440163, z: -98.15506248891917 },
        { x: 100, z: -115 },
        { x: 286, z: -130 },
        { x: -9999, z: -9999 },
      ];
      for (const position of positions) {
        const first = identifyFlowFestPlanLocation(plan, position);
        const second = identifyFlowFestPlanLocation(plan, position);
        expect(second).toEqual(first);
      }
    });

    it("does not leak cached shaping between distinct plan objects", () => {
      const otherPlan = createFlowFestCampPlan(contract, "car-camp");
      const target = otherPlan.landmarks.find(
        (landmark) => landmark.id === "selected-camp"
      )!;
      const location = identifyFlowFestPlanLocation(
        otherPlan,
        target.position
      );
      expect(location.kind).toBe("landmark");
      expect(location.id).toBe("selected-camp");
    });
  });
});
