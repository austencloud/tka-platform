import type { Product } from "../domain/models/product";

/**
 * TEMP DEMO FIXTURE — remove before public launch.
 *
 * Placeholder products that flesh out the shop grid for layout / transition work
 * before the real catalog exists. Merged into the ADMIN view only
 * (product-loader.loadAllProducts) and served by loadProduct so the detail page
 * and the grid<->detail morph work when you click one. They are NEVER added to
 * loadActiveProducts, so the public shop stays clean, and every one is status
 * "draft" as a second guard.
 *
 * To remove: delete this file and the two DEMO_PRODUCTS references in
 * product-loader.ts. No other wiring touches it.
 *
 * Covers are inline gradient SVGs (data URIs): no network, instant, and
 * DETERMINISTIC — the grid and the detail render the exact same image, so the
 * shared-element morph reads as one continuous object. Swap coverImageUrl for a
 * real rendered card once art exists.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Greedy word-wrap so long names (e.g. real deck titles) don't overflow the cover. */
function wrapLines(name: string, maxChars = 16, maxLines = 3): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length > maxChars) {
      lines.push(cur);
      // Last allowed line: dump the remaining words so nothing is dropped.
      if (lines.length === maxLines - 1) {
        return [...lines, words.slice(i).join(" ")];
      }
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** A 3:4 gradient cover with a soft mark and the (wrapped) product name. Returns a data URI. */
function cover(name: string, from: string, to: string, accent: string): string {
  const lines = wrapLines(name);
  const lh = 46;
  const startY = 600 - ((lines.length - 1) * lh) / 2;
  const tspans = lines
    .map((ln, i) => `<tspan x="300" y="${startY + i * lh}">${esc(ln)}</tspan>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="600" height="800" fill="url(#g)"/>` +
    `<circle cx="300" cy="300" r="150" fill="none" stroke="${accent}" stroke-width="5" opacity="0.45"/>` +
    `<circle cx="300" cy="300" r="96" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.25"/>` +
    `<text text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" ` +
    `font-size="40" font-weight="700" fill="#ffffff">${tspans}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// On-brand placeholder palettes (from, to, accent). Picked deterministically per id.
const PLACEHOLDER_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ["#1e293b", "#2563eb", "#93c5fd"], // slate -> blue
  ["#312e81", "#7c3aed", "#a78bfa"], // indigo -> violet
  ["#0f766e", "#06b6d4", "#5eead4"], // teal -> cyan
  ["#831843", "#a21caf", "#f0abfc"], // magenta -> purple
  ["#92400e", "#f59e0b", "#fcd34d"], // amber -> orange
  ["#064e3b", "#10b981", "#6ee7b7"], // emerald -> green
  ["#881337", "#e11d48", "#fda4af"], // rose -> red
];

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * TEMP DEV FALLBACK — remove before public launch (with the rest of this fixture).
 *
 * Real Firestore products ship with coverImageUrl: "" until rendered card art
 * exists (worker-pool pipeline). To fill the shop grid for layout / transition
 * work, give any product with an empty cover a deterministic gradient placeholder
 * — same generator as the demo products, so the grid<->detail morph still reads
 * as one continuous object. Does NOT mutate Firestore; the real doc stays honest.
 */
export function withPlaceholderCover(p: Product): Product {
  if (p.coverImageUrl) return p;
  const [from, to, accent] =
    PLACEHOLDER_PALETTES[hashId(p.id) % PLACEHOLDER_PALETTES.length]!;
  return { ...p, coverImageUrl: cover(p.name, from, to, accent) };
}

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
    coverImageUrl: cover("TKA Book", "#312e81", "#7c3aed", "#a78bfa"),
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
    coverImageUrl: cover("Sampler Deck", "#0f766e", "#06b6d4", "#5eead4"),
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
    coverImageUrl: cover("Wall Poster", "#831843", "#a21caf", "#f0abfc"),
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
    coverImageUrl: cover("Practice Staffs", "#1e293b", "#2563eb", "#93c5fd"),
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
    coverImageUrl: cover("Sticker Sheet", "#92400e", "#f59e0b", "#fcd34d"),
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
    coverImageUrl: cover("TKA Mug", "#064e3b", "#10b981", "#6ee7b7"),
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
    coverImageUrl: cover("TKA Tee", "#881337", "#e11d48", "#fda4af"),
    sortOrder: 160,
  },
];
