/**
 * DefaultStanceVariantProvider
 *
 * Phase 1 stance variants: where on the FLOOR the performer stands
 * relative to the grid center. These are the "safe zones" the reviewer
 * is cataloging — the literal positions a performer would step to in
 * order to avoid colliding with themselves while reaching the prop
 * targets fixed at the grid points.
 *
 * The avatar root is translated by (footOffsetX, footOffsetZ). Because
 * foot IK is disabled, translating the root moves the entire body as a
 * rigid unit — feet, hips, torso, head. Props stay at their fixed grid
 * world positions, so the arms solve against the same targets from a
 * different body location. Different body locations → different
 * shoulder positions → different arm routing → some poses stop colliding.
 *
 * The grid is 3×3 at 30cm spacing. Positive X = performer's right,
 * positive Z = toward audience (away from grid, toward camera).
 *
 * Index layout (facing the grid, performer's perspective):
 *
 *   [6 NW] [7 N] [8 NE]      ← behind grid (−Z)
 *   [3 W ] [0 C] [4 E ]      ← grid plane (Z=0)
 *   [5 SW] [1 S] [2 SE]      ← toward audience (+Z)
 *
 * Rotation values are 0 for all variants in Phase 1 — the reviewer can
 * evaluate whether "just stepping" solves the collision before we layer
 * in body-rotation and spine-pitch variants on top.
 */

import type { IStanceVariantProvider } from "../contracts/IStanceVariantProvider";
import type { StanceVariant } from "../../domain/types";

const STEP = 0.3; // 30 cm step distance

const VARIANTS: StanceVariant[] = [
  {
    index: 0,
    description: "Center",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: 0,
    footOffsetZ: 0,
  },
  {
    index: 1,
    description: "Step back (toward audience)",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: 0,
    footOffsetZ: STEP,
  },
  {
    index: 2,
    description: "Step back-right",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: STEP,
    footOffsetZ: STEP,
  },
  {
    index: 3,
    description: "Step right",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: STEP,
    footOffsetZ: 0,
  },
  {
    index: 4,
    description: "Step right-forward",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: STEP,
    footOffsetZ: -STEP,
  },
  {
    index: 5,
    description: "Step forward (into grid)",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: 0,
    footOffsetZ: -STEP,
  },
  {
    index: 6,
    description: "Step forward-left",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: -STEP,
    footOffsetZ: -STEP,
  },
  {
    index: 7,
    description: "Step left",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: -STEP,
    footOffsetZ: 0,
  },
  {
    index: 8,
    description: "Step left-back",
    rootYawRad: 0,
    spinePitchRad: 0,
    footOffsetX: -STEP,
    footOffsetZ: STEP,
  },
];

export class DefaultStanceVariantProvider implements IStanceVariantProvider {
  getAll(): StanceVariant[] {
    return VARIANTS;
  }

  getVariant(index: number): StanceVariant {
    const clamped = Math.max(0, Math.min(index, VARIANTS.length - 1));
    return VARIANTS[clamped]!;
  }

  count(): number {
    return VARIANTS.length;
  }
}
