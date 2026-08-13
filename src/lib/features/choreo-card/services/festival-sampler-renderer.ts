import { TND_BY_FAMILY } from "../domain/tnd-element";
import { getCatalogLayoutPolicy } from "../domain/catalog-layout-policy";
import { hydrateSequence } from "./catalog-loader";
import { applyVariationDescriptor } from "./deck-variation";
import { getPrintCardRenderer } from "../getPrintCardRenderer";
import { renderSignupCardPair } from "./PrintCardRenderer";
import type { CardPair, PrintRenderOptions } from "./types";
import { getImageComposer } from "$lib/shared/render/get-image-composer";
import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
import { configureShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { hydrate as hydrateCompositionalSequence } from "$lib/shared/foundation/services/sequence-hydrator";
import uniquePackManifests from "../data/festival-sampler-manifests.json";
import publicSnapshot from "../../../../../static/data/snapshots/public-sequences.json";
import tndBaseWords from "../../../../../static/data/hero/tnd-base-words.json";
import localSequences from "../../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-local-sequences.json";
import {
  FESTIVAL_SHEET_CARD_COUNT,
  placeFestivalSignupAtCenter,
} from "./festival-sampler-sheet";
import {
  festivalSamplerCardKey,
  festivalSamplerFingerprint,
  type FestivalSamplerCardManifest,
} from "./festival-sampler-manifest";

export {
  festivalSamplerCardKey,
  festivalSamplerFingerprint,
} from "./festival-sampler-manifest";

export const FESTIVAL_SAMPLER_NAME = "Festival Sampler 2026";
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
const publicDocuments = (publicSnapshot.documents ?? []) as unknown as Array<
  Record<string, unknown>
>;
const localTndRecords = new Map(
  (tndBaseWords as Array<Record<string, unknown>>).map((record) => [
    record.name as string,
    record,
  ])
);
const localSequenceRecords = (localSequences.records ?? {}) as Record<
  string,
  Record<string, unknown>
>;
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
// again. A rejected render is removed below so Retry can do real work.
const batchRenderCache = new Map<number, CachedBatchRender>();

async function findPublicSequence(card: SelectedCard): Promise<SequenceData> {
  const indexed = publicDocuments.find(
    (sequence) =>
      sequence.id === card.id && sequence.sourceRef === card.sourceRef
  );
  if (!indexed) throw new Error(`Published sequence not found: ${card.name}`);

  // The pinned public snapshot carries the compositional source fields. The
  // canonical hydrator reconstructs renderable steps locally, so opening this
  // urgent print job never waits on a per-card Firestore source read.
  const sequence = hydrateCompositionalSequence(hydrateSequence(indexed));
  if (sequence.steps.length === 0) {
    throw new Error(`Published sequence has no renderable steps: ${card.name}`);
  }
  return sequence;
}

async function loadCardSequence(card: SelectedCard): Promise<SequenceData> {
  if (card.source === "publicSequences") return findPublicSequence(card);

  if (card.source === "catalog") {
    const record = localTndRecords.get(card.name);
    if (!record)
      throw new Error(`Festival sampler TnD source is missing: ${card.name}`);
    const base = hydrateSequence(record);
    if ((card.turnIntensity ?? 0) === 0) return base;
    if (card.turnIntensity === 1) {
      return applyVariationDescriptor(base, { turnPattern: "1|1" }, [])
        .sequence;
    }
    throw new Error(
      `Festival sampler does not support ${card.turnIntensity} turns for ${card.name}`
    );
  }

  const localRecord = localSequenceRecords[card.name];
  if (localRecord) return hydrateSequence(localRecord);

  throw new Error(`Festival sampler source is missing: ${card.name}`);
}

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

function buildOptions(
  card: SelectedCard,
  sequence: SequenceData
): PrintRenderOptions {
  const element = card.familyId ? TND_BY_FAMILY[card.familyId] : undefined;
  const center = element
    ? `${element.name} · ${element.element} · ${card.ratio}`
    : FESTIVAL_SAMPLER_NAME;

  return {
    canvasWidth: 822,
    canvasHeight: 1122,
    bleedPx: 36,
    includeStartPosition: true,
    startPositionLayout: getCatalogLayoutPolicy(sequence.steps.length),
    showMandala: true,
    // The signup card owns the pack's funnel QR. The sample cards keep their
    // info cell available for the mandala, including the 4×2 eight-step layout.
    showQRCode: false,
    theme: THEME,
    tndElement: element,
    bluePropType: PropType.STAFF,
    redPropType: PropType.STAFF,
    leftLabel: element?.element,
    rightLabel: element
      ? card.turnIntensity === 0
        ? "no turns"
        : `${card.turnIntensity} turn`
      : undefined,
    notes: center,
    iconPath: element?.iconPath,
    deckId: "festival-sampler-2026",
    deckName: FESTIVAL_SAMPLER_NAME,
  };
}

async function renderSequencePair(
  card: SelectedCard
): Promise<FestivalSamplerPair> {
  const sequence = await loadCardSequence(card);
  assertClassicEndpoints(card, sequence);
  const options = buildOptions(card, sequence);
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
  const existing = batchRenderCache.get(count);
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
    batchRenderCache.delete(count);
    throw cause;
  });
  batchRenderCache.set(count, cached);

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
