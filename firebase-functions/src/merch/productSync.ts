import type Stripe from "stripe";

/**
 * Pure mapping from a Stripe Product (the Dashboard is the editor) to the flat
 * Firestore `products` doc the storefront reads. TKA-specific fields ride in
 * Stripe product metadata. Price/stripePriceId are set separately by price.* events,
 * so this object is merged (never overwrites them).
 */
export function mapStripeProductToDoc(product: Stripe.Product): Record<string, unknown> {
  const meta = product.metadata || {};
  const doc: Record<string, unknown> = {
    name: product.name,
    description: product.description ?? "",
    status: product.active ? "active" : "draft",
    coverImageUrl: product.images?.[0] ?? "",
    previewImageUrls: product.images ?? [],
    type: meta.type || "physical-deck",
    sortOrder: meta.sortOrder ? Number(meta.sortOrder) : 0,
  };
  if (meta.cardCount) doc.cardCount = Number(meta.cardCount);
  if (meta.deckId) doc.deckId = meta.deckId;
  if (meta.preorder === "true") doc.preorder = true;
  if (meta.shipBy) doc.shipBy = meta.shipBy;
  return doc;
}
