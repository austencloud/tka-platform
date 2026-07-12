/**
 * Live preview cards for the LOOP configurator.
 *
 * The per-flavor SKUs carry fixed curated covers, which are level-blind — a
 * buyer dialing Level 2 kept seeing Level 1 cards, so the preview lied about
 * the product. This service samples REAL sequences from the enumerated
 * catalogs matching the dials (catalog docs carry level/loopType/stepCount),
 * so what the fan shows is what the deck builder would actually draw from.
 *
 * Returns null on any failure — the caller falls back to the SKU covers.
 */

import {
  getCachedCatalogs,
  loadCatalogs,
  loadCatalogSequencesPage,
} from "$lib/features/choreo-card/services/catalog-loader";
import type { Catalog } from "$lib/features/choreo-card/domain/models/Catalog";
import type { CoverCard, Product } from "../domain/models/product";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { LoopFlavor, LoopLength, LoopLevel } from "../domain/loop-config";

const FAN_SIZE = 6;

let catalogsPromise: Promise<Catalog[]> | null = null;
async function getLoopCatalogs(): Promise<Catalog[]> {
  // localStorage warm copy first (families trimmed, but we only need the
  // scalar fields); cold path loads and re-primes that cache.
  const cached = getCachedCatalogs();
  if (cached?.length) return cached;
  catalogsPromise ??= loadCatalogs();
  return catalogsPromise;
}

// First fan-sized page of each catalog, fetched once per session — a variety
// hand (1 card) and a full flavor hand (6) share the same cached page.
const seqCache = new Map<string, Promise<SequenceData[]>>();
function sampleSequences(catalogId: string): Promise<SequenceData[]> {
  let hit = seqCache.get(catalogId);
  if (!hit) {
    hit = loadCatalogSequencesPage(catalogId, FAN_SIZE).then((r) => r.sequences);
    seqCache.set(catalogId, hit);
  }
  return hit;
}

/** Flavor slug ("mirrored-swapped") → catalog loopType ("mirrored_swapped"). */
const toLoopType = (f: LoopFlavor) => f.replace(/-/g, "_");

function pickCatalog(
  cats: Catalog[],
  flavor: LoopFlavor,
  level: number,
  wantSteps: number
): Catalog | null {
  const loopType = toLoopType(flavor);
  const candidates = cats.filter(
    (c) =>
      c.collection === "LOOPs" &&
      !c.asymmetric && // asymmetric enumerations store no sequences of their own
      c.loopType === loopType &&
      c.level === level
  );
  if (candidates.length === 0) return null;
  // Prefer the buyer's step count, then the curated 54-card decks (the printed
  // product), then the biggest pool.
  candidates.sort(
    (a, b) =>
      Number(b.stepCount === wantSteps) - Number(a.stepCount === wantSteps) ||
      Number(b.id.includes("-c54")) - Number(a.id.includes("-c54")) ||
      b.totalSequences - a.totalSequences
  );
  return candidates[0] ?? null;
}

/** Frame styling carried over from the flavor SKU's curated covers, so the
 *  sampled cards keep the flavor's accent identity. */
function accentFrom(sku: Product | undefined): Omit<CoverCard, "sequence"> {
  const c = sku?.coverCards?.[0];
  if (!c) return {};
  return {
    accentColor: c.accentColor,
    darkComplement: c.darkComplement,
    tintOpacity: c.tintOpacity,
    footerCenter: c.footerCenter,
  };
}

async function flavorCards(
  cats: Catalog[],
  flavor: LoopFlavor,
  level: number,
  n: number,
  sku: Product | undefined,
  offset = 0,
  wantSteps = 8
): Promise<CoverCard[]> {
  const catalog = pickCatalog(cats, flavor, level, wantSteps);
  if (!catalog) return [];
  const seqs = await sampleSequences(catalog.id);
  if (seqs.length === 0) return [];
  const accent = accentFrom(sku);
  // Offset staggers WHICH sequence each flavor leads with — flavor catalogs
  // share words (same doc ids), so offset 0 across the board deals near-twins.
  const start = offset % seqs.length;
  const picked = [...seqs.slice(start), ...seqs.slice(0, start)].slice(0, n);
  return picked.map((sequence) => ({ sequence, ...accent }));
}

