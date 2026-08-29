import { describe, expect, it } from "vitest";
import {
  createFlowFestLowerLoopTraceSubmission,
  validateFlowFestLowerLoopTraceSubmission,
} from "../../src/routes/test/flow-fest-loop-tracer/_lib/flow-fest-lower-loop-trace";

const loop = [
  { x: 1665, y: 816 },
  { x: 1690, y: 746 },
  { x: 1647, y: 687 },
  { x: 1527, y: 659 },
  { x: 1463, y: 811 },
  { x: 1542, y: 846 },
  { x: 1626, y: 862 },
  { x: 1665, y: 816 },
];

describe("Flow Fest lower-loop trace", () => {
  it("pins the submitted drawing to the registered aerial and world frame", () => {
    const submission = createFlowFestLowerLoopTraceSubmission(
      loop,
      "2026-08-29T12:00:00.000Z"
    );
    const result = validateFlowFestLowerLoopTraceSubmission(submission);

    expect(result.valid).toBe(true);
    expect(submission.source.sha256).toBe(
      "abbf63d78d4d4cc29f3df591e2c19687cba8ce63811748008a8bc6235e18fd2f"
    );
    expect(submission.lowerCampgroundLoop.imagePixels[0]).toEqual(
      submission.lowerCampgroundLoop.imagePixels.at(-1)
    );
    expect(submission.lowerCampgroundLoop.worldMeters[0]).toEqual({
      x: 320.5,
      z: -104,
    });
    expect(submission.lowerCampgroundLoop.lengthMeters).toBeGreaterThan(250);
  });

  it("rejects coordinate data that does not match the drawn pixels", () => {
    const submission = createFlowFestLowerLoopTraceSubmission(loop);
    submission.lowerCampgroundLoop.worldMeters[0] = { x: 0, z: 0 };

    expect(validateFlowFestLowerLoopTraceSubmission(submission)).toEqual({
      valid: false,
      error: "The world coordinates do not match the aerial.",
    });
  });
});
