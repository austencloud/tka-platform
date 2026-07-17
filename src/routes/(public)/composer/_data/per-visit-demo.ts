/**
 * Per-visit demo sequence — every visitor gets a freshly generated rotated
 * LOOP instead of a canonical baked example. Nothing on the page treats any
 * particular sequence as special.
 *
 * Beginner-facing constraints: only letters that RENDER as a plain Latin
 * capital (blocklist = every ALL_LETTERS entry that isn't a single A-Z
 * glyph — excludes Greek and dash variants by what the visitor actually
 * sees, not by type taxonomy). Intermediate difficulty on purpose —
 * beginner (0 turns) collapses into single-letter wallpaper (CCCCCCCC),
 * and it is the Greek glyphs that scare first-time visitors, not the turn
 * numbers. A roll is accepted only when it has enough distinct letters
 * (restricted-alphabet rotated LOOPs are structurally cyclic; 4-letter
 * seeds top out around 3 distinct letters, and 1-2 reads as a broken
 * demo). A few retries, then the best roll so far ships anyway.
 *
 * The baked fixture ($lib/shared/landing/data/demo-sequence.json) remains
 * only as the fallback when generation itself fails, and as the static
 * sequence for the notation prop pages.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import demoJson from "$lib/shared/landing/data/demo-sequence.json";

export const FALLBACK_DEMO = demoJson as unknown as SequenceData;

const LENGTHS = [8, 12, 16] as const;
const MAX_ROLLS = 10;
/** Accept a roll only when at least this many distinct letters appear —
 * rejects the wallpaper draws (AAAA, BBBABBBA) that read as "broken demo". */
const MIN_UNIQUE_LETTERS = 3;
const LATIN_GLYPH = /^[A-Z]$/;

export async function generatePerVisitDemo(): Promise<SequenceData> {
  try {
    const [{ generationOrchestrator }, models, circular, grid, prop, domain] = await Promise.all([
      import("$lib/shared/create/services/generation-orchestrator"),
      import("$lib/shared/foundation/domain/models/generation/generate-models"),
      import("$lib/shared/foundation/domain/models/generation/circular-models"),
      import("$lib/shared/pictograph/grid/domain/enums/grid-enums"),
      import("$lib/shared/pictograph/prop/domain/enums/prop-type"),
      import("@tka/domain"),
    ]);

    const blocked = domain.ALL_LETTERS.filter((l) => !LATIN_GLYPH.test(String(l)));

    let best: SequenceData | null = null;
    let bestUnique = -1;
    for (let roll = 0; roll < MAX_ROLLS; roll++) {
      const length = LENGTHS[Math.floor(Math.random() * LENGTHS.length)] ?? 8;
      const seq = await generationOrchestrator.generateSequence({
        mode: models.GenerationMode.CIRCULAR,
        loopType: circular.LOOPType.ROTATED,
        period: circular.Period.HALVED,
        length,
        gridMode: grid.GridMode.DIAMOND,
        propType: prop.PropType.STAFF,
        difficulty: models.DifficultyLevel.INTERMEDIATE,
        constraintPreset: "smooth",
        motionTypeFilter: "no-dash",
        mustNotContainLetters: blocked as unknown as never[],
      });
      // Plain-ify reactive proxies before handing to players/canvases.
      const plain = JSON.parse(JSON.stringify(seq)) as SequenceData;
      const letters = plain.steps.map((s) => String(s.letter ?? "")).filter(Boolean);
      const allLatin = letters.every((l) => LATIN_GLYPH.test(l));
      const uniqueCount = new Set(letters).size;
      if (allLatin && uniqueCount >= MIN_UNIQUE_LETTERS) return plain;
      if (allLatin && uniqueCount > bestUnique) {
        best = plain;
        bestUnique = uniqueCount;
      }
    }
    if (best) return best;
  } catch (e) {
    console.error("[per-visit-demo] generation failed, using baked fallback:", e);
  }
  return FALLBACK_DEMO;
}
