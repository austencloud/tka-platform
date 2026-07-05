/**
 * deriveReversals — THE canonical reversal detector. Computes per-hand
 * reversal flags for a sequence of steps.
 *
 * TKA ground truth (MCP `get_term_definition("reversal")`, verified
 * 2026-07-05) defines three reversal types, all indicated by dots:
 *   - **hand reversal** — hand retraces its arc, prop continues its spin
 *     (switches pro/anti);
 *   - **prop reversal** — hand continues its arc, prop reverses its spin
 *     (switches pro/anti);
 *   - **full reversal** — both retrace (maintains pro/anti).
 *
 * A motion therefore carries TWO independent directional signals — prop
 * rotation (`rotationDirection`) and hand arc (locations / authored handPath,
 * see ./motion-signals.ts) — and a step is a reversal for a hand when EITHER
 * signal flips against that signal's last active value. The pre-2026-07-05
 * detectors compared only `rotationDirection`, which caught prop and full
 * reversals but was blind to hand reversals (false negatives; see
 * docs/superpowers/specs/active/2026-06-30-reversal-derivation-reconciliation-findings.md).
 *
 * Canonical semantics (adopted from the production app detector, which was
 * adversarially verified to emit zero false positives over the corpus):
 *   - **Loop wrap** (`options.loop`): a loop sequence is cyclic, so early
 *     steps look back through the tail — step 1's predecessor context includes
 *     the last step. Non-loop sequences never wrap.
 *   - **Transparent chains**: blank steps, static/dash (noRotation) motions,
 *     and arc-less motions do not break a signal's chain — the walk looks past
 *     them to the last ACTIVE value of the same signal. (The engine's previous
 *     "blank breaks the chain" behavior was drift from production, not
 *     design; the deck reversal system depends on parity with production.)
 *   - Each signal anchors independently: the prop anchor and the arc anchor
 *     may come from different prior steps.
 *   - A blank step and the start-position step (stepNumber 0) never flag and
 *     never anchor.
 *
 * The returned array is index-aligned with the input. Pure function.
 */

import {
  handArcDirection,
  propRotationDirection,
  type ArcDirection,
  type MotionSignalSource,
  type PropRotation,
} from "./motion-signals.js";

export interface StepReversals {
  readonly blue: boolean;
  readonly red: boolean;
}

export interface DeriveReversalsOptions {
  /**
   * Treat the sequence as cyclic (it has a loopType): early steps look back
   * through the tail of the sequence for their prior directions.
   */
  readonly loop?: boolean;
}

/**
 * Minimal structural step shape. Satisfied by the canonical `Step`
 * (tka-types), the engine's `SequenceStep`, and the app's `StepData`.
 */
export interface ReversalStepLike {
  readonly stepNumber?: number;
  readonly isBlank?: boolean;
  readonly motions?: {
    readonly blue?: MotionSignalSource | null;
    readonly red?: MotionSignalSource | null;
  } | null;
}

const NO_REVERSAL: StepReversals = Object.freeze({ blue: false, red: false });

interface HandSignals {
  readonly prop: PropRotation | null;
  readonly arc: ArcDirection | null;
}

const INERT: HandSignals = Object.freeze({ prop: null, arc: null });

/**
 * Compute reversal flags for each step. Pure function: no side effects.
 */
export function deriveReversals(
  steps: readonly ReversalStepLike[],
  options: DeriveReversalsOptions = {}
): ReadonlyArray<StepReversals> {
  const n = steps.length;
  const loop = options.loop === true;

  // Extract each hand's signals once. Blank steps and the start-position step
  // are inert: they never flag and never anchor.
  const blueSignals: HandSignals[] = new Array(n);
  const redSignals: HandSignals[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const step = steps[i]!;
    if (step.isBlank || step.stepNumber === 0) {
      blueSignals[i] = INERT;
      redSignals[i] = INERT;
      continue;
    }
    blueSignals[i] = signalsOf(step.motions?.blue);
    redSignals[i] = signalsOf(step.motions?.red);
  }

  const out: StepReversals[] = [];
  for (let i = 0; i < n; i++) {
    const step = steps[i]!;
    if (step.isBlank || step.stepNumber === 0) {
      out.push(NO_REVERSAL);
      continue;
    }
    const blue = flipsAgainstAnchor(blueSignals, i, loop);
    const red = flipsAgainstAnchor(redSignals, i, loop);
    out.push(
      blue || red ? Object.freeze({ blue, red }) : NO_REVERSAL
    );
  }

  return out;
}

function signalsOf(motion: MotionSignalSource | null | undefined): HandSignals {
  if (!motion) return INERT;
  return {
    prop: propRotationDirection(motion),
    arc: handArcDirection(motion),
  };
}

/**
 * True when either of the step's active signals flips against that signal's
 * last active value among its predecessors (cyclic when `loop`).
 */
function flipsAgainstAnchor(
  signals: ReadonlyArray<HandSignals>,
  i: number,
  loop: boolean
): boolean {
  const cur = signals[i]!;
  const propActive = cur.prop === "cw" || cur.prop === "ccw";
  const arcActive = cur.arc !== null;
  if (!propActive && !arcActive) return false;

  const n = signals.length;
  // Predecessor visit order matches production: i-1 … 0, then (loop only)
  // n-1 … i. The final self-visit is harmless — a self-anchor never differs.
  const maxVisits = loop ? n : i;

  let anchorProp: PropRotation | null = null;
  let anchorArc: ArcDirection | null = null;

  for (let v = 1; v <= maxVisits; v++) {
    const j = loop ? (i - v + n) % n : i - v;
    const prior = signals[j]!;
    if (
      propActive &&
      anchorProp === null &&
      (prior.prop === "cw" || prior.prop === "ccw")
    ) {
      anchorProp = prior.prop;
    }
    if (arcActive && anchorArc === null && prior.arc !== null) {
      anchorArc = prior.arc;
    }
    const stillNeedProp = propActive && anchorProp === null;
    const stillNeedArc = arcActive && anchorArc === null;
    if (!stillNeedProp && !stillNeedArc) break;
  }

  return (
    (anchorProp !== null && anchorProp !== cur.prop) ||
    (anchorArc !== null && anchorArc !== cur.arc)
  );
}
