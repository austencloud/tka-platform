/**
 * Synthetic risk fixtures — give the data-parity net teeth on the fields the
 * lean canonical `Motion` drops.
 *
 * The 2026-07-01 self-audit proved the production corpus carries ZERO
 * handPath/skewSteps/skewDir/pathShape values (934 seqs, 12,754 steps), so
 * every "0 drift" result was vacuous for exactly the fields the migration
 * puts at risk. These fixtures are deterministic mutations of real corpus
 * records that inject every risk field, in BOTH persistence shapes:
 *
 *  - COMPOSITIONAL (the publicSequences shape): soloProp steps carry
 *    handPath/skewSteps/skewDir/prefloat + a float ("fl" turns) step.
 *    pathShape cannot exist here — the decomposer never persists it.
 *  - INLINE-STEPS (the personal-library shape): a full `steps` blob whose
 *    motions carry pathShape (plus handPath/skew/float), with the
 *    compositional fields stripped so hydrate() takes the inline path.
 *
 * They are injected at --capture time and frozen into the snapshot like any
 *  real record, so check runs re-fingerprint them with zero extra machinery.
 * NEVER written to Firestore — snapshot-local only.
 */
import { hydrate } from "../../../src/lib/shared/foundation/services/sequence-hydrator";
import type { SequenceData } from "../../../src/lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "../../../src/lib/shared/foundation/domain/models/step-data";

type AnyRec = Record<string, unknown>;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Inject handPath/skew/float/prefloat into a soloProp's step list (in place). */
function injectSoloPropRiskFields(
  soloProp: AnyRec,
  hand: "left" | "right"
): void {
  const steps = soloProp["steps"] as AnyRec[];
  if (!steps || steps.length < 3)
    throw new Error("risk fixture needs >=3 solo steps");
  // step 0: skewed cw shift
  steps[0]!["handPath"] = "cw";
  steps[0]!["skewSteps"] = 1;
  steps[0]!["skewDir"] = "+";
  // step 1: skewed ccw shift, opposite skew direction
  steps[1]!["handPath"] = "ccw";
  steps[1]!["skewSteps"] = 2;
  steps[1]!["skewDir"] = "-";
  // step 2: float — turns "fl" + the prefloat metadata that must survive
  steps[2]!["motionType"] = "float";
  steps[2]!["turns"] = "fl";
  steps[2]!["rotationDirection"] = "noRotation";
  steps[2]!["prefloatMotionType"] = hand === "left" ? "pro" : "anti";
  steps[2]!["handPath"] = hand === "left" ? "cw" : "ccw";
}

/** Inject pathShape (+ the rest) into hydrated inline steps (in place). */
function injectInlineRiskFields(steps: StepData[]): void {
  if (steps.length < 3) throw new Error("risk fixture needs >=3 inline steps");
  const motion = (s: StepData, hand: "left" | "right"): AnyRec | undefined =>
    (s.motions as Record<string, AnyRec | undefined>)[hand];
  // step 0: pathShape only — isolates the downstream-blind field
  const left0 = motion(steps[0]!, "left");
  const right0 = motion(steps[0]!, "right");
  if (left0) left0["pathShape"] = "linear";
  if (right0) right0["pathShape"] = "concave";
  // step 1: pathShape + handPath + skew together
  for (const hand of ["left", "right"] as const) {
    const m = motion(steps[1]!, hand);
    if (!m) continue;
    m["pathShape"] = "arc";
    m["handPath"] = hand === "left" ? "cw" : "ccw";
    m["skewSteps"] = 1;
    m["skewDir"] = hand === "left" ? "+" : "-";
  }
  // step 2: float with prefloat metadata
  for (const hand of ["left", "right"] as const) {
    const m = motion(steps[2]!, hand);
    if (!m) continue;
    m["motionType"] = "float";
    m["turns"] = "fl";
    m["rotationDirection"] = "noRotation";
    m["prefloatMotionType"] = hand === "left" ? "pro" : "anti";
    m["handPath"] = "cw";
  }
}

/**
 * Build the synthetic records from real corpus records. Deterministic: same
 * input records -> byte-identical fixtures. Throws if no suitable base record
 * exists (a fixture the corpus can't support is a fixture that silently
 * doesn't guard — fail loudly instead).
 */
export function buildRiskFixtureRecords(
  reals: readonly SequenceData[]
): SequenceData[] {
  const compositionalBase = reals.find((r) => {
    const a = r as unknown as AnyRec;
    const left = a["leftSoloProp"] as AnyRec | undefined;
    const pairings = a["stepPairings"] as unknown[] | undefined;
    return (
      !!left &&
      Array.isArray(left["steps"]) &&
      (left["steps"] as unknown[]).length >= 3 &&
      !!pairings
    );
  });
  if (!compositionalBase)
    throw new Error("no compositional base record with >=3 steps");

  // ── fixture 1: compositional shape ──
  const comp = deepClone(compositionalBase) as unknown as AnyRec;
  comp["id"] = `${comp["id"]}__RISKFX_COMP`;
  comp["word"] = `${comp["word"] ?? "?"}__RISKFX_COMP`;
  injectSoloPropRiskFields(comp["leftSoloProp"] as AnyRec, "left");
  injectSoloPropRiskFields(comp["rightSoloProp"] as AnyRec, "right");

  // ── fixture 2: inline-steps shape (the only shape where pathShape exists) ──
  const hydrated = hydrate(deepClone(compositionalBase)) as SequenceData;
  if (!hydrated.steps || hydrated.steps.length < 3)
    throw new Error("base record failed to hydrate >=3 steps");
  const inlineSteps = deepClone(hydrated.steps) as StepData[];
  injectInlineRiskFields(inlineSteps);
  const inline = deepClone(compositionalBase) as unknown as AnyRec;
  inline["id"] = `${inline["id"]}__RISKFX_INLINE`;
  inline["word"] = `${inline["word"] ?? "?"}__RISKFX_INLINE`;
  inline["steps"] = inlineSteps;
  // strip compositional fields so hydrate() takes the inline-steps path
  delete inline["leftSoloProp"];
  delete inline["rightSoloProp"];
  delete inline["stepPairings"];

  return [comp, inline] as unknown as SequenceData[];
}
