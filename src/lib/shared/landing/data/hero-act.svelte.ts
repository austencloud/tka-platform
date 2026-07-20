/**
 * Hero Attract Act
 *
 * Owns the homepage hero's self-playing show: instead of one sequence
 * looping forever, the hero walks through a small cycle of props, playing a
 * freshly generated LOOP for each one before handing off to the next.
 *
 * The handoff is chained and pre-fetched so it never stalls or teleports:
 * while the current sequence plays, the next one generates in the
 * background, constrained to start where the current sequence's CIRCULAR
 * loop ends (which is also where it started — see
 * sequence-loopability-checker.ts). InlineAnimationPlayer accepts the
 * prefetched sequence inside that exact playback frame, so its clock never
 * pauses or revisits the incoming sequence's stationary start hold.
 *
 * SSR-safe by construction: state starts without a sequence, leaving the
 * host's fixed stage in its pending state. `start()` chooses the opening prop
 * and generates its first sequence after hydration, then pre-fetches the rest
 * of the act.
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PreparedSequenceHandoff } from "$lib/shared/animation-engine/domain/chaining-types";
import { generatePerVisitDemo } from "$lib/shared/landing/data/per-visit-demo";

/**
 * Poi is deliberately excluded from the cycle. Austen's 2026-07-18 poi
 * legality ruling: only 0-turn flowers are legal (isolation is otherwise
 * impossible, 0-turn antis are impractical); everything with turns > 0 is
 * fine. The act's sequences are arbitrary generated LOOPs with no poi
 * legality check applied to the draw, so a poi-illegal (turns = 0, or
 * whatever the generator happens to produce) sequence could land. The
 * homepage must never show poi performing a move that isn't actually
 * possible with the prop, so poi stays out of this cycle until the
 * generator can filter for legality itself.
 */
export const PROP_CYCLE: readonly PropType[] = [
  PropType.STAFF,
  PropType.FAN,
  PropType.CLUB,
  PropType.BUUGENG,
];

/**
 * Loops of the current sequence to watch before advancing to the next prop.
 * The favorite preset (per-visit-demo.ts) is a 16-count sequence, which at
 * 60 BPM runs about 16 seconds — tune this constant for how long each prop
 * holds the stage, not the loop-completion wiring itself.
 */
export const PASSES_PER_SEQUENCE = 1;

function nextPropInCycle(current: PropType): PropType {
  const index = PROP_CYCLE.indexOf(current);
  // indexOf returns -1 only if `current` somehow isn't in the cycle (can't
  // happen from this module's own state, but falling back to the first prop
  // instead of crashing keeps the act running if it ever does).
  const safeIndex = index === -1 ? 0 : index;
  return PROP_CYCLE[(safeIndex + 1) % PROP_CYCLE.length] ?? PropType.STAFF;
}

