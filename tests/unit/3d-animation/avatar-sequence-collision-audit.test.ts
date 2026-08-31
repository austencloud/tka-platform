import { describe, expect, it } from "vitest";
import type { CollisionEvent } from "@austencloud/scene-3d";
import { AvatarSequenceCollisionAudit } from "$lib/shared/3d/collision/avatar-sequence-collision-audit";

function event(
  stepNumber: number,
  beatProgress: number,
  penetrationDepth: number,
  zone: CollisionEvent["zone"] = "arm-through-neck"
): CollisionEvent {
  return {
    zone,
    severity: penetrationDepth > 0.05 ? "penetrate" : "clip",
    stepNumber,
    beatProgress,
    penetrationDepth,
    description: `${zone} ${(penetrationDepth * 100).toFixed(0)}cm`,
  };
}

describe("AvatarSequenceCollisionAudit", () => {
  it("clusters contiguous bad frames and keeps the exact worst sample", () => {
    const audit = new AvatarSequenceCollisionAudit();
    audit.record("austen", [event(2, 0.2, 0.03)]);
    audit.record("austen", [event(2, 0.3, 0.08)]);
    audit.record("austen", [event(2, 0.4, 0.04)]);
    audit.record("austen", []);

    expect(audit.report()).toMatchObject({
      sampledFrames: 4,
      clusters: [
        {
          performerId: "austen",
          zone: "arm-through-neck",
          frameCount: 3,
          firstStep: 2,
          firstProgress: 0.2,
          lastProgress: 0.4,
          worstStep: 2,
          worstProgress: 0.3,
          worstPenetrationDepth: 0.08,
          severity: "penetrate",
        },
      ],
    });
  });

  it("starts a new cluster after a clear frame", () => {
    const audit = new AvatarSequenceCollisionAudit();
    audit.record("austen", [event(1, 0.1, 0.04)]);
    audit.record("austen", []);
    audit.record("austen", [event(3, 0.7, 0.07)]);

    expect(audit.report().clusters).toHaveLength(2);
  });

  it("keeps performers and zones independent", () => {
    const audit = new AvatarSequenceCollisionAudit();
    audit.record("austen", [event(1, 0.1, 0.04)]);
    audit.record("remy", [event(1, 0.1, 0.06, "arm-through-torso")]);
    audit.record("austen", []);

    const report = audit.report();
    expect(
      report.clusters.map((cluster) => cluster.performerId).sort()
    ).toEqual(["austen", "remy"]);
  });
});
