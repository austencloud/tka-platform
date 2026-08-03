/**
 * The hero's short code, read-only.
 *
 * The phone in the hero loads the REAL `/q/<code>` for the card on screen, so
 * it needs that card's code. Two hard constraints shape how it gets one:
 *
 * 1. **Never mint.** `createShortCode` allocates and WRITES, and the scheme's
 *    whole integrity is one-code-per-hash. A public marketing page must not be
 *    a writer — a visitor loading /shop must never create Firestore documents.
 *    `findExistingCodeForSequence` is a pure read (added for exactly this):
 *    hash the sequence, query `shortcodes` by `encoderHash`, take the canonical
 *    winner, return. No allocation, and no hash-index heal either, which is why
 *    it is not the older `findExistingCodeByHash`.
 * 2. **Never block the page.** No code (unbaked card, cold catalog, offline,
 *    rules refusal) simply means no phone content. The hero renders its cards
 *    and its button stays inert rather than promising a page that isn't there.
 *
 * The manager needs a browse loader before it can be constructed, and /shop is
 * a public route that skips the app's composition root — so this configures the
 * same read-only stub `/q` uses, and only if nothing else has configured it
 * first. Codes are memoized per sequence id for the page session: dealing back
 * to a card already seen costs nothing.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import {
  configureShortCodeManager,
  getShortCodeManager,
} from "$lib/shared/qr/get-short-code-manager";

/** Code GENERATION never reads the browse cache; the same stub /q passes. */
const stubBrowseLoader = {
  loadSequenceMetadata: async () => [],
  loadFullSequenceData: async () => null,
  removeFromCache: () => {},
  addToCache: () => {},
  warmFromCache: () => {},
  refreshFromFirestore: async () => [],
} as unknown as PublicSequencesLoader;

const cache = new Map<string, Promise<string | null>>();

function keyFor(sequence: SequenceData): string {
  return sequence.id ?? sequence.word ?? JSON.stringify(sequence).slice(0, 64);
}

/** The card's existing short code, or null. Never writes, never throws. */
export function resolveHeroScanCode(
  sequence: SequenceData
): Promise<string | null> {
  const key = keyFor(sequence);
  const hit = cache.get(key);
  if (hit) return hit;

  const work = (async () => {
    try {
      try {
        getShortCodeManager();
      } catch {
        configureShortCodeManager(stubBrowseLoader);
      }
      return await getShortCodeManager().findExistingCodeForSequence(sequence);
    } catch {
      // A hero without a code shows a hero without a phone screen. That is a
      // quieter failure than anything this page could say about it.
      return null;
    }
  })();

  cache.set(key, work);
  return work;
}
