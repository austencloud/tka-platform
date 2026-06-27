import type { Product } from "../domain/models/product";

/**
 * TEMP DEMO FIXTURE — remove before public launch.
 *
 * Placeholder products that flesh out the shop grid for layout / transition work
 * before the real catalog exists. Merged into the ADMIN view only
 * (product-loader.loadAllProducts) and served by loadProduct so the detail page
 * and the grid<->detail view-transition morph work when you click one. They are
 * NEVER added to loadActiveProducts, so the public shop stays clean, and every
 * one is status "draft" as a second guard.
 *
 * To remove: delete this file and the two DEMO_PRODUCTS references in
 * product-loader.ts. No other wiring touches it.
 *
 * No coverImageUrl on purpose — the empty state exercises the placeholder cover
 * (CardMockupPreview), which is what the morph currently animates.
 */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-book",
    name: "The Kinetic Alphabet Book",
    description:
      "The full system in print. Every letter, position, and motion type, with practice progressions that build from first spin to free flow.",
    type: "guide",
    price: 3900,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    preorder: true,
    shipBy: "October 2026",
    sortOrder: 100,
  },
  {
    id: "demo-sampler",
    name: "Starter Sampler Deck",
    description:
      "Thirty-two cards pulled from across the decks. A taste of every loop type before you commit to a full set.",
    type: "sampler-pack",
    price: 1500,
    cardCount: 32,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    sortOrder: 110,
  },
  {
    id: "demo-poster",
    name: "TKA Wall Poster",
    description:
      "The complete alphabet chart on one wall. 24 by 36 inches, matte stock, ready to frame.",
    type: "material",
    price: 2400,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    sortOrder: 120,
  },
  {
    id: "demo-staffs",
    name: "TKA Practice Staffs (Pair)",
    description:
      "A matched pair of practice staffs, weighted for clean spins and stalls. Marked thumb and pinky ends so the orientation references stay readable.",
    type: "material",
    price: 4800,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    preorder: true,
    shipBy: "November 2026",
    sortOrder: 130,
  },
  {
    id: "demo-stickers",
    name: "TKA Sticker Sheet",
    description:
      "Die-cut vinyl sheet. Twelve pictographs and the TKA mark, weatherproof for water bottles and prop cases.",
    type: "material",
    price: 800,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    sortOrder: 140,
  },
  {
    id: "demo-mug",
    name: "TKA Mug",
    description:
      "11 oz ceramic mug printed with a full rotated loop that wraps the whole cup.",
    type: "material",
    price: 1800,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    sortOrder: 150,
  },
  {
    id: "demo-tee",
    name: "TKA Tee",
    description:
      "Soft cotton tee with the alphabet grid across the back and the mark on the chest.",
    type: "material",
    price: 3200,
    stripePriceId: "",
    status: "draft",
    previewImageUrls: [],
    sortOrder: 160,
  },
];