/** Sample at the wanted level, falling downward when that level has no
 *  enumerated pool — decks are GENERATED live at fulfillment, so a Level 3
 *  pick is real product; the preview approximates it with the closest
 *  enumerated cards until L3 bakes exist. */
async function flavorCardsAtBestLevel(
  cats: Catalog[],
  flavor: LoopFlavor,
  level: number,
  n: number,
  sku: Product | undefined,
  offset = 0,
  wantSteps = 8
): Promise<CoverCard[]> {
  for (let l = level; l >= 1; l--) {
    const cards = await flavorCards(cats, flavor, l, n, sku, offset, wantSteps);
    if (cards.length) return cards;
  }
  return [];
}

export interface PreviewDials {
  level: LoopLevel;
  length: LoopLength;
  flavor: LoopFlavor;
  excluded: ReadonlySet<LoopFlavor>;
  skuByFlavor: ReadonlyMap<LoopFlavor, Product>;
}

/** SKU-backed flavors, i.e. the ones with enumerated catalogs to sample —
 *  the variety grab bag draws from these. */
const VARIETY_POOL: readonly LoopFlavor[] = [
  "rotated",
  "mirrored",
  "swapped",
  "inverted",
  "mirrored-swapped",
  "mirrored-inverted",
  "mirrored-swapped-inverted",
];

export async function loopPreviewCards({
  level,
  length,
  flavor,
  excluded,
  skuByFlavor,
}: PreviewDials): Promise<CoverCard[] | null> {
  try {
    const cats = await getLoopCatalogs();
    const wantSteps = length === "mix" ? 8 : Number(length);

    if (flavor !== "variety") {
      const sku = skuByFlavor.get(flavor);
      if (level === "mix") {
        // "Mostly Level 1. A few cards that bite."
        const [l1, l2] = await Promise.all([
          flavorCards(cats, flavor, 1, FAN_SIZE, sku, 0, wantSteps),
          flavorCards(cats, flavor, 2, 2, sku, 0, wantSteps),
        ]);
        if (l1.length === 0) return null;
        if (l2.length === 0) return l1;
        // Tuck the bite cards into the middle of the hand.
        const mixed = [...l1.slice(0, FAN_SIZE - l2.length)];
        if (l2[0]) mixed.splice(2, 0, l2[0]);
        if (l2[1]) mixed.splice(4, 0, l2[1]);
        return mixed.slice(0, FAN_SIZE);
      }
      const cards = await flavorCardsAtBestLevel(
        cats,
        flavor,
        Number(level),
        FAN_SIZE,
        sku,
        0,
        wantSteps
      );
      return cards.length ? cards : null;
    }

    // Variety: one card per enumerated flavor (exclusions honored), rotated
    // leading — the grab bag the copy promises.
    const pool = VARIETY_POOL.filter((f) => !excluded.has(f));
    if (pool.length === 0) return null;
    const perFlavorLevel = level === "mix" ? 1 : Number(level);
    const hands = await Promise.all(
      pool.map((f, i) =>
        flavorCardsAtBestLevel(cats, f, perFlavorLevel, 1, skuByFlavor.get(f), i, wantSteps)
      )
    );
    const cards = hands.flat();
    if (level === "mix") {
      // Swap one card for an L2 rotated bite when the pool has one.
      const bite = await flavorCards(cats, "rotated", 2, 1, skuByFlavor.get("rotated"));
      if (bite[0] && cards.length > 2) cards.splice(2, 1, bite[0]);
    }
    return cards.length ? cards.slice(0, FAN_SIZE) : null;
  } catch (e) {
    console.warn("[loopPreviewCards] falling back to SKU covers:", e);
    return null;
  }
}
