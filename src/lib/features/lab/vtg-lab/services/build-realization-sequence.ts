import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { TND_BASE_CATALOG_ID } from "$lib/features/choreo-card/services/deck-composer";
import type { VtgMode } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";

/**
 * Resolve a cell's VTG-mode realization to its canonical base WORD.
 *
 * The l1-tnd-motions base catalog stores 22 four-beat WORDS, not single letters:
 * same-direction words are 1-letter (AAAA), opposite-direction words are 2-letter
 * (JDJD = split-opp, DJDJ = tog-opp). Mapping each word to its VTG mode (from the
 * seeder's familyId, scripts/seed-tnd-deck.ts) lets a realization resolve by
 * (mode, style pair) instead of by letter — a letter lookup silently dropped
 * every opposite-direction mode because "D" never matched the "DJDJ" key.
 */
const WORD_MODE: Record<string, VtgMode> = {
  AAAA: "SS", BBBB: "SS", CCCC: "SS",
  GGGG: "TS", HHHH: "TS", IIII: "TS",
  SSSS: "QS", TTTT: "QS", UUUU: "QS", VVVV: "QS",
  JDJD: "SO", KEKE: "SO", LFLF: "SO",
  DJDJ: "TO", EKEK: "TO", FLFL: "TO",
  MPMP: "QO", NQNQ: "QO", OROR: "QO", PMPM: "QO", QNQN: "QO", RORO: "QO",
};

/** Style pair of a base word's first step, e.g. "pro|anti". null if unreadable. */
function styleKeyOf(seq: SequenceData): string | null {
  const m = seq.steps?.[0]?.motions;
  const b = m?.blue?.motionType;
  const r = m?.red?.motionType;
  return b && r ? `${b}|${r}` : null;
}

/**
 * Index base words by `${mode}|${blueStyle}|${redStyle}`. Pure over the loaded
 * sequences so it is unit-testable without the catalog. Modes/styles are read
 * from the real sequences — only the word→mode map is static (and canonical).
 */
export function buildBaseIndex(seqs: SequenceData[]): Map<string, SequenceData> {
  const idx = new Map<string, SequenceData>();
  for (const s of seqs) {
    const mode = WORD_MODE[(s.word ?? "").toUpperCase()];
    if (!mode) continue;
    const sk = styleKeyOf(s);
    if (!sk) continue;
    const key = `${mode}|${sk}`;
    if (!idx.has(key)) idx.set(key, s);
  }
  return idx;
}

/**
 * Resolve the base word for a (mode, blueStyle, redStyle). Falls back to the
 * mirror (hands swapped) so an anti×pro cell still finds the pro×anti word — the
 * shape overlay is symmetric, so the mirror realizes the same mandala.
 */
export function resolveBase(
  idx: Map<string, SequenceData>,
  mode: VtgMode,
  blueStyle: string,
  redStyle: string,
): SequenceData | null {
  return idx.get(`${mode}|${blueStyle}|${redStyle}`) ?? idx.get(`${mode}|${redStyle}|${blueStyle}`) ?? null;
}

let baseIndex: Map<string, SequenceData> | null = null;
export async function loadBaseIndex(): Promise<Map<string, SequenceData>> {
  if (!baseIndex) baseIndex = buildBaseIndex(await loadCatalogSequences(TND_BASE_CATALOG_ID));
  return baseIndex;
}
