import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { positionGroup } from "./position-groups";

export interface LetterEdge {
  readonly letter: string;
  readonly from: GridPositionGroup;
  readonly to: GridPositionGroup;
}

export interface IngredientEdges {
  readonly name: string;
  readonly edges: readonly LetterEdge[];
}

export interface WordCandidate {
  readonly word: string;
  /** Ingredient names contributing at least one letter. */
  readonly ingredients: readonly string[];
}

export interface EnumerateOptions {
  readonly maxLength: number;
  /** Only emit words that draw from EVERY ingredient (default false). */
  readonly requireAllIngredients?: boolean;
}

/** Family edges of a concrete sequence's steps (skips steps missing positions). */
export function edgesFromSequence(seq: SequenceData): LetterEdge[] {
  const edges: LetterEdge[] = [];
  for (const step of seq.steps) {
    if (!step.letter || !step.startPosition || !step.endPosition) continue;
    const from = positionGroup(step.startPosition);
    const to = positionGroup(step.endPosition);
    if (!from || !to) continue;
    edges.push({ letter: step.letter, from, to });
  }
  return edges;
}

/**
 * Enumerate closed walks in the position-family graph whose edges are drawn
 * from the ingredients. Word-level sieve only: necessary, not sufficient —
 * Layer 1 (seam-graph search) decides realizability against concrete card
 * material (position INSTANCES: alpha3 vs alpha5).
 *
 * Prior art (never-hand-roll accounting): sequence-engine's
 * `LetterPositionInfo` (sequence-engine-types.ts) and the spell tab's
 * `LetterTransitionGraph` (features/create/spell/services/letter-transition-graph.ts)
 * walk letters over position groups, but both are limited to alpha/beta/gamma
 * and are generation-bound (no ingredient attribution, no closed-walk
 * enumeration over a chosen edge multiset). Layer 0 needs all 7 families +
 * per-ingredient provenance, hence a new module. Consolidation deliberately
 * deferred.
 */
export function enumerateHybridWords(
  ingredients: readonly IngredientEdges[],
  options: EnumerateOptions
): WordCandidate[] {
  const edgeMap = new Map<string, { edge: LetterEdge; owners: Set<string> }>();
  for (const ing of ingredients) {
    for (const edge of ing.edges) {
      const key = `${edge.letter}|${edge.from}|${edge.to}`;
      const existing = edgeMap.get(key);
      if (existing) existing.owners.add(ing.name);
      else edgeMap.set(key, { edge, owners: new Set([ing.name]) });
    }
  }
  const edges = [...edgeMap.values()];
  const results = new Map<string, WordCandidate>();

  const walk = (
    start: GridPositionGroup,
    current: GridPositionGroup,
    letters: string[],
    owners: Set<string>
  ): void => {
    if (letters.length > options.maxLength) return;
    if (letters.length >= 2 && current === start) {
      const word = letters.join("");
      if (
        !options.requireAllIngredients ||
        ingredients.every((ing) => owners.has(ing.name))
      ) {
        // Canonical key = lexicographically-first rotation, so GGHH/GHHG/HHGG
        // rotations report once.
        const rotations = letters.map((_, i) =>
          [...letters.slice(i), ...letters.slice(0, i)].join("")
        );
        const canonical = rotations.sort()[0] ?? word;
        if (!results.has(canonical)) {
          results.set(canonical, { word, ingredients: [...owners].sort() });
        }
      }
      // keep walking — longer closures may exist within maxLength
    }
    for (const { edge, owners: edgeOwners } of edges) {
      if (edge.from !== current) continue;
      walk(
        start,
        edge.to,
        [...letters, edge.letter],
        new Set([...owners, ...edgeOwners])
      );
    }
  };

  const startGroups = new Set(edges.map((e) => e.edge.from));
  for (const start of startGroups) walk(start, start, [], new Set());
  return [...results.values()];
}
