import { describe, expect, it } from "vitest";
import {
  tunnelRelationshipFromOps,
  tunnelRelationshipOps,
} from "./tunnel-relationship-rule";

describe("tunnel relationship rules", () => {
  it("round-trips the persisted copy operations used by the creator", () => {
    const rule = {
      rotationSteps: 7,
      reflect: "mirror" as const,
      invert: true,
      rewind: true,
    };

    expect(tunnelRelationshipFromOps(tunnelRelationshipOps(rule))).toEqual(
      rule
    );
  });
});