export function createHeroAct(options?: {
  /** Injectable so the opening prop stays deterministic in tests. The real
   *  homepage uses Math.random, sampled once inside the client-only start(). */
  random?: () => number;
}) {
  const random = options?.random ?? Math.random;
  let current = $state<SequenceData | null>(null);
  let currentProp = $state<PropType>(PropType.STAFF);
  // True while the first sequence is generating or a later swap is in flight.
  // This drives the dice button's "Rolling..." state and guards against a
  // natural loop-boundary advance racing a manual dice press.
  let busy = $state(false);

  // The sequence generating in the background to follow `current`, and the
  // prop it will play with. Null while generation hasn't landed yet — the
  // loop-boundary handler treats that as "not ready" and keeps looping
  // `current` instead of advancing into a gap.
  let preparedNext: SequenceData | null = null;
  let preparedNextProp: PropType = nextPropInCycle(currentProp);
  let passesSinceAdvance = 0;
  let started = false;

  function pickInitialProp(): PropType {
    const index = Math.floor(random() * PROP_CYCLE.length);
    return PROP_CYCLE[index] ?? PropType.STAFF;
  }

  /** Kicks off generation of the sequence that will follow `current`,
   *  chained to start where `current`'s CIRCULAR loop ends. `fromProp` is the
   *  prop the act has just advanced into. */
  function prepareNext(fromProp: PropType = currentProp): void {
    if (!current) return;
    const targetProp = nextPropInCycle(fromProp);
    preparedNextProp = targetProp;
    preparedNext = null;
    const chainedStartPosition = current.startPosition ?? null;
    void generatePerVisitDemo({
      propType: targetProp,
      startPosition: chainedStartPosition,
    }).then((seq) => {
      // A dice press mid-generation may have already advanced past this
      // draw's target prop; only claim it if it's still the one we asked for.
      if (preparedNextProp === targetProp) {
        preparedNext = seq;
      }
    });
    // generatePerVisitDemo already falls back to FALLBACK_DEMO internally on
    // any generation failure, so this promise doesn't reject — there's no
    // separate failure branch to handle here.
  }

  /** Swaps to the next sequence for a manual dice press: the pre-generated
   *  one if it's ready, otherwise generates on the spot. */
  async function advance(): Promise<void> {
    if (busy || !current) return;
    busy = true;
    try {
      let seq = preparedNext;
      let prop = preparedNextProp;
      if (!seq) {
        prop = nextPropInCycle(currentProp);
        const chainedStartPosition = current.startPosition ?? null;
        seq = await generatePerVisitDemo({
          propType: prop,
          startPosition: chainedStartPosition,
        });
      }
      // A manual roll is one state transaction: the incoming word must never
      // render for even one frame with the outgoing prop. The renderer begins
      // its sprite crossfade from this prop-type change.
      current = seq;
      currentProp = prop;
      passesSinceAdvance = 0;
      prepareNext(prop);
    } finally {
      busy = false;
    }
  }

  /**
   * Offers the prefetched continuation at a natural playback boundary. The
   * controller initializes it first, then calls `accept` within the same frame
   * to publish the matching sequence and prop together. If generation has not
   * landed, returning null leaves the current LOOP running until the next pass.
   */
  function offerSequenceBoundary(): PreparedSequenceHandoff | null {
    passesSinceAdvance += 1;
    if (passesSinceAdvance < PASSES_PER_SEQUENCE) return null;
    if (busy || !preparedNext) return null;

    const sequence = preparedNext;
    const prop = preparedNextProp;
    return {
      sequence,
      accept() {
        // The offer and acceptance happen synchronously in one rAF callback.
        // The identity guard keeps this transaction safe if that contract is
        // ever widened to permit an asynchronous controller.
        if (busy || preparedNext !== sequence || preparedNextProp !== prop) {
          return;
        }
        current = sequence;
        currentProp = prop;
        preparedNext = null;
        passesSinceAdvance = 0;
        prepareNext(prop);
      },
    };
  }

  /** Dice button: advance right now, regardless of pass count. Returns the
   *  in-flight promise (harmless for the button's fire-and-forget onclick,
   *  and lets tests await the swap deterministically). */
  function advanceNow(): Promise<void> {
    return advance();
  }

  /** Generates the first playable sequence, then starts background
   *  pre-generation for the next prop. Call once from the host's onMount. */
  function start(): void {
    if (started) return;
    started = true;

    // Choose only after hydration. Running this during factory construction
    // would let SSR and the browser pick different props for the same page.
    const initialProp = pickInitialProp();
    currentProp = initialProp;
    preparedNextProp = nextPropInCycle(initialProp);
    busy = true;
    void generatePerVisitDemo({ propType: initialProp })
      .then((seq) => {
        current = seq;
        passesSinceAdvance = 0;
        prepareNext(initialProp);
      })
      .finally(() => {
        busy = false;
      });
  }

  return {
    get sequence() {
      return current;
    },
    get propType() {
      return currentProp;
    },
    get rerolling() {
      return busy;
    },
    start,
    offerSequenceBoundary,
    advanceNow,
  };
}
