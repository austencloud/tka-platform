import { PropType } from "@austencloud/scene-3d";
import { propTipEnds } from "$lib/shared/pictograph/prop/domain/prop-tip-ends";
import { getTipPointsBaseline } from "$lib/shared/animation-engine/domain/types/prop-tip-points";

/**
 * Where a prop's tracked effect emitters sit along its own axis, in 3D.
 *
 * The 3D tip bridge used to place two emitters at +/- staffHalfLength for every
 * prop, which is only true of the staff family. A club has ONE tip: the cap.
 * Tracking a phantom second end put a whole flame (or LED, or charcoal plume)
 * about 43cm behind the hand, out the back of the knob, where the club does not
 * exist. Every single-ended prop had the same phantom.
 *
 * How many ends a prop presents is already owned by `propTipEnds()` — the same
 * authority the 2D trail overlays, the trail capturer and the mandala use — so
 * this module answers only the 3D-specific half: WHERE along the prop's axis
 * each tracked tip lands, in metres.
 *
 * Effect-slot ordering follows the canonical 2D convention: tip 0 is the
 * pinky/LEFT_END slot, tip 1 is the thumb/RIGHT_END slot. A single-ended prop
 * keeps slot 1 — the same slot `trail-capturer.ts` gives it — so a saved
 * per-tip effect assignment means the same thing in 2D and 3D.
 */
export interface PropTipAnchor3D {
  /** Effect-assignment slot: 0 = pinky/left end, 1 = thumb/right end. */
  readonly effectTipIndex: 0 | 1;
  /**
   * Signed offset from the prop's pivot along its local +Y axis, in metres.
   * The pivot is the hand for every prop the 3D scene draws.
   */
  readonly axialOffset: number;
}

/** `Prop3D.svelte` renders every "big" procedural variant at this scale. */
const BIG_SCALE = 1.4;

/**
 * Hand to the top of the cap, in metres — `club-profile.ts` `CLUB_REACH_M`.
 * A club is a standardized 52cm object, so unlike the staff family its reach is
 * absolute and does NOT scale with the user's staff length. The value is copied
 * rather than imported because the props package does not export it.
 */
const CLUB_REACH_M = 0.50343;

/** Hand to the top of the wick, as a fraction of staff length — `torch-profile.ts` `TORCH_REACH`. */
const TORCH_REACH_RATIO = 0.59335;

/**
 * Hand to the blade apex, as a fraction of staff length. `Sword3D.svelte`
 * stacks blade sections on a blade of 0.8 x staffLength: lower 60%, upper 35%,
 * tip cone 8%, so the apex lands at 0.8 x 1.03.
 */
const SWORD_REACH_RATIO = 0.824;

/**
 * Hand to the far rim, as a fraction of staff length — the outer contour of
 * `fan-profile.ts`, whose coordinates are already normalized to the staff's
 * drawn span and whose reach axis is +Y.
 */
const FAN_REACH_RATIO = 0.50831;

/**
 * Hand to the far rim, as a fraction of staff length. `Hoop3D.svelte` grips the
 * BOTTOM of the ring and offsets the torus centre up by one ring radius
 * (0.35 x staffLength), so the far rim sits at two radii.
 */
const HOOP_REACH_RATIO = 0.7;

/** Hand to an arm end, as a fraction of staff length — `triad-frame.ts` `TRIAD_ARM_LENGTH`. */
const TRIAD_REACH_RATIO = 0.44707;

/**
 * Single-ended props whose 3D mesh reaches somewhere other than half a staff.
 * Keyed by prop type, valued in metres given the staff length in metres.
 *
 * A prop absent from this table falls back to `staffHalfLength`. That is the
 * honest default for the GLTF-backed props (chicken, guitar, ukulele, trigeng)
 * whose reach lives in a .glb rather than in a number anyone can cite, and for
 * poi, whose ball centre lands within a centimetre of half a staff anyway.
 */
const SINGLE_ENDED_REACH_3D: Partial<
  Record<PropType, (staffLength: number) => number>
> = {
  [PropType.CLUB]: () => CLUB_REACH_M,

  [PropType.TORCH]: (staffLength) => staffLength * TORCH_REACH_RATIO,
  [PropType.BIGTORCH]: (staffLength) =>
    staffLength * TORCH_REACH_RATIO * BIG_SCALE,

  [PropType.SWORD]: (staffLength) => staffLength * SWORD_REACH_RATIO,

  [PropType.FAN]: (staffLength) => staffLength * FAN_REACH_RATIO,
  [PropType.BIGFAN]: (staffLength) =>
    staffLength * FAN_REACH_RATIO * BIG_SCALE,

  [PropType.MINIHOOP]: (staffLength) => staffLength * HOOP_REACH_RATIO,
  [PropType.BIGHOOP]: (staffLength) =>
    staffLength * HOOP_REACH_RATIO * BIG_SCALE,

  [PropType.TRIAD]: (staffLength) => staffLength * TRIAD_REACH_RATIO,
  [PropType.BIGTRIAD]: (staffLength) =>
    staffLength * TRIAD_REACH_RATIO * BIG_SCALE,
  // Quiad renders through Triad3D, so it inherits the triad's arm.
  [PropType.QUIAD]: (staffLength) => staffLength * TRIAD_REACH_RATIO,
};

/**
 * Prop types the 3D scene draws with bilateral geometry but the 2D registry
 * has no entry for. `fractalgeng` exists only in the scene package's enum and
 * renders through `Buugeng3D`, which is point-symmetric; without this it would
 * fall through to `propTipEnds()`'s single-ended default and lose an end.
 */
const TWO_ENDED_3D_ONLY: ReadonlySet<string> = new Set([PropType.FRACTALGENG]);

function isTwoEnded3D(propType: string | undefined): boolean {
  if (propType && TWO_ENDED_3D_ONLY.has(propType)) return true;
  return propTipEnds(propType) === 2;
}

/**
 * Reach of a single-ended prop's one tracked tip, in metres.
 *
 * Props with no tip points at all (contact ball, hand) emit from the pivot
 * itself: the ball IS the prop, and a hand has nothing sticking out of it.
 */
function singleEndedReach3D(
  propType: string | undefined,
  staffHalfLength: number
): number {
  if (getTipPointsBaseline(propType).points.length === 0) return 0;

  const reach = propType
    ? SINGLE_ENDED_REACH_3D[propType as PropType]
    : undefined;
  return reach ? reach(staffHalfLength * 2) : staffHalfLength;
}

/**
 * The tracked effect emitters for a prop, in effect-slot order.
 *
 * Two-ended props keep the staff-family pair at +/- staffHalfLength. Everything
 * else returns exactly one anchor, on slot 1.
 */
export function resolvePropTipAnchors3D(
  propType: string | undefined,
  staffHalfLength: number
): PropTipAnchor3D[] {
  if (isTwoEnded3D(propType)) {
    return [
      { effectTipIndex: 0, axialOffset: -staffHalfLength },
      { effectTipIndex: 1, axialOffset: staffHalfLength },
    ];
  }

  return [
    {
      effectTipIndex: 1,
      axialOffset: singleEndedReach3D(propType, staffHalfLength),
    },
  ];
}

/** Stable identity for an anchor set, so a prop swap can drop stale velocity history. */
export function propTipAnchorSignature3D(
  anchors: readonly PropTipAnchor3D[]
): string {
  return anchors
    .map((anchor) => `${anchor.effectTipIndex}@${anchor.axialOffset.toFixed(5)}`)
    .join("|");
}
