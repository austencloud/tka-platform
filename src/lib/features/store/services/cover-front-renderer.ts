/**
 * cover-front-renderer
 *
 * Renders shop cover cards through the REAL print pipeline
 * (PrintCardRenderer.renderFront: canonical locked visibility + MPC frame +
 * TnD/flavor accent), so a shop fan shows the exact card a buyer receives,
 * not an approximation. Returns object URLs, cached per (sequence, accent)
 * for the session; renders are throttled to a few lanes so a grid of fans
 * doesn't stampede the composition worker.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CoverCard } from "../domain/models/product";
import { getPrintCardRenderer } from "$lib/features/choreo-card/getPrintCardRenderer";
import { getCatalogLayoutPolicy } from "$lib/features/choreo-card/domain/catalog-layout-policy";
import type { TnDElement } from "$lib/features/choreo-card/domain/tnd-element";
import type { PrintRenderOptions } from "$lib/features/choreo-card/services/types";

const urlCache = new Map<string, Promise<string>>();

// Bounded lanes: cover fans can queue 12+ renders at once on /shop.
const MAX_LANES = 3;
let active = 0;
const waiters: (() => void)[] = [];

async function acquireLane(): Promise<void> {
  if (active < MAX_LANES) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}

function releaseLane(): void {
  active--;
  waiters.shift()?.();
}

function frameElement(card: CoverCard): TnDElement | undefined {
  if (!card.accentColor) return undefined;
  // The front path consumes accentColor / darkComplement / cardTintOpacity /
  // iconPath; the identity fields just satisfy the type.
  return {
    familyId: "cover",
    name: card.footerCenter ?? "cover",
    element: "cover",
    accentColor: card.accentColor,
    darkComplement: card.darkComplement ?? "#444444",
    iconPath: card.iconPath ?? "",
    cardTintOpacity: card.tintOpacity ?? 0.1,
  };
}

/**
 * Render one cover card front and return an object URL for an <img>.
 * Deck id/name feed QR attribution, same as the print path.
 */
export function renderCoverFront(
  card: CoverCard,
  deck: { deckId?: string; deckName?: string } = {}
): Promise<string> {
  const seq = card.sequence;
  const key = `${seq.id ?? seq.word ?? "?"}|${card.accentColor ?? "-"}|${card.footerCenter ?? "-"}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const work = (async () => {
    await acquireLane();
    try {
      const stepCount = seq.steps?.length ?? 8;
      const options: PrintRenderOptions = {
        includeStartPosition: true,
        // Same policy as the print preview: 8/12-count cards put the start
        // position in the left column.
        startPositionLayout: getCatalogLayoutPolicy(stepCount),
        showMandala: true,
        tndElement: frameElement(card),
        notes: card.footerCenter ?? "",
        iconPath: card.iconPath,
        ...(deck.deckId && { deckId: deck.deckId }),
        ...(deck.deckName && { deckName: deck.deckName }),
      };
      const canvas = await getPrintCardRenderer().renderFront(seq as SequenceData, options);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("cover front toBlob returned null");
      return URL.createObjectURL(blob);
    } finally {
      releaseLane();
    }
  })();

  // A failed render shouldn't poison the cache for the session.
  urlCache.set(key, work);
  work.catch(() => urlCache.delete(key));
  return work;
}
