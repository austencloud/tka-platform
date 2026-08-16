/**
 * The Drowned Gallery graybox's collision scaffold.
 *
 * The regression this exists for: ramps used to be emitted as stacks of
 * 0.35 m steps. That riser sits close enough to the walker's 0.45 m auto-step
 * that Rapier's step-up loses to the gravity term in the same frame, and the
 * player sticks against a riser until they jump — which is exactly what
 * happened surfacing out of the flooded gallery, the one beat in the room that
 * has to be an unbroken walk up into the air.
 *
 * Ramps are now single tilted slabs whose TOP FACE is the ramp line, so the
 * joins with the flats above and below are flush and there is no riser at all.
 * These tests assert that property directly rather than asserting a step size.
 */
import { describe, it, expect } from "vitest";
import { buildDrownedGalleryWalkSetup } from "../../../src/routes/test/drowned-gallery-graybox/drowned-gallery-graybox-colliders";

const setup = buildDrownedGalleryWalkSetup();
const { colliders, origin, layout } = setup;

type Vec3 = [number, number, number];

/** Rotate a vector by a quaternion. */
function rotate(
  q: { x: number; y: number; z: number; w: number },
  v: Vec3
): Vec3 {
  const { x, y, z, w } = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

/**
 * The two ends of a ramp slab's top face, back in plan coordinates.
 * `low` is the end at the rect's minimum along the run axis.
 */
function topFaceEnds(id: string, alongZ: boolean) {
  const collider = colliders.find((c) => c.id === id);
  if (!collider) throw new Error(`collider "${id}" is missing`);
  if (!collider.rotation) throw new Error(`collider "${id}" is not tilted`);
  const half: Vec3 = [
    collider.size[0] / 2,
    collider.size[1] / 2,
    collider.size[2] / 2,
  ];
  const axis = alongZ ? 2 : 0;
  const end = (sign: number) => {
    const local: Vec3 = [0, half[1], 0];
    local[axis] = sign * half[axis];
    const r = rotate(collider.rotation!, local);
    return {
      x: collider.position[0] + r[0] + origin.x,
      y: collider.position[1] + r[1],
      z: collider.position[2] + r[2] + origin.z,
    };
  };
  return { low: end(-1), high: end(1) };
}

describe("drowned gallery graybox colliders", () => {
  it("emits no stepped ramps at all", () => {
    expect(colliders.filter((c) => c.id.includes("-step-"))).toEqual([]);
  });

  it("gives every ramp exactly one tilted slab", () => {
    const ramps = layout.floorRects.filter((floor) => floor.kind !== "flat");
    expect(ramps.length).toBeGreaterThan(0);
    for (const floor of ramps) {
      const matches = colliders.filter(
        (c) => c.id === `floor-${floor.id}` && c.rotation
      );
      expect(matches, `ramp "${floor.id}"`).toHaveLength(1);
    }
  });

  it("lands each ramp's top face flush on its declared endpoints", () => {
    for (const floor of layout.floorRects) {
      if (floor.kind === "flat") continue;
      const alongZ = floor.kind === "ramp-z";
      const { low, high } = topFaceEnds(`floor-${floor.id}`, alongZ);

      // fromY sits at the rect's minimum along the run axis, toY at its maximum.
      expect(low.y, `${floor.id} low end elevation`).toBeCloseTo(floor.fromY, 6);
      expect(high.y, `${floor.id} high end elevation`).toBeCloseTo(floor.toY, 6);

      const lowAt = alongZ ? low.z : low.x;
      const highAt = alongZ ? high.z : high.x;
      const wantLow = alongZ ? floor.rect.minZ : floor.rect.minX;
      const wantHigh = alongZ ? floor.rect.maxZ : floor.rect.maxX;
      // The slab must occupy the ramp's footprint exactly - no overhang into
      // the flat above, no gap short of the flat below.
      expect(lowAt, `${floor.id} low end position`).toBeCloseTo(wantLow, 6);
      expect(highAt, `${floor.id} high end position`).toBeCloseTo(wantHigh, 6);
    }
  });

  it("leaves no riser where the surfacing stair meets the flats it joins", () => {
    // The exit walk: gallery floor -> lower flight -> landing -> upper flight
    // -> the corridor at causeway level. Every junction must be flush.
    const flatTop = (id: string) => {
      const floor = layout.floorRects.find((f) => f.id === id);
      if (!floor) throw new Error(`floor "${id}" is missing`);
      expect(floor.kind).toBe("flat");
      return floor.fromY;
    };

    const lower = topFaceEnds("floor-surfacing-lower", true);
    const upper = topFaceEnds("floor-surfacing-upper", true);
    const landing = flatTop("surfacing-landing");
    const corridor = flatTop("gallery-corridor-0");

    expect(lower.high.y).toBeCloseTo(flatTop("east-bend"), 6);
    expect(lower.low.y).toBeCloseTo(landing, 6);
    expect(upper.high.y).toBeCloseTo(landing, 6);
    expect(upper.low.y).toBeCloseTo(corridor, 6);
  });
});
