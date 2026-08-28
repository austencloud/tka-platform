import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import { createFlowFestCampPlan } from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
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
});
