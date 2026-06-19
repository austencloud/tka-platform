import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  TND_BASE_CATALOG_ID,
  buildTnDSeedClasses,
  getTnDFamilyOptions,
} from "$lib/features/choreo-card/services/deck-composer";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import type { CardVariation } from "$lib/features/choreo-card/domain/models/DeckRelease";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { classifyRotationStyle, type RotationStyle } from "../domain/classify-rotation-style";
import { allTurnPatterns } from "../domain/tnd-turn-patterns";
import { getPrintCardRenderer } from "$lib/features/choreo-card/getPrintCardRenderer";
import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** Diamond vs box grid — drives which TnD family each seed lands in. */
export type LabGridMode = "diamond" | "box";

/** Explicit per-hand start orientation for the mandala (undefined hand = default). */
export type StartOriPair = { blue?: Orientation; red?: Orientation };

export interface StyleVariation {
  word: string; // e.g. "DJDJ"
  modeTag: string; // VTG mode code for the active grid, e.g. "QO"
  familyId: string; // TnD family for the active grid, e.g. "quarter-opp" — drives color
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

// Isolation is the simplest pro-spin, so the prop-spin triad reads Prospin /
// Antispin / Hybrid (matches the Rosetta's "Inspin (prospin) → Pro").
const STYLE_META: Record<RotationStyle, { label: string; accent: string }> = {
  iso: { label: "Prospin", accent: "#22d3ee" },
  antispin: { label: "Antispin", accent: "#f87171" },
  hybrid: { label: "Hybrid", accent: "#b763cd" },
};

const STYLE_ORDER: RotationStyle[] = ["iso", "antispin", "hybrid"];

function word(seedId: string): string {
  return (seedId.split("-").pop() ?? seedId).toUpperCase();
}

/** Family id (e.g. "quarter-opp") → 2-char VTG mode code (e.g. "QO"). */
function modeTagOf(familyId: string): string {
  const timing = familyId.startsWith("split") ? "S" : familyId.startsWith("tog") ? "T" : "Q";
  const direction = familyId.endsWith("opp") ? "O" : "S";
  return timing + direction;
}

// Module-level cache: base seeds load once; the picker reuses them per pick.
let basesPromise: Promise<SequenceData[]> | null = null;
function loadBases(): Promise<SequenceData[]> {
  if (!basesPromise) basesPromise = loadCatalogSequences(TND_BASE_CATALOG_ID);
  return basesPromise;
}

/**
 * Build the three prop-spin matrices for a grid mode. Variations are the
 * mirror-deduped CANONICAL seeds for that grid — reusing the deck releaser's
 * `getTnDFamilyOptions` so the lab keeps exactly one of each mirror pair per
 * grid (diamond: MP over PM / NQ over QN / OR over RO; box: DJ over JD …) and
 * each seed's family + color follow the active grid (MP is quarter-opp in
 * diamond, tog-opp in box). The 7×7 cell mandala is prop-spin × turns only
 * (centered → grid-mode invariant), so the rep is grid-agnostic.
 */
export async function resolveRotationStyleMatrices(
  grid: LabGridMode = "diamond",
  startOri?: StartOriPair,
): Promise<RotationStyleMatrix[]> {
  const bases = await loadBases();
  const edges = await loadDiamondEdges();
  const patterns = allTurnPatterns();

  // Canonical seed → its family for this grid (mirror halves already pruned).
  const seedClasses = buildTnDSeedClasses(bases);
  const familyBySeed = new Map<string, string>();
  for (const fam of getTnDFamilyOptions(seedClasses, [grid])) {
    for (const e of fam.entries) familyBySeed.set(e.sequenceId, fam.familyId);
  }

  const baseById = new Map(bases.map((b) => [b.id, b]));
  const byStyle = new Map<RotationStyle, { seq: SequenceData; familyId: string }[]>();
  for (const [seedId, familyId] of familyBySeed) {
    const seq = baseById.get(seedId);
    if (!seq) continue;
    const style = classifyRotationStyle(seq);
    if (!byStyle.has(style)) byStyle.set(style, []);
    byStyle.get(style)!.push({ seq, familyId });
  }

  const out: RotationStyleMatrix[] = [];
  for (const style of STYLE_ORDER) {
    const members = byStyle.get(style) ?? [];
    if (members.length === 0) continue;
    // The cell renders the ARCHETYPE: the structurally simplest member (fewest
    // distinct letters → a single-letter seed like A/B/C, alpha tiebreak),
    // chosen deterministically rather than by catalog order. Every member shares
    // this prop-spin rosette; they differ only in how the two hands phase
    // together (VTG mode = timing/direction), which is what the picker drills into.
    const rep = [...members].sort((a, b) => {
      const da = new Set(word(a.seq.id).split("")).size;
      const db = new Set(word(b.seq.id).split("")).size;
      if (da !== db) return da - db;
      return word(a.seq.id).localeCompare(word(b.seq.id));
    })[0]!.seq;

    const byTurn = new Map<string, SequenceData>();
    for (const tp of patterns) {
      byTurn.set(
        tp,
        applyVariationDescriptor(
          rep,
          {
            turnPattern: tp,
            turnLabel: tp,
            gridMode: grid,
            startOriPair: startOri,
          } satisfies CardVariation,
          edges,
        ).sequence,
      );
    }

    const seen = new Set<string>();
    const variations: StyleVariation[] = [];
    for (const { seq, familyId } of members) {
      const w = word(seq.id);
      if (seen.has(w)) continue;
      seen.add(w);
      variations.push({ word: w, modeTag: modeTagOf(familyId), familyId, seedId: seq.id });
    }

    out.push({ style, ...STYLE_META[style], byTurn, variations });
  }
  return out;
}

/** Resolve one variation's sequence at a turn pattern + grid (for the picker → card). */
export async function resolveVariationSequence(
  seedId: string,
  turnPattern: string,
  grid: LabGridMode = "diamond",
  startOri?: StartOriPair,
): Promise<SequenceData | null> {
  const bases = await loadBases();
  const base = bases.find((s) => s.id === seedId);
  if (!base) return null;
  const edges = await loadDiamondEdges();
  return applyVariationDescriptor(
    base,
    {
      turnPattern,
      turnLabel: turnPattern,
      gridMode: grid,
      startOriPair: startOri,
    } satisfies CardVariation,
    edges,
  ).sequence;
}

/**
 * Bake a variation's actual deck-card front: the elemental stripe frame + tint
 * for its TnD family (timing+direction), QR, mandala fills, exactly the card the
 * timing/direction decks release. `familyId` (e.g. "quarter-opp") → TnDElement.
 * Returns a PNG data URL for ChoreoCard's `preRenderedImageUrl`.
 */
export async function bakeVariationFront(seq: SequenceData, familyId: string): Promise<string> {
  const tndElement = TND_BY_FAMILY[familyId];
  const canvas = await getPrintCardRenderer().renderFront(seq, {
    includeStartPosition: true,
    tndElement,
    showMandala: true,
  });
  return canvas.toDataURL("image/png");
}
