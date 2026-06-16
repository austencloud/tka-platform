import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { TND_BASE_CATALOG_ID } from "$lib/features/choreo-card/services/deck-composer";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { deriveTnDFromPictograph } from "$lib/shared/pictograph/shared/domain/utils/tnd-deriver";
import { classifyRotationStyle, type RotationStyle } from "../domain/classify-rotation-style";
import { allTurnPatterns } from "../domain/tnd-turn-patterns";

export interface StyleVariation {
  word: string; // e.g. "DJDJ"
  modeTag: string; // VTG mode, e.g. "SS"
  seedId: string;
}

export interface RotationStyleMatrix {
  style: RotationStyle;
  label: string;
  accent: string;
  /** Representative mandala per turn pattern, for the 7×7 cells. */
  byTurn: Map<string, SequenceData>;
  variations: StyleVariation[];
}

const STYLE_META: Record<RotationStyle, { label: string; accent: string }> = {
  iso: { label: "Isolation", accent: "#22d3ee" },
  antispin: { label: "Antispin", accent: "#f87171" },
  hybrid: { label: "Hybrid", accent: "#b763cd" },
};

const STYLE_ORDER: RotationStyle[] = ["iso", "antispin", "hybrid"];

function word(seedId: string): string {
  return (seedId.split("-").pop() ?? seedId).toUpperCase();
}

// Module-level cache: base seeds load once; the picker reuses them per pick.
let basesPromise: Promise<SequenceData[]> | null = null;
function loadBases(): Promise<SequenceData[]> {
  if (!basesPromise) basesPromise = loadCatalogSequences(TND_BASE_CATALOG_ID);
  return basesPromise;
}

/** Build the three rotation-style matrices from the base catalog. */
export async function resolveRotationStyleMatrices(): Promise<RotationStyleMatrix[]> {
  const bases = await loadBases();
  const edges = await loadDiamondEdges();
  const patterns = allTurnPatterns();

  const byStyle = new Map<RotationStyle, SequenceData[]>();
  for (const s of bases) {
    const style = classifyRotationStyle(s);
    if (!byStyle.has(style)) byStyle.set(style, []);
    byStyle.get(style)!.push(s);
  }

  const out: RotationStyleMatrix[] = [];
  for (const style of STYLE_ORDER) {
    const seeds = byStyle.get(style) ?? [];
    if (seeds.length === 0) continue;
    const rep = seeds[0]!; // any member renders the style's fingerprint

    const byTurn = new Map<string, SequenceData>();
    for (const tp of patterns) {
      byTurn.set(tp, applyVariationDescriptor(rep, { turnPattern: tp, turnLabel: tp } as any, edges).sequence);
    }

    const seen = new Set<string>();
    const variations: StyleVariation[] = [];
    for (const s of seeds) {
      const w = word(s.id);
      if (seen.has(w)) continue;
      seen.add(w);
      const { tndMode } = deriveTnDFromPictograph(s.steps.find((st) => !(st as { isBlank?: boolean }).isBlank) ?? s.steps[0]!);
      variations.push({ word: w, modeTag: tndMode ?? "", seedId: s.id });
    }

    out.push({ style, ...STYLE_META[style], byTurn, variations });
  }
  return out;
}

/** Resolve one variation's sequence at a turn pattern (for the picker → card). */
export async function resolveVariationSequence(seedId: string, turnPattern: string): Promise<SequenceData | null> {
  const bases = await loadBases();
  const base = bases.find((s) => s.id === seedId);
  if (!base) return null;
  const edges = await loadDiamondEdges();
  return applyVariationDescriptor(base, { turnPattern, turnLabel: turnPattern } as any, edges).sequence;
}
