/**
 * Tunnel LOOKS — the curated kaleidoscope catalog.
 *
 * A look is the base sequence plus an explicit list of extra copies overlaid to
 * form the kaleidoscope. Each copy is an ordered chain of transform ops applied
 * to the base (see {@link CopyOp}). The base is ALWAYS drawn — the copy list
 * holds only the extras — so the on-screen prop count is exactly
 * `(copies.length + 1) * 2` (blue + red per copy). Nothing multiplies behind
 * your back.
 *
 * This replaces the old `fold` (rotational count) + `mirror` (boolean). Mirror
 * used to DOUBLE the whole rotational stack into the dihedral group Dₙ, so
 * `fold 2 + mirror` silently produced 4 copies (8 props) instead of the 2 the
 * user expected. Modeling each look as an explicit copy list makes every
 * symmetry a first-class peer and makes the density legible and hand-curated.
 *
 * The rotational family (formerly Duo / Pinwheel / Kaleidoscope — 2 / 4 / 8-fold)
 * is merged into ONE {@link DensitySpec density-tunable} "Radial" look whose arm
 * count is a tuner knob. Reflection/motion looks have no arm count to scale.
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

/**
 * A look whose copy list is generated from an arm count instead of being fixed.
 * When present, the Tunnel tuner shows a Density stepper with these options and
 * `copies` is ignored.
 */
export interface DensitySpec {
  /** Selectable arm counts. Grid = 8 points (45° steps), so 2/4/8 are the
   *  representable rotational folds (3/6-fold are not). */
  options: number[];
  default: number;
  /** This look supports a Mirror toggle — adds the dihedral reflection copies
   *  (rotational → the full Dₙ, the same structure as the Mandala tile). */
  mirrorable?: boolean;
  /** Arm-count ceiling while mirror is ON. Reflection doubles the copies, so a
   *  high arm count becomes visual mush + a perf tax (8 arms mirrored = 32 props). */
  maxMirrorArms?: number;
  /** Build the extra copies for a given arm count + mirror state. */
  build: (arms: number, withMirror: boolean) => CopyOp[][];
}

export interface TunnelLook {
  id: string;
  name: string;
  /** FontAwesome class for the selector glyph. */
  icon: string;
  /** Fixed extra copies. Ignored when `density` is set. */
  copies: CopyOp[][];
  /** Present on the tunable rotational look; drives copies from an arm count. */
  density?: DensitySpec;
}

// Shorthand builders keep the LOOKS table readable.
const rot = (amount: number): CopyOp => ({ kind: "rotate", amount });
const mirror: CopyOp = { kind: "mirror" };
const flip: CopyOp = { kind: "flip" };
const invert: CopyOp = { kind: "invert" };
const rewind: CopyOp = { kind: "rewind" };
// NOTE: the `colorSwap` op stays in the engine (valid CopyOp kind) but no
// shipped look uses it. colorSwap only recolors — it applies no spatial
// transform, so the copy lands exactly on top of the base (two staves in the
// same place). As a kaleidoscope "look" it reads as doing nothing, so the
// "Prism" candidate was cut after visual judging.

/** rotateSequence amounts (1 unit = 45°, base 0° excluded) for an arm count. */
function radialAmounts(arms: number): number[] {
  if (arms >= 8) return [1, 2, 3, 4, 5, 6, 7];
  if (arms >= 4) return [2, 4, 6];
  return [4];
}

/**
 * The look catalog. Curated by eye at `/test/tunnel-looks` — each entry earns
 * its slot by reading as a distinct, pretty kaleidoscope (per
 * effects-earn-their-slot: a look must uniquely visualize a symmetry no other
 * look covers). Ordered lightest → densest.
 */
export const LOOKS: TunnelLook[] = [
  // ── Rotational family, merged into one density-tunable look ──
  {
    id: "radial",
    name: "Radial",
    icon: "fas fa-fan",
    copies: [],
    density: {
      options: [2, 4, 8],
      default: 4,
      mirrorable: true,
      maxMirrorArms: 4,
      build: (arms, withMirror) => {
        const amts = radialAmounts(arms);
        const rots = amts.map((a) => [rot(a)]);
        if (!withMirror) return rots;
        // Dihedral Dₙ: rotations + the reflection + the reflection·rotations.
        // (base + this == the Mandala tile at 4 arms.)
        return [...rots, [mirror], ...amts.map((a) => [mirror, rot(a)])];
      },
    },
  },
  // ── Reflections (a single reflected copy, no doubling) ──
  { id: "mirror", name: "Mirror", icon: "fas fa-arrows-left-right", copies: [[mirror]] },
  { id: "flip", name: "Flip", icon: "fas fa-arrows-up-down", copies: [[flip]] },
  // ── Motion / temporal permutations (a single transformed copy) ──
  { id: "counter", name: "Counter", icon: "fas fa-arrows-spin", copies: [[invert]] },
  { id: "echo", name: "Echo", icon: "fas fa-backward", copies: [[rewind]] },
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

export const DEFAULT_LOOK_ID = "radial";
export const DEFAULT_DENSITY = 4;

export function getLook(id: string): TunnelLook | undefined {
  return LOOKS.find((l) => l.id === id);
}

/** The extra copies a look draws, resolving a density look at the given arm
 *  count (or its default) and mirror state. */
export function lookCopies(
  look: TunnelLook,
  density?: number,
  mirror = false,
): CopyOp[][] {
  if (look.density) return look.density.build(density ?? look.density.default, mirror);
  return look.copies;
}

/** On-screen prop count: base + copies, 2 props each. */
export function propCount(look: TunnelLook, density?: number, mirror = false): number {
  return (lookCopies(look, density, mirror).length + 1) * 2;
}

/**
 * Reduced-motion falls back to a calm, low-density look when the chosen one is
 * dense. A dense kaleidoscope spins a lot of props — too much for users who
 * asked for less motion. Applied on selection (see TunnelViewController), the
 * same way the old fold cap worked.
 */
export const REDUCED_MOTION_MAX_PROPS = 8;
export const REDUCED_MOTION_LOOK_ID = "mirror";
