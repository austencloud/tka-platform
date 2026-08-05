/**
 * The combination engine's public seam.
 *
 * Two questions, two methods, deliberately different in cost and in what they
 * prove:
 *
 *   - `candidateWords` is the Layer 0 preview — pure letter calculus over
 *     position FAMILIES. Synchronous, milliseconds, and only ever NECESSARY:
 *     a word listed here spells a closed loop in the family graph, which does
 *     not mean concrete card material can realize it (alpha3 and alpha5 are
 *     both "alpha" to this layer, and only one of them may be where the card
 *     actually is). It answers "what could these two cards possibly spell?",
 *     which is what a picker panel wants before anyone commits to a search.
 *   - `findCombinations` is the Layer 1 search — the real answer, over real
 *     steps and real seams, and the only thing that returns a performable
 *     sequence.
 *
 * Mirrors the `shared/comparison` getter convention (a lazily-created
 * singleton, no DI container).
 */

import { rosterConfirmedBases } from "./domain/base-sequence-registry";
import type {
  CombinationSearchReport,
  CombinatorOptions,
} from "./domain/types";
import {
  edgesFromSequence,
  enumerateHybridWords,
  ingredientDisplayNames,
  type EnumerateResult,
  type IngredientEdges,
} from "./services/letter-calculus";
import {
  createRuntimeAmbientProvider,
  type RuntimeAmbientProvider,
} from "./services/runtime-ambient-provider";
import { findCombinations } from "./services/sequence-combinator";

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";

/**
 * Longest word `candidateWords` will look for.
 *
 * Five, because six cannot be honest. The enumerator's default node budget is
 * spent before the length-6 level finishes at this ingredient shape (two cards
 * plus the whole roster), so `searchComplete` can never come back true above
 * five — and a preview that says "no candidates" without being able to say
 * "and I looked everywhere" is worse than one that stops where its proof
 * stops.
 */
const DEFAULT_MAX_WORD_LENGTH = 5;

/**
 * Result cap for the preview enumeration.
 *
 * NOT a display size — the display filter runs afterwards. It has to be big
 * enough that the words drawing on BOTH cards survive to be filtered FOR: the
 * complete length-<=4 set at this shape is ~1,600 words in about a
 * millisecond, and the enumerator emits shortest-first, so the default 200
 * truncates deep inside the length-3 level, often before a single both-cards
 * word appears. 2,000 clears the whole shape at the lengths this preview asks
 * about.
 */
const CANDIDATE_WORD_MAX_RESULTS = 2000;

export interface SequenceCombinator {
  /**
   * Every closed alternating walk over the two cards — or a structural proof
   * that none exists. See `CombinationSearchReport`; note that `impossible` is
   * always relative to the liberties and the ambient run cap the search ran
   * under, and the report carries `ambientRunCap` so a caller can say so.
   *
   * **Ambient material is auto-wired.** Unless the caller passes
   * `allowAmbient: false` or supplies its own `ambientProvider`, this reaches
   * for `createRuntimeAmbientProvider` over the live pictograph dataset — the
   * difference between "AAAA and HHHH cannot meet" and Austen's AAAAΨHHΦ. When
   * the dataset is not available (SSR before hydration, a unit test that never
   * bootstrapped the CSVs), the options pass through UNTOUCHED rather than
   * carrying a provider that would throw: a provider that fails makes the
   * engine mark its pool incomplete and withdraw its impossibility claim, so
   * silently attaching a doomed one would degrade every report on a machine
   * that simply has no data yet.
   */
  findCombinations(
    cardA: SequenceData,
    cardB: SequenceData,
    options?: CombinatorOptions
  ): Promise<CombinationSearchReport>;

