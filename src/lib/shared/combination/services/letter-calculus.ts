import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { positionGroup, seamEndOf, seamOf } from "./position-groups";

export interface LetterEdge {
  readonly letter: Letter;
  readonly from: GridPositionGroup;
  readonly to: GridPositionGroup;
}

export interface IngredientEdges {
  readonly name: string;
  readonly edges: readonly LetterEdge[];
}

export interface WordCandidate {
  /** Display string of the CANONICAL (lexicographically-smallest) rotation. */
  readonly word: string;
  /**
   * The canonical rotation's letters, as an array — never re-split `word`
   * char-by-char to recover this. Dashed letters ("W-", "Σ-", ...) are two
   * characters wide and are not char-splittable; `letters` is the only safe
   * way to know how many actual TKA letters a word contains.
   */
  readonly letters: readonly Letter[];
  /**
   * `requireAllIngredients` mode: the full witness assignment — every
   * requested ingredient, each backed by >=1 walk-edge occurrence in a
   * feasible exact-cover assignment (see `findIngredientCoverWitness`).
   *
   * Default mode (no `requireAllIngredients`): the union of every ingredient
   * that could have supplied at least one edge occurrence in this walk. This
   * is NOT a verified cover — just the set of possible suppliers; a shared
   * edge counted here might not actually be assignable to every ingredient
   * listed if the walk doesn't have enough occurrences to go around (see I4).
   */
  readonly ingredients: readonly string[];
}

export interface EnumerateOptions {
  readonly maxLength: number;
  /** Only emit words that draw from EVERY ingredient (default false). */
  readonly requireAllIngredients?: boolean;
  /** Cap on distinct results returned (default 200). */
  readonly maxResults?: number;
  /** DFS node budget — bounds worst-case exponential blowup (default 500_000). */
  readonly searchBudget?: number;
}

export interface EnumerateResult {
  readonly words: readonly WordCandidate[];
  /**
   * False when either `searchBudget` or `maxResults` cut the search short —
   * mirrors Layer 1's `CombinationSearchReport.searchComplete` vocabulary.
   * Conservative: if the space happened to be fully exhausted at exactly the
   * same moment a cap was reached, this still reports false. That's an
   * acceptable false negative for a lab completeness signal — it only ever
   * under-claims completeness, never over-claims it.
   */
  readonly searchComplete: boolean;
}

