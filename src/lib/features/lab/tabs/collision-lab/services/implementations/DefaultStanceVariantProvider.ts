/**
 * DefaultStanceVariantProvider
 *
 * Phase 1 stance variants. Foot IK is currently disabled in the avatar
 * system, so variants only adjust things we can actually change today:
 * root yaw and spine pitch. The feet stay at their default Mixamo idle
 * positions. When proper leg IK lands, foot-placement variants can be
 * added here without any schema change.
 */

import type { IStanceVariantProvider } from "../contracts/IStanceVariantProvider";
import type { StanceVariant } from "../../domain/types";

const DEG = Math.PI / 180;

const VARIANTS: StanceVariant[] = [
  {
    index: 0,
    description: "Neutral",
    rootYawRad: 0,
    spinePitchRad: 0,
  },
  {
    index: 1,
    description: "Leaned forward",
    rootYawRad: 0,
    spinePitchRad: 10 * DEG,
  },
  {
    index: 2,
    description: "Rotated left",
    rootYawRad: 15 * DEG,
    spinePitchRad: 0,
  },
  {
    index: 3,
    description: "Rotated right",
    rootYawRad: -15 * DEG,
    spinePitchRad: 0,
  },
];

export class DefaultStanceVariantProvider implements IStanceVariantProvider {
  getAll(): StanceVariant[] {
    return VARIANTS;
  }

  getVariant(index: number): StanceVariant {
    const clamped = Math.max(0, Math.min(index, VARIANTS.length - 1));
    return VARIANTS[clamped];
  }

  count(): number {
    return VARIANTS.length;
  }
}
