import { getPrintCardRenderer } from "../getPrintCardRenderer";
import { renderSignupCardPair } from "./PrintCardRenderer";
import type { CardPair } from "./types";
import { getImageComposer } from "$lib/shared/render/get-image-composer";
import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
import { configureShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import uniquePackManifests from "../data/festival-sampler-manifests.json";
import {
  FESTIVAL_SHEET_CARD_COUNT,
  placeFestivalSignupAtCenter,
} from "./festival-sampler-sheet";
import {
  festivalSamplerCardKey,
  festivalSamplerFingerprint,
  festivalSamplerManifestRevision,
  type FestivalSamplerCardManifest,
} from "./festival-sampler-manifest";
import { resolveFestivalSamplerCardSequence } from "./festival-sampler-turns";
import {
  buildFestivalSamplerRenderOptions,
  FESTIVAL_SAMPLER_NAME,
} from "./festival-sampler-render-options";

export {
  buildFestivalSamplerRenderOptions,
  FESTIVAL_SAMPLER_NAME,
} from "./festival-sampler-render-options";

export {
  applyFestivalSamplerTurnAssignment,
  findCompatibleFestivalSamplerTurnPattern,
  loadFestivalSamplerBaseSequence,
  resolveFestivalSamplerCardSequence,
} from "./festival-sampler-turns";

export {
  festivalSamplerCardKey,
  festivalSamplerFingerprint,
  festivalSamplerManifestRevision,
} from "./festival-sampler-manifest";

export const FESTIVAL_SAMPLER_CARD_COUNT = FESTIVAL_SHEET_CARD_COUNT;

export type SelectedCard = FestivalSamplerCardManifest;

export interface FestivalSamplerPair extends CardPair {
  slot: string;
  name: string;
}

export interface FestivalSamplerPack {
  packNumber: number;
  fingerprint: string;
  pairs: FestivalSamplerPair[];
}

export interface FestivalSamplerProgress {
  current: number;
  total: number;
  label: string;
}

const packManifests = (uniquePackManifests.candidates ?? []) as Array<{
  cards: SelectedCard[];
}>;
export const FESTIVAL_SAMPLER_MAX_PACKS = packManifests.length;
const FESTIVAL_SAMPLER_MANIFEST_REVISION =
  festivalSamplerManifestRevision(packManifests);
const CLASSIC_POSITIONS = new Set(["alpha1", "beta5", "gamma11"]);
const THEME = "rainbow";

interface CachedBatchRender {
  promise: Promise<FestivalSamplerPack[]>;
  progress: FestivalSamplerProgress | null;
  listeners: Set<(progress: FestivalSamplerProgress) => void>;
}

// Moving between app modules destroys the deck-releaser component. Keep the
// expensive card canvases alive for this browser session so reopening the
// festival job restores the finished preview instead of drawing every card
// again. Include the frozen-manifest revision so regenerating a card recipe
// cannot bring an older canvas back into the print job.
const batchRenderCache = new Map<string, CachedBatchRender>();

function assertClassicEndpoints(
  card: SelectedCard,
  sequence: SequenceData
): void {
  const startPosition =
    sequence.startPosition?.gridPosition ?? sequence.steps[0]?.startPosition;
  const endPosition =
    sequence.steps.at(-1)?.endPosition ??
    (sequence.isCircular ? startPosition : undefined);

  if (
    !CLASSIC_POSITIONS.has(startPosition ?? "") ||
    !CLASSIC_POSITIONS.has(endPosition ?? "")
  ) {
    throw new Error(
      `${card.name} must start and end in Alpha, Beta, or Gamma; got ${startPosition ?? "unknown"} → ${endPosition ?? "unknown"}`
    );
  }
}

async function renderSequencePair(
  card: SelectedCard
): Promise<FestivalSamplerPair> {
  const sequence = await resolveFestivalSamplerCardSequence(card);
  assertClassicEndpoints(card, sequence);
  const options = buildFestivalSamplerRenderOptions(card, sequence);
  const renderer = getPrintCardRenderer();
  const [front, back] = await Promise.all([
    renderer.renderFront(sequence, options),
    renderer.renderBack(sequence, options),
  ]);

  return {
    front,
    back,
    label: card.name,
    slot: card.slot,
    name: card.name,
    renderMeta: { sequence, options },
  };
}

/**
 * Render a batch of distinct festival handout sheets. Identical cards shared
 * by several packs are rendered once, then the same canvases are reused in
 * each sheet. No sequence generator or image viewer is involved.
 */
async function renderFestivalSamplerBatchUncached(
  packCount: number,
  onProgress?: (progress: FestivalSamplerProgress) => void
): Promise<FestivalSamplerPack[]> {
  const count = Math.floor(packCount);
  if (!Number.isFinite(count) || count < 1 || count > packManifests.length) {
    throw new Error(
      `Festival sampler supports 1-${packManifests.length} unique packs; received ${packCount}`
    );
  }

  const manifests = packManifests.slice(0, count);
  const fingerprints = manifests.map((manifest) =>
    festivalSamplerFingerprint(manifest.cards)
  );
  if (new Set(fingerprints).size !== manifests.length) {
    throw new Error(
      "Festival sampler batch contains duplicate pack assortments"
    );
  }

  configureShortCodeManager(getBrowseLoader());
  getImageComposer().setQRCodeGenerator(getQRCodeGenerator());

  const uniqueCards = new Map<string, SelectedCard>();
  for (const manifest of manifests) {
    if (manifest.cards.length !== FESTIVAL_SHEET_CARD_COUNT - 1) {
      throw new Error(
        `Festival pack needs 8 sample cards; received ${manifest.cards.length}`
      );
    }
    for (const card of manifest.cards) {
      uniqueCards.set(festivalSamplerCardKey(card), card);
    }
  }

  const total = uniqueCards.size + 1;
  const renderedByKey = new Map<string, FestivalSamplerPair>();
  let current = 0;
  for (const [key, card] of uniqueCards) {
    onProgress?.({
      current,
      total,
      label: `Rendering ${current + 1} of ${uniqueCards.size}: ${card.name}`,
    });
    renderedByKey.set(key, await renderSequencePair(card));
    current += 1;
  }

  onProgress?.({
    current,
    total,
    label: "Rendering signup card",
  });
  const signup = await renderSignupCardPair({
    theme: THEME,
    cardSize: "poker",
  });
  const signupPair: FestivalSamplerPair = {
    front: signup.front,
    back: signup.back,
    label: "Start Here",
    slot: "signup",
    name: "Start Here",
  };

  const packs = manifests.map((manifest, index) => {
    const samples = manifest.cards.map((card) => {
      const rendered = renderedByKey.get(festivalSamplerCardKey(card));
      if (!rendered) {
        throw new Error(`Festival sampler render missing: ${card.name}`);
      }
      return rendered;
    });
    return {
      packNumber: index + 1,
      fingerprint: fingerprints[index]!,
      pairs: placeFestivalSignupAtCenter(samples, signupPair),
    };
  });

  onProgress?.({
    current: total,
    total,
    label: `${packs.length} unique packs ready to print`,
  });
  return packs;
}

export function renderFestivalSamplerBatch(
  packCount: number,
  onProgress?: (progress: FestivalSamplerProgress) => void
): Promise<FestivalSamplerPack[]> {
  const count = Math.floor(packCount);
  const cacheKey = `${FESTIVAL_SAMPLER_MANIFEST_REVISION}:${count}`;
  const existing = batchRenderCache.get(cacheKey);
  if (existing) {
    if (onProgress) {
      existing.listeners.add(onProgress);
      if (existing.progress) onProgress(existing.progress);
    }
    return existing.promise.finally(() => {
      if (onProgress) existing.listeners.delete(onProgress);
    });
  }

  const listeners = new Set<(progress: FestivalSamplerProgress) => void>();
  if (onProgress) listeners.add(onProgress);
  const cached: CachedBatchRender = {
    promise: Promise.resolve([]),
    progress: null,
    listeners,
  };
  cached.promise = renderFestivalSamplerBatchUncached(count, (progress) => {
    cached.progress = progress;
    for (const listener of cached.listeners) listener(progress);
  }).catch((cause) => {
    batchRenderCache.delete(cacheKey);
    throw cause;
  });
  batchRenderCache.set(cacheKey, cached);

  return cached.promise.finally(() => {
    if (onProgress) cached.listeners.delete(onProgress);
  });
}

/** Render the approved control pack for the capture harness. */
export async function renderFestivalSampler(
  onProgress?: (progress: FestivalSamplerProgress) => void
): Promise<FestivalSamplerPair[]> {
  const [pack] = await renderFestivalSamplerBatch(1, onProgress);
  return pack!.pairs;
}
