/**
 * Per-visit demo sequence — every visitor gets a freshly generated rotated
 * LOOP instead of a canonical baked example, and the hero's dice button
 * rerolls it in place. Nothing on the page treats any particular sequence
 * as special.
 *
 * Letter pool: the FULL alphabet is in play (Greek letters and dash
 * variants included — restricting to plain Latin glyphs collapses the
 * space into alternation wallpaper like MPMN). The beginner-facing gate is
 * only that a roll must not be overwhelmingly Greek: at least half the
 * steps must render as a familiar Latin capital, so a first-time visitor
 * always has footholds, while the Greek letters keep the words interesting.
 * Rolls also need enough distinct letters to read as a real phrase rather
 * than wallpaper. A few retries, then the best-scoring roll ships anyway.
 *
 * The baked fixture ($lib/shared/landing/data/demo-sequence.json) remains
 * only as the fallback when generation itself fails, and as the static
 * sequence for the notation prop pages.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import demoJson from "$lib/shared/landing/data/demo-sequence.json";

export const FALLBACK_DEMO = demoJson as unknown as SequenceData;

const MAX_ROLLS = 10;
/** Reject wallpaper draws. The favorite preset is a 16-count QUARTERED loop, so
 * the word is a 4-step seed repeated 4× — require ≥3 distinct letters in that
 * seed so the title reads as a phrase (ΧΚΔΛ), not alternation (ΧΚΧΚ). */
const MIN_UNIQUE_LETTERS = 3;
/** "Not entirely Greek": at least this fraction of steps must render as a
 * familiar Latin glyph (dash variants of Latin letters count — the glyph a
 * visitor sees is still the Latin capital). */
const MIN_FAMILIAR_FRACTION = 0.5;
const FAMILIAR_GLYPH = /^[A-Z]-?$/;

export async function generatePerVisitDemo(options?: {
  /** Prop to generate for. Defaults to staff (the original per-visit draw). */
  propType?: PropType;
  /** Injectable random source for deterministic level-selection tests. */
  random?: () => number;
  /**
   * Constrains the roll to start at this exact grid position. The hero
   * attract act (hero-act.svelte.ts) uses this to chain sequences: a
   * CIRCULAR loop's end pose equals its start pose, so passing the
   * currently-playing sequence's `startPosition` here guarantees the next
   * draw picks up where the current one left off instead of teleporting.
   * `SequenceData.startPosition` (a `StartPositionData`) is structurally a
   * `PictographData` — no mapping needed, pass it straight through.
   */
  startPosition?: PictographData | null;
}): Promise<SequenceData> {
  try {
    const [{ generationOrchestrator }, models, circular, grid, prop] =
      await Promise.all([
        import("$lib/shared/create/services/generation-orchestrator"),
        import("$lib/shared/foundation/domain/models/generation/generate-models"),
        import("$lib/shared/foundation/domain/models/generation/circular-models"),
        import("$lib/shared/pictograph/grid/domain/enums/grid-enums"),
        import("$lib/shared/pictograph/prop/domain/enums/prop-type"),
      ]);

    // Each sequence gets one level draw, with equal space devoted to levels
    // one, two, and three. Keep that choice through the quality-filter retries
    // so rejecting one word cannot quietly turn the replacement into a
    // different difficulty.
    const difficultyPool = [
      models.DifficultyLevel.BEGINNER,
      models.DifficultyLevel.INTERMEDIATE,
      models.DifficultyLevel.ADVANCED,
    ] as const;
    const random = options?.random ?? Math.random;
    const difficulty =
      difficultyPool[Math.floor(random() * difficultyPool.length)] ??
      models.DifficultyLevel.INTERMEDIATE;

    async function rollBest(
      startPosition: PictographData | null
    ): Promise<SequenceData | null> {
      let best: SequenceData | null = null;
      let bestScore = -1;
      for (let roll = 0; roll < MAX_ROLLS; roll++) {
        // The showcase shape stays 16-count, rotated, and QUARTERED while the
        // difficulty and letters vary from one sequence to the next. Quartered
        // on a 16-count is a 4-step seed repeated four times, so
        // simplifyRepeatedWord renders a tidy 4-glyph title instead of an
        // overwhelming one.
        const seq = await generationOrchestrator.generateSequence({
          mode: models.GenerationMode.CIRCULAR,
          loopType: circular.LOOPType.ROTATED,
          period: circular.Period.QUARTERED,
          length: 16,
          // Keep the homepage's turn ceiling even when the level draw permits a
          // wider palette. This prevents the public demo from drifting back into
          // the triple-spin intensity that prompted the 2026-07-19 tuning.
          turnIntensity: 1.5,
          gridMode: grid.GridMode.DIAMOND,
          propType: options?.propType ?? prop.PropType.STAFF,
          difficulty,
          constraintPreset: "smooth",
          ...(startPosition ? { startPosition } : {}),
        });
        // Plain-ify reactive proxies before handing to players/canvases.
        const plain = JSON.parse(JSON.stringify(seq)) as SequenceData;
        const letters = plain.steps
          .map((s) => String(s.letter ?? ""))
          .filter(Boolean);
        if (letters.length === 0) continue;
        const familiarFraction =
          letters.filter((l) => FAMILIAR_GLYPH.test(l)).length / letters.length;
        const uniqueCount = new Set(letters).size;
        if (
          familiarFraction >= MIN_FAMILIAR_FRACTION &&
          uniqueCount >= MIN_UNIQUE_LETTERS
        ) {
          return plain;
        }
        // Familiarity dominates; variety breaks ties among comparable rolls.
        const score = familiarFraction + uniqueCount / 10;
        if (score > bestScore) {
          best = plain;
          bestScore = score;
        }
      }
      return best;
    }

    const constrained = options?.startPosition ?? null;
    let best: SequenceData | null = null;
    try {
      best = await rollBest(constrained);
    } catch (constrainedError) {
      // A start position the builder cannot reach (a box-mode pose asked of a
      // diamond draw, say) exhausts every attempt and throws. Falling straight
      // through to the baked fixture makes the hero replay the same sequence
      // it just showed; a fresh unconstrained roll is a real sequence, and the
      // only cost is that it does not pick up where the last one ended.
      if (!constrained) throw constrainedError;
      console.warn(
        "[per-visit-demo] constrained roll failed, retrying unchained:",
        constrainedError
      );
      best = await rollBest(null);
    }
    if (best) return best;
  } catch (e) {
    console.error(
      "[per-visit-demo] generation failed, using baked fallback:",
      e
    );
  }
  return FALLBACK_DEMO;
}
