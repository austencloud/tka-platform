/**
 * How a Fuse follower transform presents itself: its glyph, and the LOOP
 * primitives it is built from.
 *
 * Every rule Fuse can apply to the follower path IS a LOOP transformation
 * primitive, and those primitives already carry brand colors and glyphs that
 * sequence cards, export headers, and the Extend drawer all render. Fuse used
 * to paint all nine rules in one accent, so Mirror and Invert looked identical
 * here while looking nothing alike everywhere else.
 *
 * The color VALUES and the glyphs stay owned by loop-option-color.ts and
 * LOOPIconStrip. This module only maps Fuse's transform ids onto the
 * primitives they compose, and onto the two modifiers the icon strip needs to
 * tell same-colour primitives apart — the reflection axis (Mirror vs Flip) and
 * the rotation period (Rotate 90 vs Rotate 180).
 */

import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { LoopReflectionAxis } from "@tka/render-composition";
import {
  loopComponentColors,
  loopOptionTint,
} from "$lib/shared/components/loop-picker/loop-option-color";
import type { FuseTransformId } from "../state/fuse-state.svelte";

/** Everything LOOPIconStrip needs to draw one transform the canonical way. */
export interface FuseTransformGlyph {
  components: Set<LOOPComponent>;
  reflectionAxis?: LoopReflectionAxis;
  rotationPeriod?: Period;
}

/**
 * Mirror and Flip are both reflections and share `#6F2DA8`; the icon strip
 * separates them by rotating the arrow to the axis. Rotate 90 and Rotate 180
 * are both ROTATED; the strip separates them by period (fa-arrows-spin vs
 * fa-rotate). Passing those modifiers here is what makes these nine rules read
 * as the same objects the rest of the app already draws.
 */
const TRANSFORM_GLYPHS: Record<FuseTransformId, FuseTransformGlyph> = {
  mirror: {
    components: new Set([LOOPComponent.MIRRORED]),
    reflectionAxis: "north-south",
  },
  flip: {
    components: new Set([LOOPComponent.FLIPPED]),
    reflectionAxis: "east-west",
  },
  rotate90: {
    components: new Set([LOOPComponent.ROTATED]),
    rotationPeriod: Period.QUARTERED,
  },
  rotate180: {
    components: new Set([LOOPComponent.ROTATED]),
    rotationPeriod: Period.HALVED,
  },
  invert: { components: new Set([LOOPComponent.INVERTED]) },
  rewind: { components: new Set([LOOPComponent.REWOUND]) },
  "rotate-mirror": {
    components: new Set([LOOPComponent.ROTATED, LOOPComponent.MIRRORED]),
    reflectionAxis: "north-south",
    rotationPeriod: Period.QUARTERED,
  },
  "mirror-invert": {
    components: new Set([LOOPComponent.MIRRORED, LOOPComponent.INVERTED]),
    reflectionAxis: "north-south",
  },
  "rotate-invert": {
    components: new Set([LOOPComponent.ROTATED, LOOPComponent.INVERTED]),
    rotationPeriod: Period.QUARTERED,
  },
};

const FALLBACK_GLYPH: FuseTransformGlyph = {
  components: new Set<LOOPComponent>(),
};
const FALLBACK_ACCENT = "var(--theme-accent, #8b5cf6)";

/** The canonical LOOP glyph for one transform, ready for LOOPIconStrip. */
export function fuseTransformGlyph(id: FuseTransformId): FuseTransformGlyph {
  return TRANSFORM_GLYPHS[id] ?? FALLBACK_GLYPH;
}

/** Canonical-order colors for one transform. One entry, or two for a combo. */
export function fuseTransformColors(id: FuseTransformId): string[] {
  return loopComponentColors(fuseTransformGlyph(id).components);
}

/** The accent a single-color surface (a token, a glyph) should paint. */
export function fuseTransformAccent(id: FuseTransformId): string {
  return fuseTransformColors(id)[0] ?? FALLBACK_ACCENT;
}

/**
 * The second stop for a combo, or the same color again for a primitive — the
 * caller decides whether to sweep between them.
 */
export function fuseTransformAccent2(id: FuseTransformId): string {
  const colors = fuseTransformColors(id);
  return colors[colors.length - 1] ?? FALLBACK_ACCENT;
}

/**
 * `--loop-c1/--loop-c2/--loop-c2-mix` for a transform, in the same shape the
 * LOOP option buttons consume, so a Fuse surface can reuse that styling.
 */
export function fuseTransformTint(id: FuseTransformId): string {
  return loopOptionTint(fuseTransformColors(id));
}
