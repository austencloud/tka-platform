/**
 * The controlled body set the staff-grip lab sweeps.
 *
 * The shipped catalog varies every dimension at once, so when a rig fails the
 * hug fit there is no way to say whether the cause was stature, arm length or
 * shoulder span. Measuring the twelve deployed rigs makes that concrete: four
 * of them already fail, and their stature/reach/shoulder numbers move together
 * with no isolated variable between any two of them.
 *
 * This set fixes that. One body is the median. Every other body changes
 * exactly one thing about it, so a failure names its own cause.
 *
 * The multipliers are deliberate rather than random: each is far enough from
 * 1.0 to move the fit past a decision boundary, and close enough to stay
 * inside believable human variation for the base rig.
 */

/**
 * The base is a shipped catalog rig, not a generated one.
 *
 * `ch12` sits at the catalog median for reach (48.91 cm, the middle of the
 * twelve) with a near-median shoulder span, and it passes the hug fit with
 * only ~1 cm of margin. Centring the sweep there means both a widening and a
 * narrowing cross a real decision boundary rather than exercising one side.
 *
 * Its licence is whatever already covers the deployed catalog, so nothing in
 * this sweep introduces a new rights question. See
 * `docs/reference/human-generator-license-finding.md` for why the Human
 * Generator trial content could not be the base.
 */
export const SWEEP_BASE = {
  characterId: "ch12",
  modelPath: "static/models/avatars/_optimized/ch12.glb",
};

/** Where the generated bodies land. That tree is gitignored in full. */
export const SWEEP_OUTPUT_DIRECTORY = "static/models/avatars/proportion-sweep";

const NEUTRAL = {
  statureScale: 1,
  shoulderWidthScale: 1,
  upperArmScale: 1,
  forearmScale: 1,
  torsoGirthScale: 1,
};

/**
 * @typedef {object} SweepBody
 * @property {string} id             Stable fixture id, also the GLB filename.
 * @property {string} name           Picker label.
 * @property {string} axis           The single dimension this body moves.
 * @property {string} rationale      What a failure on this body would prove.
 * @property {object} params         Multipliers handed to the Blender stage.
 */

/** @type {readonly SweepBody[]} */
export const SWEEP_BODIES = [
  {
    id: "sweep-median",
    name: "Median",
    axis: "none",
    rationale:
      "The control. Every other body is this one with a single dimension moved.",
    params: { ...NEUTRAL },
  },
  {
    id: "sweep-stature-short",
    name: "Stature short",
    axis: "stature",
    rationale:
      "Uniform 0.90 scale. Segment ratios are untouched, so the fit should scale linearly rather than change character.",
    params: { ...NEUTRAL, statureScale: 0.9 },
  },
  {
    id: "sweep-stature-tall",
    name: "Stature tall",
    axis: "stature",
    rationale:
      "Uniform 1.10 scale. Pairs with the short body to show absolute size alone is not what breaks the solve.",
    params: { ...NEUTRAL, statureScale: 1.1 },
  },
  {
    id: "sweep-shoulders-narrow",
    name: "Shoulders narrow",
    axis: "shoulderWidth",
    rationale:
      "Arm-chain roots drawn in to 0.85 span with reach held constant. Isolates shoulder span from every other dimension.",
    params: { ...NEUTRAL, shoulderWidthScale: 0.85 },
  },
  {
    id: "sweep-shoulders-broad",
    name: "Shoulders broad",
    axis: "shoulderWidth",
    rationale:
      "Arm-chain roots pushed out to 1.15 span with reach held constant. The hug lane and the derived torso depth both widen while the arms stay the same length.",
    params: { ...NEUTRAL, shoulderWidthScale: 1.15 },
  },
  {
    id: "sweep-arms-short",
    name: "Arms short",
    axis: "armLength",
    rationale:
      "Both arm segments at 0.88 with stature and shoulder span fixed. Isolates arm length relative to stature.",
    params: { ...NEUTRAL, upperArmScale: 0.88, forearmScale: 0.88 },
  },
  {
    id: "sweep-arms-long",
    name: "Arms long",
    axis: "armLength",
    rationale:
      "Both arm segments at 1.12 with stature and shoulder span fixed. Pairs with the short-arm body across the fit boundary.",
    params: { ...NEUTRAL, upperArmScale: 1.12, forearmScale: 1.12 },
  },
  {
    id: "sweep-arms-elbow-high",
    name: "Arms, elbow high",
    axis: "armSegmentRatio",
    rationale:
      "Long upper arm, short forearm, total reach held at the median. The solve consumes only the sum, so this body should measure a different elbow and an identical fit. A changed fit here would mean the solve is reading something it does not declare.",
    params: { ...NEUTRAL, upperArmScale: 1.25, forearmScale: 0.6928 },
  },
  {
    id: "sweep-build-slight",
    name: "Build slight",
    axis: "torsoGirth",
    rationale:
      "Chest thinned to 0.88. The solve derives torso depth from shoulder width rather than measuring the body, so this should not move the fit at all.",
    params: { ...NEUTRAL, torsoGirthScale: 0.88 },
  },
  {
    id: "sweep-build-heavy",
    name: "Build heavy",
    axis: "torsoGirth",
    rationale:
      "Chest thickened to 1.20. Pairs with the slight build to demonstrate that a visibly deeper torso is invisible to the current staff fit.",
    params: { ...NEUTRAL, torsoGirthScale: 1.2 },
  },
];

/** Multipliers that actually differ from the median, for reporting. */
export function activeParameters(body) {
  return Object.fromEntries(
    Object.entries(body.params).filter(([, value]) => value !== 1)
  );
}
