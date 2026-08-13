import { TND_BY_FAMILY } from "../domain/tnd-element";
import { getCatalogLayoutPolicy } from "../domain/catalog-layout-policy";
import { hydrateSequence } from "./catalog-loader";
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
import selectedPack from "../../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-selected.json";
import publicSnapshot from "../../../../../static/data/snapshots/public-sequences.json";
import tndRecords from "../../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-tnd-records.json";
import localSequences from "../../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-local-sequences.json";
import {
  FESTIVAL_SHEET_CARD_COUNT,
  placeFestivalSignupAtCenter,
} from "./festival-sampler-sheet";

export const FESTIVAL_SAMPLER_NAME = "Festival Sampler 2026";
export const FESTIVAL_SAMPLER_CARD_COUNT = FESTIVAL_SHEET_CARD_COUNT;

interface SelectedCard {
  slot: string;
  source: "publicSequences" | "catalog" | "packLocal";
  id?: string;
  sourceRef?: string;
  catalogId?: string;
  docId?: string;
  name: string;
  vtgFamily?: string;
  element?: string;
  ratio?: string;
  turnIntensity?: number;
}

export interface FestivalSamplerPair extends CardPair {
  slot: string;
  name: string;
}

export interface FestivalSamplerProgress {
  current: number;
  total: number;
  label: string;
}

const cards = (selectedPack.cards ?? []) as SelectedCard[];
const publicDocuments = (publicSnapshot.documents ?? []) as unknown as Array<
  Record<string, unknown>
>;
const localTndRecords = (tndRecords.records ?? {}) as Record<
  string,
  Record<string, unknown>
>;
const localSequenceRecords = (localSequences.records ?? {}) as Record<
  string,
  Record<string, unknown>
>;
const CLASSIC_POSITIONS = new Set(["alpha1", "beta5", "gamma11"]);
const THEME = "rainbow";

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

  const localRecord =
    card.source === "packLocal"
      ? localSequenceRecords[card.name]
      : localTndRecords[card.name];
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
  const familyId =
    card.vtgFamily === "Split-Same"
      ? "split-same"
      : card.vtgFamily === "Together-Same"
        ? "tog-same"
        : undefined;
  const element = familyId ? TND_BY_FAMILY[familyId] : undefined;
  const center = element
    ? `${card.vtgFamily} · ${card.element} · ${card.ratio}`
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
    leftLabel: element ? card.element : undefined,
    rightLabel: element ? `${card.turnIntensity} turn` : undefined,
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

/** Render the fixed festival handout sheet. No generation tools are involved. */
export async function renderFestivalSampler(
  onProgress?: (progress: FestivalSamplerProgress) => void
): Promise<FestivalSamplerPair[]> {
  configureShortCodeManager(getBrowseLoader());
  getImageComposer().setQRCodeGenerator(getQRCodeGenerator());

  const rendered: FestivalSamplerPair[] = [];
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index]!;
    onProgress?.({
      current: index,
      total: FESTIVAL_SAMPLER_CARD_COUNT,
      label: `Rendering ${index + 1} of ${cards.length}: ${card.name}`,
    });
    rendered.push(await renderSequencePair(card));
  }

  onProgress?.({
    current: cards.length,
    total: FESTIVAL_SAMPLER_CARD_COUNT,
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

  // Center the signup card in the 3×3 handout sheet.
  const pairs = placeFestivalSignupAtCenter(rendered, signupPair);
  onProgress?.({
    current: pairs.length,
    total: FESTIVAL_SAMPLER_CARD_COUNT,
    label: "Ready to print",
  });
  return pairs;
}
