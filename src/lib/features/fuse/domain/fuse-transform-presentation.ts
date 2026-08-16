/**
 * How a Fuse follower transform presents itself: its glyph, and the LOOP
 * primitives it is built from.
 *
 * Every rule Fuse can apply to the follower path IS a LOOP transformation
 * primitive, and those primitives already carry brand colors that sequence
 * cards, export headers, and the Extend drawer all render. Fuse used to paint
 * all nine rules in one accent, so Mirror and Invert looked identical here
 * while looking nothing alike everywhere else.
 *
 * The color VALUES stay owned by loop-option-color.ts. This module only maps
 * Fuse's transform ids onto the primitives they compose.
 */

import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import {
  loopComponentColors,
  loopOptionTint,
} from "$lib/shared/components/loop-picker/loop-option-color";
import type { FuseTransformId } from "../state/fuse-state.svelte";

/**
 * Rotate 90 and Rotate 180 are both ROTATED; Mirror and Flip are each their own
 * reflection primitive. Sharing a hue across the two rotations is correct — one
 * primitive at two magnitudes — and the glyph plus label separates them.
 */
const TRANSFORM_COMPONENTS: Record<FuseTransformId, LOOPComponent[]> = {
  mirror: [LOOPComponent.MIRRORED],
  flip: [LOOPComponent.FLIPPED],
  rotate90: [LOOPComponent.ROTATED],
  rotate180: [LOOPComponent.ROTATED],
  invert: [LOOPComponent.INVERTED],
  rewind: [LOOPComponent.REWOUND],
  "rotate-mirror": [LOOPComponent.ROTATED, LOOPComponent.MIRRORED],
  "mirror-invert": [LOOPComponent.MIRRORED, LOOPComponent.INVERTED],
  "rotate-invert": [LOOPComponent.ROTATED, LOOPComponent.INVERTED],
};

/** FontAwesome class without the leading "fas". */
export const FUSE_TRANSFORM_ICONS: Record<FuseTransformId, string> = {
  mirror: "fa-left-right",
  flip: "fa-up-down",
  rotate90: "fa-rotate-right",
  rotate180: "fa-arrows-rotate",
  invert: "fa-circle-half-stroke",
  rewind: "fa-backward",
  "rotate-mirror": "fa-shuffle",
  "mirror-invert": "fa-code-compare",
  "rotate-invert": "fa-repeat",
};

const FALLBACK_ACCENT = "var(--theme-accent, #8b5cf6)";

/** Canonical-order colors for one transform. One entry, or two for a combo. */
export function fuseTransformColors(id: FuseTransformId): string[] {
  return loopComponentColors(TRANSFORM_COMPONENTS[id] ?? []);
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
