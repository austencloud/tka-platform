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
 * sequence-loopability-checker.ts). InlineAnimationPlayer reloads onto a new
 * `sequence` prop in place (no remount), so the swap is just a prop update.
 *
 * SSR-safe by construction: state starts at FALLBACK_DEMO + staff (no
 * generation happens during factory construction), and `start()` — which
 * kicks off the first background generation — is only ever called from a
 * host's `onMount`, i.e. after hydration.
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { FALLBACK_DEMO, generatePerVisitDemo } from "$lib/shared/landing/data/per-visit-demo";

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
  /**
   * How long after a sequence swap the prop override flips. Zero would flip
   * the prop inside the player's post-swap start hold, where the engine's
   * crossfade runs against a frozen pose and reads as a pop (2026-07-19
   * feedback). Delaying it lands the morph in visible MOTION: the new word
   * starts on the old prop, then the prop transforms mid-spin. Rendering a
   * fan-generated sequence with staves for this window is safe — all static
   * props share motion legality; the prop type is a rendering override.
   * Tests pass 0 to keep the swap synchronous.
   */
  propMorphDelayMs?: number;
}) {
  const propMorphDelayMs = options?.propMorphDelayMs ?? 700;
  let current = $state<SequenceData>(FALLBACK_DEMO);
  let currentProp = $state<PropType>(PropType.STAFF);
  // True while a swap is in flight — drives the dice button's "Rolling..."
  // state AND guards against a natural (loop-boundary) advance racing a
  // manual dice press.
  let busy = $state(false);

  // The sequence generating in the background to follow `current`, and the
  // prop it will play with. Null while generation hasn't landed yet — the
  // loop-boundary handler treats that as "not ready" and keeps looping
  // `current` instead of advancing into a gap.
  let preparedNext: SequenceData | null = null;
  let preparedNextProp: PropType = nextPropInCycle(currentProp);
  let passesSinceAdvance = 0;
  let started = false;

  /** Kicks off generation of the sequence that will follow `current`,
   *  chained to start where `current`'s CIRCULAR loop ends. `fromProp` is the
   *  prop the act is advancing INTO (during an advance the reactive
   *  `currentProp` intentionally lags behind by the morph delay, so the next
   *  target can't be derived from it there). */
  function prepareNext(fromProp: PropType = currentProp): void {
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

  /** Swaps to the next sequence: the pre-generated one if it's ready,
   *  otherwise generates on the spot. Shared by the natural loop-boundary
   *  handoff and the dice button. */
  async function advance(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      let seq = preparedNext;
      let prop = preparedNextProp;
      if (!seq) {
        prop = nextPropInCycle(currentProp);
        const chainedStartPosition = current.startPosition ?? null;
        seq = await generatePerVisitDemo({ propType: prop, startPosition: chainedStartPosition });
      }
      current = seq;
      passesSinceAdvance = 0;
      prepareNext(prop);
      // Sequence first, prop second: the player swaps onto the new sequence
      // immediately (start hold, chained pose), then — once motion is under
      // way — the prop override flips and the engine's 900ms crossfade
      // morphs it mid-spin, where it actually reads. `busy` stays true for
      // the whole window so a dice press can't interleave a second advance.
      if (propMorphDelayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, propMorphDelayMs));
      }
      currentProp = prop;
    } finally {
      busy = false;
    }
  }

  /**
   * Wired to InlineAnimationPlayer's `onLoopComplete` — fires at every loop
   * wraparound of whatever is currently playing (a seamlessly-loopable
   * sequence never "ends" on its own). Once the pass quota is met, advance
   * only if the next sequence has actually finished generating; otherwise
   * keep looping the current one and re-check at the next boundary rather
   * than stall on a gap or teleport onto a half-built sequence.
   */
  function handleLoopComplete(): void {
    passesSinceAdvance += 1;
    if (passesSinceAdvance < PASSES_PER_SEQUENCE) return;
    if (!preparedNext) return;
    void advance();
  }

  /** Dice button: advance right now, regardless of pass count. Returns the
   *  in-flight promise (harmless for the button's fire-and-forget onclick,
   *  and lets tests await the swap deterministically). */
  function advanceNow(): Promise<void> {
    return advance();
  }

  /** Starts the background pre-generation. Call once, from a host's
   *  onMount — never during SSR/initial render. */
  function start(): void {
    if (started) return;
    started = true;
    prepareNext();
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
    handleLoopComplete,
    advanceNow,
  };
}
