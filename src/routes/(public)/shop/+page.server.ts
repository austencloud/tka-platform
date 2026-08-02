import type { PageServerLoad } from "./$types";

/**
 * The catalog, server-rendered.
 *
 * /shop used to render a "Coming soon" panel for everyone but an admin, so the
 * server had nothing to load. It's the storefront now: crawlers and the first
 * paint both need the real product list in the HTML.
 *
 * Cover cards are deliberately left behind. Each one carries a full sequence
 * document, and shipping all of them would put roughly half a megabyte of JSON
 * in the page for art the browser fetches as baked images anyway. The page
 * paints its text and prices from this list, then swaps in the full catalog
 * (covers included) from the client once it mounts.
 */
const LIGHT_FIELDS = [
  "name",
  "description",
  "type",
  "listing",
  "price",
  "status",
  "sortOrder",
  "stripePriceId",
  "preorder",
  "shipBy",
  "cardCount",
  "coverImageUrl",
  "deckId",
  "regularPrice",
  "regularStripePriceId",
  "preorderPriceCutoff",
] as const;

export const load: PageServerLoad = async () => {
  let products: Record<string, unknown>[] = [];
  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const snapshot = await db
      .collection("products")
      .where("status", "==", "active")
      .orderBy("sortOrder", "asc")
      .get();
    products = snapshot.docs.map((doc) => {
      const data = doc.data();
      const light: Record<string, unknown> = { id: doc.id };
      for (const field of LIGHT_FIELDS) {
        if (data[field] !== undefined) light[field] = data[field];
      }
      // JSON round-trip strips anything Firestore-shaped (Timestamps, refs) so
      // the payload survives the SSR boundary.
      return JSON.parse(JSON.stringify(light));
    });
  } catch {
    // Non-fatal: the page loads the catalog from the client instead.
  }
  return { products };
};