  /**
   * Layer 0 preview: the shortest hybrid words the two cards and the ambient
   * roster could spell together, filtered to those drawing on BOTH cards.
   *
   * **The filter runs AFTER enumeration, and it is an over-approximation in
   * default mode.** `WordCandidate.ingredients` is the set of ingredients that
   * COULD have supplied at least one of the word's edges, not a verified cover
   * — two ingredients offering the identical (letter, from, to) edge both
   * appear even when the word contains only one occurrence to go around. So a
   * listed word definitely uses edges both cards offer; it is not proof that
   * both cards are indispensable to it. Layer 1 is what settles that.
   *
   * The flags come back exactly as the enumerator set them, describing the
   * UNFILTERED sweep — `searchComplete` means the length-bounded space was
   * swept, not that the filtered list is complete in some other sense. Nothing
   * is re-sorted here: the enumerator's shortest-first, lexicographic-within-a-
   * length order is already the deterministic one.
   */
  candidateWords(
    cardA: SequenceData,
    cardB: SequenceData,
    maxLength?: number
  ): EnumerateResult;
}

/** Display name for a card ingredient — simplified per `simplified-word-display`. */
function ingredientName(sequence: SequenceData, fallback: string): string {
  const simplified = simplifyRepeatedWord(sequence.word ?? "");
  return simplified.length > 0 ? simplified : fallback;
}

/**
 * Is the pictograph dataset actually answering?
 *
 * Memoized per grid mode, and cached only on success: a machine that has not
 * loaded the CSVs yet may well load them later (the app fetches them during
 * hydration), and pinning "no dataset" for the process lifetime would leave the
 * facade permanently ambient-blind after one early call.
 */
const datasetReady = new Map<GridMode, Promise<boolean>>();

function datasetAnswers(gridMode: GridMode): Promise<boolean> {
  const known = datasetReady.get(gridMode);
  if (known) return known;

  const probe = motionQueryHandler
    .queryMotions({ gridMode })
    .then((rows) => rows.length > 0)
    .catch(() => false)
    .then((ready) => {
      if (!ready) datasetReady.delete(gridMode);
      return ready;
    });

  datasetReady.set(gridMode, probe);
  return probe;
}

/**
 * One provider per grid mode, reused across searches so its per-seam cache
 * survives them. Seams repeat heavily — the same beta5 is asked about by every
 * card that visits it, in every search — and the dataset it reads is static.
 */
const providers = new Map<GridMode, RuntimeAmbientProvider>();

async function ambientProviderFor(
  gridMode: GridMode
): Promise<RuntimeAmbientProvider | null> {
  if (!(await datasetAnswers(gridMode))) return null;

  const existing = providers.get(gridMode);
  if (existing) return existing;

  const created = createRuntimeAmbientProvider(gridMode);
  providers.set(gridMode, created);
  return created;
}

let instance: SequenceCombinator | null = null;

export function getSequenceCombinator(): SequenceCombinator {
  if (instance) return instance;

  instance = {
    async findCombinations(cardA, cardB, options = {}) {
      const wantsAutoWiring =
        options.allowAmbient !== false && !options.ambientProvider;
      if (!wantsAutoWiring) return findCombinations(cardA, cardB, options);

      const gridMode = cardA.gridMode ?? GridMode.DIAMOND;
      const ambientProvider = await ambientProviderFor(gridMode);
      return findCombinations(
        cardA,
        cardB,
        ambientProvider ? { ...options, ambientProvider } : options
      );
    },

    candidateWords(cardA, cardB, maxLength = DEFAULT_MAX_WORD_LENGTH) {
      const ingredients: IngredientEdges[] = [
        {
          name: ingredientName(cardA, "card A"),
          edges: edgesFromSequence(cardA),
        },
        {
          name: ingredientName(cardB, "card B"),
          edges: edgesFromSequence(cardB),
        },
        ...rosterConfirmedBases().map((base) => ({
          name: base.word,
          edges: base.edges,
        })),
      ];

      const result = enumerateHybridWords(ingredients, {
        maxLength,
        maxResults: CANDIDATE_WORD_MAX_RESULTS,
      });

      // The two cards are ingredients 0 and 1 by construction; ask the
      // enumerator what it CALLS them rather than guessing, so combining a
      // card with itself (identical display words -> "G" and "G (2)") still
      // filters correctly.
      const [cardAName, cardBName] = ingredientDisplayNames(ingredients);
      return {
        ...result,
        words: result.words.filter(
          (candidate) =>
            candidate.ingredients.includes(cardAName!) &&
            candidate.ingredients.includes(cardBName!)
        ),
      };
    },
  };

  return instance;
}