/** Family edges of a concrete sequence's steps (skips steps missing positions). */
export function edgesFromSequence(seq: SequenceData): LetterEdge[] {
  const edges: LetterEdge[] = [];
  for (const step of seq.steps) {
    if (!step.letter) continue;
    const startSeam = seamOf(step);
    const endSeam = seamEndOf(step);
    if (!startSeam || !endSeam) continue;
    const from = positionGroup(startSeam);
    const to = positionGroup(endSeam);
    if (!from || !to) continue;
    edges.push({ letter: step.letter, from, to });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Primitivity (necklace aperiodicity) — enumeration layer, NOT display layer
// ---------------------------------------------------------------------------

/**
 * Reject any letter sequence that is itself a whole-number repetition of a
 * shorter prefix (GG, GGG, FLFL, ...) — only the shortest (primitive) closed
 * walk for a given edge-cycle is worth emitting as a candidate.
 *
 * This is a DIFFERENT layer from `simplifyRepeatedWord`
 * (`$lib/shared/foundation/utils/word-simplifier.ts`): that utility is
 * display-layer — it takes an already-decided, already-realized word (e.g. a
 * LOOP's full expanded letter string) and shortens it for human display
 * after the fact. This function is enumeration-layer — it decides which
 * closed walks are worth surfacing as search results AT ALL. "GGGG" never
 * becomes a hybrid-word candidate here because its primitive unit "G" already
 * covers the identical edge, once per period — not because a later display
 * step collapsed it.
 */
function isPrimitiveWord(letters: readonly Letter[]): boolean {
  const n = letters.length;
  for (let d = 1; d < n; d++) {
    if (n % d !== 0) continue;
    let matches = true;
    for (let i = d; i < n; i++) {
      if (letters[i] !== letters[i % d]) {
        matches = false;
        break;
      }
    }
    if (matches) return false;
  }
  return true;
}

function compareLetterArrays(
  a: readonly Letter[],
  b: readonly Letter[]
): number {
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

/** The lexicographically-smallest rotation — the deterministic canonical form. */
function canonicalRotation(letters: readonly Letter[]): Letter[] {
  let best: readonly Letter[] = letters;
  for (let i = 1; i < letters.length; i++) {
    const rotated = [...letters.slice(i), ...letters.slice(0, i)];
    if (compareLetterArrays(rotated, best) < 0) best = rotated;
  }
  return [...best];
}

// ---------------------------------------------------------------------------
// Exact ingredient cover (bipartite matching) — I4
// ---------------------------------------------------------------------------

/**
 * Does there exist an assignment of each used edge-occurrence to ONE of its
 * owners such that every ingredient in `requiredIngredients` is assigned
 * >=1 occurrence? Returns the witness ingredient set (sorted, deterministic)
 * on success, or `null` when infeasible.
 *
 * This is bipartite-matching feasibility (Kuhn's algorithm): left nodes are
 * required ingredients, right nodes are walk occurrences, an edge exists
 * when an occurrence's owner set contains that ingredient. Feasible iff a
 * matching exists that saturates every ingredient. Bounds are tiny in
 * practice (<=13 ingredients, <=8 occurrences at maxLength 8), so a plain
 * augmenting-path search is more than fast enough — no need for
 * Hopcroft-Karp here.
 *
 * A union-of-owners check ("does every ingredient appear SOMEWHERE in the
 * walk's owner sets") is NOT sufficient and was the I4 bug: two ingredients
 * sharing one identical edge both "appear" in that edge's owner set, but a
 * walk that uses the edge only ONCE cannot actually credit both of them —
 * there's only one occurrence to assign. This function is exported so that
 * exact scenario can be unit-tested directly, independent of whether the
 * resulting word would ever pass `isPrimitiveWord` (I5) in the full pipeline.
 */
export function findIngredientCoverWitness(
  occurrenceOwners: readonly ReadonlySet<string>[],
  requiredIngredients: readonly string[]
): readonly string[] | null {
  const ingredients = [...requiredIngredients].sort();
  // occurrenceAssignedTo[occIdx] = index into `ingredients` currently holding
  // this occurrence, or -1 when unclaimed.
  const occurrenceAssignedTo: number[] = new Array(
    occurrenceOwners.length
  ).fill(-1);

  const tryAssign = (ingredientIdx: number, visited: boolean[]): boolean => {
    for (let occIdx = 0; occIdx < occurrenceOwners.length; occIdx++) {
      if (visited[occIdx]) continue;
      if (!occurrenceOwners[occIdx]!.has(ingredients[ingredientIdx]!)) continue;
      visited[occIdx] = true;
      const currentHolder = occurrenceAssignedTo[occIdx]!;
      if (currentHolder === -1 || tryAssign(currentHolder, visited)) {
        occurrenceAssignedTo[occIdx] = ingredientIdx;
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < ingredients.length; i++) {
    const visited: boolean[] = new Array(occurrenceOwners.length).fill(false);
    if (!tryAssign(i, visited)) return null;
  }
  return ingredients;
}

// ---------------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------------

interface EdgeDef {
  readonly letter: Letter;
  readonly to: GridPositionGroup;
  readonly owners: ReadonlySet<string>;
}

/**
 * Enumerate primitive (aperiodic) closed walks in the position-family graph
 * whose edges are drawn from the ingredients. Word-level sieve only:
 * necessary, not sufficient — Layer 1 (seam-graph search) decides
 * realizability against concrete card material (position INSTANCES: alpha3
 * vs alpha5).
 *
 * API-fitness note: position FAMILY is invariant under every spatial/color
 * variant a hybrid card could apply. Verified against
 * `circular-position-maps.ts`'s `HALF_POSITION_MAP` (180°) and
 * `QUARTER_POSITION_MAP_CW`/`_CCW` (90°) — every entry maps a position to
 * another position in the SAME family (alpha->alpha, beta->beta, each gamma
 * half to itself, etc.); there are zero cross-family maps in that file, and
 * mirroring/color-swap don't touch family membership either. So this sieve
 * correctly prefilters at the WORD level (which letter sequences could ever
 * close a loop, drawing from which ingredients) — variant choice (rotation,
 * mirror, color swap) is Layer 1's job, not this one's.
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
): EnumerateResult {
  const { maxLength, requireAllIngredients = false } = options;
  const maxResults = options.maxResults ?? 200;
  const searchBudget = options.searchBudget ?? 500_000;

  // Deduplicated edge index, bucketed by `from` group (avoids an O(E) scan
  // per step of every walk).
  const edgeMap = new Map<
    string,
    {
      letter: Letter;
      from: GridPositionGroup;
      to: GridPositionGroup;
      owners: Set<string>;
    }
  >();
  for (const ing of ingredients) {
    for (const edge of ing.edges) {
      const key = `${edge.letter}|${edge.from}|${edge.to}`;
      const existing = edgeMap.get(key);
      if (existing) existing.owners.add(ing.name);
      else
        edgeMap.set(key, {
          letter: edge.letter,
          from: edge.from,
          to: edge.to,
          owners: new Set([ing.name]),
        });
    }
  }
  const edgesByFrom = new Map<GridPositionGroup, EdgeDef[]>();
  for (const def of edgeMap.values()) {
    const bucket = edgesByFrom.get(def.from);
    if (bucket) bucket.push(def);
    else edgesByFrom.set(def.from, [def]);
  }

  const requiredIngredientNames = ingredients.map((ing) => ing.name).sort();
  const results = new Map<string, WordCandidate>();
  let nodesVisited = 0;
  let truncated = false;

  // Shared mutable path state, mutated via push/pop during the DFS — avoids
  // an array copy per recursive step. Every value stored into `results` is a
  // fresh copy taken synchronously before the caller pops, so nothing here
  // aliases into a later-mutated array.
  const letters: Letter[] = [];
  const occurrenceOwners: ReadonlySet<string>[] = [];

  const recordIfValid = (): void => {
    if (letters.length < 1) return;
    if (!isPrimitiveWord(letters)) return;

    let ingredientsField: readonly string[];
    if (requireAllIngredients) {
      const witness = findIngredientCoverWitness(
        occurrenceOwners,
        requiredIngredientNames
      );
      if (!witness) return;
      ingredientsField = witness;
    } else {
      ingredientsField = [
        ...new Set(occurrenceOwners.flatMap((owners) => [...owners])),
      ].sort();
    }

    const canonical = canonicalRotation(letters);
    const canonicalKey = canonical.join(" ");
    if (results.has(canonicalKey)) return;
    results.set(canonicalKey, {
      word: canonical.join(""),
      letters: canonical,
      ingredients: ingredientsField,
    });
    if (results.size >= maxResults) truncated = true;
  };

  const walk = (start: GridPositionGroup, current: GridPositionGroup): void => {
    if (truncated) return;
    nodesVisited++;
    if (nodesVisited > searchBudget) {
      truncated = true;
      return;
    }

    if (current === start) recordIfValid();
    if (truncated) return;
    // Boundary prune: never allocate a depth-(maxLength+1) node.
    if (letters.length === maxLength) return;

    const outgoing = edgesByFrom.get(current);
    if (!outgoing) return;
    for (const edge of outgoing) {
      if (truncated) return;
      letters.push(edge.letter);
      occurrenceOwners.push(edge.owners);
      walk(start, edge.to);
      letters.pop();
      occurrenceOwners.pop();
    }
  };

  for (const start of edgesByFrom.keys()) {
    if (truncated) break;
    walk(start, start);
  }

  return { words: [...results.values()], searchComplete: !truncated };
}
