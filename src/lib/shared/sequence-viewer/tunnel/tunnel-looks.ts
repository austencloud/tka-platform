/**
 * Tunnel LOOKS — the curated kaleidoscope catalog.
 *
 * A look is the base sequence plus an explicit list of extra copies overlaid to
 * form the kaleidoscope. Each copy is an ordered chain of transform ops applied
 * to the base (see {@link CopyOp}). The base is ALWAYS drawn — `copies` lists
 * only the extras — so the on-screen prop count is exactly
 * `(copies.length + 1) * 2` (blue + red per copy). Nothing multiplies behind
 * your back.
 *
 * This replaces the old `fold` (rotational count) + `mirror` (boolean). Mirror
 * used to DOUBLE the whole rotational stack into the dihedral group Dₙ, so
 * `fold 2 + mirror` silently produced 4 copies (8 props) instead of the 2 the
 * user expected — mirror was a multiplier stacked on top of fold, not a peer
 * permutation. Modeling each look as an explicit copy list makes every symmetry
 * a first-class peer and makes the density legible and hand-curated.
 */

/**
 * One transform applied to the base to produce a copy. Ops compose in order
 * (rotate-then-mirror ≠ mirror-then-rotate), so a copy is an ordered chain.
 * Every kind maps 1:1 to an existing function in `sequence-transforms.ts` — the
 * look engine adds no new transform math.
 */
export type CopyOp =
  | { kind: "rotate"; amount: number } // 45° units (1 = 45°) → rotateSequence
  | { kind: "mirror" } //                 reflection across the vertical axis → mirrorSequence
  | { kind: "flip" } //                   reflection N↔S (horizontal axis) → flipSequence
  | { kind: "invert" } //                 PRO↔ANTI + CW↔CCW (counter-rotation) → invertSequence
  | { kind: "colorSwap" } //              blue↔red (reads only with spectrum off) → colorSwapSequence
  | { kind: "rewind" }; //                time-reversed copy → rewindSequence

export interface TunnelLook {
  id: string;
  name: string;
  /** FontAwesome class for the selector glyph. */
  icon: string;
  /** Extra copies overlaid on the always-drawn base, in overlay order. */
  copies: CopyOp[][];
}

/** On-screen prop count for a look: base + copies, 2 props each. */
export function propCount(look: TunnelLook): number {
  return (look.copies.length + 1) * 2;
}

// Shorthand builders keep the LOOKS table readable.
const rot = (amount: number): CopyOp => ({ kind: "rotate", amount });
const mirror: CopyOp = { kind: "mirror" };
const flip: CopyOp = { kind: "flip" };
const invert: CopyOp = { kind: "invert" };
const colorSwap: CopyOp = { kind: "colorSwap" };
const rewind: CopyOp = { kind: "rewind" };

/**
 * The look catalog. Curated by eye at `/test/tunnel-looks` — each entry earns
 * its slot by reading as a distinct, pretty kaleidoscope (per
 * effects-earn-their-slot: a look must uniquely visualize a symmetry no other
 * look covers). Ordered lightest → densest.
 */
export const LOOKS: TunnelLook[] = [
  // ── Reflections (the new peers — a single reflected copy, no doubling) ──
  { id: "mirror", name: "Mirror", icon: "fas fa-arrows-left-right", copies: [[mirror]] },
  { id: "flip", name: "Flip", icon: "fas fa-arrows-up-down", copies: [[flip]] },
  // ── Motion / temporal / color permutations (a single transformed copy) ──
  { id: "counter", name: "Counter", icon: "fas fa-arrows-spin", copies: [[invert]] },
  { id: "echo", name: "Echo", icon: "fas fa-backward", copies: [[rewind]] },
  { id: "prism", name: "Prism", icon: "fas fa-palette", copies: [[colorSwap]] },
  // ── Rotational (the old fold, now explicit) ──
  { id: "duo", name: "Duo", icon: "fas fa-circle-half-stroke", copies: [[rot(4)]] },
  { id: "pinwheel", name: "Pinwheel", icon: "fas fa-fan", copies: [[rot(2)], [rot(4)], [rot(6)]] },
  {
    id: "kaleido",
    name: "Kaleidoscope",
    icon: "fas fa-snowflake",
    copies: [[rot(1)], [rot(2)], [rot(3)], [rot(4)], [rot(5)], [rot(6)], [rot(7)]],
  },
  // ── Compositions (curated dense mandalas) ──
  { id: "cross", name: "Cross", icon: "fas fa-plus", copies: [[mirror], [flip], [rot(4)]] },
  {
    id: "mandala",
    name: "Mandala",
    icon: "fas fa-asterisk",
    copies: [
      [rot(2)],
      [rot(4)],
      [rot(6)],
      [mirror],
      [mirror, rot(2)],
      [mirror, rot(4)],
      [mirror, rot(6)],
    ],
  },
];

export const DEFAULT_LOOK_ID = "pinwheel";

export function getLook(id: string): TunnelLook | undefined {
  return LOOKS.find((l) => l.id === id);
}

/**
 * Reduced-motion falls back to a calm, low-density look when the chosen one is
 * dense. A dense kaleidoscope spins a lot of props — too much for users who
 * asked for less motion. Applied on selection (see TunnelViewController.setLook),
 * mirroring how the old fold cap worked.
 */
export const REDUCED_MOTION_MAX_PROPS = 8;
export const REDUCED_MOTION_LOOK_ID = "mirror";
