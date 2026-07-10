/**
 * cover-baker
 *
 * Bakes shop cover-card fronts into Firebase Storage so public visitors load
 * plain <img> URLs instead of running the print pipeline in their browser
 * (the /shop fan used to render 12+ cards from scratch per fresh session).
 *
 * Admin-only: renders each unbaked cover through the REAL print pipeline
 * (renderCoverFront — pixel-identical to what ships), uploads the PNG to
 * shop-covers/{productId}/{index}.png, and writes the download URL back onto
 * the product doc's coverCards entry. DeckFanCover prefers card.imageUrl and
 * falls back to live rendering, so unbaked/new products keep working.
 *
 * Re-bake: edit a product's coverCards (the bake only fills cards missing
 * imageUrl), or clear imageUrl fields to force a re-render.
 */

import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestoreInstance, getStorageInstance } from "$lib/shared/auth/firebase";
import type { Product, CoverCard } from "../domain/models/product";
import { renderCoverFront, prewarmCovers } from "./cover-front-renderer";

export interface BakeProgress {
  readonly totalCards: number;
  readonly bakedCards: number;
  readonly currentProduct: string | null;
  readonly errors: string[];
}

function unbaked(cards: readonly CoverCard[] | undefined): CoverCard[] {
  return (cards ?? []).filter((c) => !c.imageUrl && c.sequence);
}

/** Count of cover cards across products that still need baking. */
export function countUnbaked(products: readonly Product[]): number {
  return products.reduce((n, p) => n + unbaked(p.coverCards).length, 0);
}

/**
 * Bake every unbaked cover card across the given products. Sequential per
 * card (the renderer already lane-throttles); progress via callback.
 */
export async function bakeCoverImages(
  products: readonly Product[],
  onProgress?: (p: BakeProgress) => void
): Promise<BakeProgress> {
  const targets = products.filter((p) => unbaked(p.coverCards).length > 0);
  const progress: {
    totalCards: number;
    bakedCards: number;
    currentProduct: string | null;
    errors: string[];
  } = {
    totalCards: countUnbaked(products),
    bakedCards: 0,
    currentProduct: null,
    errors: [],
  };
  if (!targets.length) return progress;

  // Seed the composition worker once for everything we're about to render.
  prewarmCovers(targets.flatMap((p) => p.coverCards ?? []));

  const firestore = await getFirestoreInstance();
  const storage = await getStorageInstance();

  for (const product of targets) {
    progress.currentProduct = product.name;
    onProgress?.({ ...progress });

    const cards = product.coverCards ?? [];
    const updated: CoverCard[] = [];
    let changed = false;

    for (const [i, card] of cards.entries()) {
      if (card.imageUrl || !card.sequence) {
        updated.push(card);
        continue;
      }
      try {
        const objectUrl = await renderCoverFront(card, {
          deckId: product.deckId,
          deckName: product.name,
        });
        const blob = await (await fetch(objectUrl)).blob();
        const storageRef = ref(storage, `shop-covers/${product.id}/${i}.png`);
        await uploadBytes(storageRef, blob, {
          contentType: "image/png",
          cacheControl: "public,max-age=31536000,immutable",
        });
        const downloadUrl = await getDownloadURL(storageRef);
        updated.push({ ...card, imageUrl: downloadUrl });
        changed = true;
        progress.bakedCards++;
        onProgress?.({ ...progress });
      } catch (e) {
        progress.errors.push(`${product.name} card ${i}: ${e}`);
        updated.push(card);
        onProgress?.({ ...progress });
      }
    }

    if (changed) {
      try {
        await updateDoc(doc(firestore, "products", product.id), {
          coverCards: updated,
        });
      } catch (e) {
        progress.errors.push(`${product.name} doc update: ${e}`);
      }
    }
  }

  progress.currentProduct = null;
  onProgress?.({ ...progress });
  return progress;
}
