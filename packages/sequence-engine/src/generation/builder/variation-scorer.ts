/**
 * Variation Scorer
 *
 * Scores candidate variations against a set of constraints.
 * Used by the constrained builder to rank variations during beam search.
 */

import { ConstraintType } from "../constraints/constraint-types.js";
import type {
  IConstraint,
  IVariationConstraint,
  ConstraintContext,
  ConstraintSet,
  VariationScore,
  PictographData,
  ConstraintScore,
} from "../constraints/types.js";

export function scoreVariation(
  candidate: PictographData,
  variationIndex: number,
  context: Omit<ConstraintContext, "candidate">,
  constraintSet: ConstraintSet
): VariationScore {
  // `letter` has to name the candidate being scored, not whatever the caller
  // put in the shared context. When the search is following a word every
  // candidate is a variation of the same letter and the two agree, but free
  // generation scores a mixed batch in one call and passes the first
  // candidate's letter for all of them. A constraint that judges by letter
  // would then be judging the wrong one for every candidate but the first.
  const fullContext: ConstraintContext = {
    ...context,
    candidate,
    letter: candidate.letter,
  };

  const constraintScores = new Map<ConstraintType, ConstraintScore>();
  let hardConstraintsSatisfied = true;
  let softScoreSum = 0;
  let softWeightSum = 0;

  // Evaluate hard constraints first (fail fast)
  for (const constraint of constraintSet.hard) {
    const score = evaluateConstraint(constraint, fullContext);
    constraintScores.set(constraint.type, score);

    if (!score.satisfied) {
      hardConstraintsSatisfied = false;
      // Continue evaluating for reporting purposes, but mark as failed
    }
  }

  // Evaluate soft constraints
  for (const constraint of constraintSet.soft) {
    const score = evaluateConstraint(constraint, fullContext);
    constraintScores.set(constraint.type, score);

    const weight = constraintSet.weights?.get(constraint.type) ?? 1.0;
    softScoreSum += score.score * weight;
    softWeightSum += weight;
  }

  // Hard constraint failure = 0 score
  // Otherwise, weighted average of soft constraints
  const softScore = softWeightSum > 0 ? softScoreSum / softWeightSum : 1.0;
  const totalScore = hardConstraintsSatisfied ? softScore : 0;

  return {
    variation: candidate,
    variationIndex,
    totalScore,
    hardConstraintsSatisfied,
    constraintScores,
  };
}

export function scoreAndRankVariations(
  candidates: PictographData[],
  context: Omit<ConstraintContext, "candidate">,
  constraintSet: ConstraintSet
): VariationScore[] {
  const scores: VariationScore[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;

    // Early filtering for hard constraints with couldSatisfy
    let possiblyValid = true;
    for (const constraint of constraintSet.hard) {
      const varConstraint = constraint as IVariationConstraint;
      if (varConstraint.couldSatisfy && !varConstraint.couldSatisfy(candidate)) {
        possiblyValid = false;
        break;
      }
    }

    if (possiblyValid) {
      scores.push(scoreVariation(candidate, i, context, constraintSet));
    } else {
      // Add with zero score for completeness
      scores.push({
        variation: candidate,
        variationIndex: i,
        totalScore: 0,
        hardConstraintsSatisfied: false,
        constraintScores: new Map(),
      });
    }
  }

  // Sort by total score descending, with random tiebreaking.
  // Without randomization, equal-scoring candidates always appear in the
  // same order, producing identical sequences every generation.
  return scores.sort((a, b) => {
    const diff = b.totalScore - a.totalScore;
    if (Math.abs(diff) < 1e-9) return Math.random() - 0.5;
    return diff;
  });
}

function evaluateConstraint(
  constraint: IConstraint,
  context: ConstraintContext
): ConstraintScore {
  try {
    return constraint.evaluate(context);
  } catch (error) {
    // Constraint evaluation failed - treat as unsatisfied
    return {
      score: 0,
      satisfied: false,
      reason: `Evaluation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Quick pre-filter before full scoring.
 */
export function filterViableVariations(
  candidates: PictographData[],
  constraintSet: ConstraintSet
): PictographData[] {
  if (constraintSet.hard.length === 0) {
    return candidates;
  }

  return candidates.filter((candidate) => {
    for (const constraint of constraintSet.hard) {
      const varConstraint = constraint as IVariationConstraint;
      if (varConstraint.couldSatisfy && !varConstraint.couldSatisfy(candidate)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Includes any sequence-level constraints.
 */
export function calculateSequenceScore(
  stepScores: VariationScore[],
  constraintSet: ConstraintSet
): number {
  if (stepScores.length === 0) {
    return 0;
  }

  // Average of individual step scores
  const avgStepScore =
    stepScores.reduce((sum, s) => sum + s.totalScore, 0) / stepScores.length;

  // Check if any hard constraints failed
  const allHardSatisfied = stepScores.every((s) => s.hardConstraintsSatisfied);

  return allHardSatisfied ? avgStepScore : 0;
}
