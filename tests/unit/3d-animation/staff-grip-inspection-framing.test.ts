import { STAGE, userProportionsState } from "@austencloud/scene-3d";
import { describe, expect, it } from "vitest";

import {
  INSPECTION_FOV_DEG,
  INSPECTION_VIEWS,
  bodySubject,
  gripSubject,
  inspectionShotForView,
  type InspectionShot,
  type InspectionView,
} from "../../../src/routes/test/staff-grip/inspection-framing";

type V3 = [number, number, number];

/**
 * Pane shapes the lab actually renders into, from the tall reference column at
 * 4K down to the squat cells a folded phone in landscape produces.
 */
const ASPECT_RATIOS = [0.45, 0.61, 0.9, 1, 1.16, 1.49, 2.2, 3.1];

const DEGREES_TO_RADIANS = Math.PI / 180;

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: V3): V3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Project a world point through a pinhole camera built from the shot, and
 * report how far outside the frustum it lands. At most 1 is inside; anything
 * above 1 is clipped by that fraction.
 */
function frustumOvershoot(
  shot: InspectionShot,
  aspectRatio: number,
  point: V3
): number {
  const forward = normalize(sub(shot.target, shot.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);

  const offset = sub(point, shot.position);
  const depth = dot(offset, forward);
  if (depth <= 0) return Number.POSITIVE_INFINITY;

  const tanVertical = Math.tan((INSPECTION_FOV_DEG / 2) * DEGREES_TO_RADIANS);
  const tanHorizontal = Math.tan(Math.atan(tanVertical * aspectRatio));

  return Math.max(
    Math.abs(dot(offset, right)) / (depth * tanHorizontal),
    Math.abs(dot(offset, up)) / (depth * tanVertical)
  );
}

/** The wall grid the hands work in: a ring standing in front of the chest. */
function ringPoints(radius: number, samples = 72): V3[] {
  const height = -userProportionsState.groundY;
  return Array.from({ length: samples }, (_, index) => {
    const angle = (index / samples) * Math.PI * 2;
    return [
      Math.cos(angle) * radius,
      height + Math.sin(angle) * radius,
      STAGE.AVATAR_GRID_OFFSET,
    ] as V3;
  });
}

function viewById(id: string): InspectionView {
  const view = INSPECTION_VIEWS.find((candidate) => candidate.id === id);
  if (!view) throw new Error(`No inspection view ${id}`);
  return view;
}

const GRIP_VIEWS = INSPECTION_VIEWS.filter((view) => view.subject === "grip");

describe("staff-grip inspection framing", () => {
  it("keeps the whole hand ring in frame from every grip angle and pane shape", () => {
    const ring = ringPoints(userProportionsState.handPointRadius);

    for (const view of GRIP_VIEWS) {
      for (const aspectRatio of ASPECT_RATIOS) {
        const shot = inspectionShotForView(view, aspectRatio);
        const worst = Math.max(
          ...ring.map((point) => frustumOvershoot(shot, aspectRatio, point))
        );
        expect(
          worst,
          `${view.id} at aspect ${aspectRatio} clips the hand ring`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps the full staff sweep and the standing figure in the reference pane", () => {
    const view = viewById("audience");
    const sweep = [
      ...ringPoints(userProportionsState.outerPointRadius),
      [0, 0, 0] as V3, // the floor the performer stands on
    ];

    for (const aspectRatio of ASPECT_RATIOS) {
      const shot = inspectionShotForView(view, aspectRatio);
      const worst = Math.max(
        ...sweep.map((point) => frustumOvershoot(shot, aspectRatio, point))
      );
      expect(
        worst,
        `audience at aspect ${aspectRatio} clips the staff sweep`
      ).toBeLessThanOrEqual(1);
    }
  });

  it("frames from the performer's proportions alone, never from the pose", () => {
    // The lab's old cameras chased the palms and re-framed on every settle
    // frame. Nothing here takes a pose, so the same view and pane must always
    // solve to the same shot.
    for (const view of INSPECTION_VIEWS) {
      for (const aspectRatio of ASPECT_RATIOS) {
        expect(inspectionShotForView(view, aspectRatio)).toEqual(
          inspectionShotForView(view, aspectRatio)
        );
      }
    }
  });

  it("puts each eye in the quadrant its view describes", () => {
    const aspectRatio = 16 / 9;
    const eyes = new Map<string, InspectionShot>(
      INSPECTION_VIEWS.map((view) => [
        view.id,
        inspectionShotForView(view, aspectRatio),
      ])
    );

    for (const id of ["audience", "grip-front"]) {
      const shot = eyes.get(id)!;
      expect(shot.position[2], `${id} looks from the audience`).toBeGreaterThan(
        shot.target[2]
      );
      expect(Math.abs(shot.position[0] - shot.target[0])).toBeLessThan(0.01);
    }

    const quarter = eyes.get("grip-quarter")!;
    expect(quarter.position[0]).toBeGreaterThan(quarter.target[0] + 1);
    expect(quarter.position[2]).toBeGreaterThan(quarter.target[2]);

    const overhead = eyes.get("grip-overhead")!;
    const rise = overhead.position[1] - overhead.target[1];
    const run = Math.hypot(
      overhead.position[0] - overhead.target[0],
      overhead.position[2] - overhead.target[2]
    );
    expect(rise / run, "overhead looks steeply down").toBeGreaterThan(2);
  });

  it("holds the three grip panes to one magnification", () => {
    const aspectRatio = 16 / 9;
    const distances = GRIP_VIEWS.map((view) => {
      const shot = inspectionShotForView(view, aspectRatio);
      return Math.hypot(...(sub(shot.position, shot.target) as V3));
    });
    const spread = Math.max(...distances) / Math.min(...distances);
    expect(spread, "grip panes drifted apart in scale").toBeLessThan(1.3);

    const audience = inspectionShotForView(viewById("audience"), aspectRatio);
    const audienceDistance = Math.hypot(
      ...(sub(audience.position, audience.target) as V3)
    );
    expect(Math.max(...distances)).toBeLessThan(audienceDistance);
  });

  it("centres the grip subject between the body and the grid it works on", () => {
    // Targeting the grid plane alone slid the performer off-centre in the
    // off-axis panes; targeting the body alone did the same to the grid.
    const grip = gripSubject();
    expect(grip.center[2]).toBeGreaterThan(0);
    expect(grip.center[2]).toBeLessThan(STAGE.AVATAR_GRID_OFFSET);
    expect(grip.center[1]).toBeCloseTo(-userProportionsState.groundY, 6);
  });

  it("budgets a shoulder half-span past the outer ring for a side hold", () => {
    // A staff tip swings from a hand, and a hand hangs off a shoulder rather
    // than the body midline.
    const body = bodySubject();
    expect(body.halfWidth).toBeGreaterThan(
      userProportionsState.outerPointRadius + 0.2
    );
    expect(body.halfHeight * 2).toBeCloseTo(
      -userProportionsState.groundY + userProportionsState.outerPointRadius,
      6
    );
  });
});
