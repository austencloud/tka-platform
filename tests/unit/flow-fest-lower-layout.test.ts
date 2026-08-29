import { describe, expect, it } from "vitest";
import {
  createFlowFestLowerLayoutSubmission,
  emptyFlowFestLowerLayoutDraft,
  flowFestLowerLayoutReadiness,
  parseStoredFlowFestLowerLayoutDraft,
  validateFlowFestLowerLayoutSubmission,
  type FlowFestLowerLayoutDraft,
} from "../../src/routes/test/flow-fest-path-tracer/_lib/flow-fest-lower-layout";

const FINGERPRINT = "registered-coordinate-fingerprint";

function completeDraft(): FlowFestLowerLayoutDraft {
  return {
    ...emptyFlowFestLowerLayoutDraft(),
    lowerRoadLoop: [
      { x: 1480, y: 730 },
      { x: 1560, y: 660 },
      { x: 1680, y: 720 },
      { x: 1660, y: 820 },
      { x: 1500, y: 830 },
    ],
    tentPerimeterBand: [
      { x: 1490, y: 745 },
      { x: 1530, y: 690 },
      { x: 1620, y: 680 },
      { x: 1670, y: 745 },
      { x: 1640, y: 810 },
      { x: 1520, y: 815 },
    ],
    carCampingArea: [
      { x: 1540, y: 730 },
      { x: 1620, y: 720 },
      { x: 1640, y: 780 },
      { x: 1550, y: 790 },
    ],
    lowerLoopEntrance: { x: 1670, y: 800 },
    tentBandWidthMeters: 9,
    featureNotes: {
      "lower-road-loop": "The road itself forms one continuous loop.",
      "tent-perimeter-band": "Tent camping hugs the trees.",
      "car-camping-area": "Cars camp in the middle field.",
      "lower-loop-entrance": "Vehicles enter here.",
    },
    overallNote: "Keep the middle open enough for vehicles to circulate.",
  };
}

describe("Flow Fest lower campground layout", () => {
  it("keeps every independently drawn feature through browser storage", () => {
    const draft = completeDraft();

    expect(parseStoredFlowFestLowerLayoutDraft(JSON.stringify(draft))).toEqual(
      draft
    );
    expect(parseStoredFlowFestLowerLayoutDraft("not json")).toBeNull();
  });

  it("reports readiness per feature instead of hiding the save action", () => {
    const readiness = flowFestLowerLayoutReadiness(completeDraft());

    expect(readiness).toEqual({
      "lower-road-loop": true,
      "tent-perimeter-band": true,
      "car-camping-area": true,
      "lower-loop-entrance": true,
    });
    expect(
      flowFestLowerLayoutReadiness(emptyFlowFestLowerLayoutDraft())
    ).toEqual({
      "lower-road-loop": false,
      "tent-perimeter-band": false,
      "car-camping-area": false,
      "lower-loop-entrance": false,
    });
  });

  it("closes loop and area geometry in registered world coordinates", () => {
    const submission = createFlowFestLowerLayoutSubmission(
      completeDraft(),
      FINGERPRINT,
      "2026-08-28T12:00:00.000Z"
    );
    const validation = validateFlowFestLowerLayoutSubmission(
      submission,
      FINGERPRINT
    );

    expect(validation.valid).toBe(true);
    expect(submission.layout.lowerRoadLoop[0]).toEqual(
      submission.layout.lowerRoadLoop.at(-1)
    );
    expect(submission.layout.carCampingArea[0]).toEqual(
      submission.layout.carCampingArea.at(-1)
    );
    expect(submission.layout.tentCampingPerimeter.widthMeters).toBe(9);
    expect(submission.layout.lowerLoopEntrance).toEqual({ x: 323, z: -112 });
  });

  it("names the first missing truth in an incomplete layout", () => {
    const submission = createFlowFestLowerLayoutSubmission(
      emptyFlowFestLowerLayoutDraft(),
      FINGERPRINT
    );

    expect(
      validateFlowFestLowerLayoutSubmission(submission, FINGERPRINT)
    ).toEqual({
      valid: false,
      error: "Draw the complete lower campground vehicle loop.",
    });
  });

  it("rejects stale coordinate registrations", () => {
    const submission = createFlowFestLowerLayoutSubmission(
      completeDraft(),
      FINGERPRINT
    );

    expect(
      validateFlowFestLowerLayoutSubmission(submission, "new-fingerprint")
    ).toEqual({
      valid: false,
      error:
        "The registered camp coordinates changed after this layout was started.",
    });
  });
});
