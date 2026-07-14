/**
 * Canonical metadata for the per-letter Google Images SEO surface.
 *
 * One source of truth shared by:
 *  - the build-time bake (`scripts/bake-notation-images.ts`) — filenames/paths
 *  - the image sitemap (`routes/sitemap.xml/+server.ts`) — image:image entries
 *  - the indexable letter pages (`routes/(public)/notation/letters/*`)
 *  - the contract/logic tests
 *
 * Letter identity and type classification come from the canonical foundation
 * models (`Letter`, `getLetterType`) — we do not re-derive the alphabet here.
 * Type descriptions are grounded in the Flow Arts Knowledge MCP
 * (`list_available_letters`, 2026-07-14) and match the app's own type labels.
 *
 * Browser-safe: no node-only imports, so pages and the sitemap can consume it.
 */

import { Letter, getLetterType } from "../foundation/domain/models/letter";
import { LetterType } from "../foundation/domain/models/letter-type";
import letterFactsData from "./notation-letter-facts.json";

/**
 * Per-letter motion facts, generated from the canonical
 * `DiamondPictographDataframe.csv` (variation 0) by
 * `scripts/gen-notation-letter-facts.ts`. Quoting the canonical dataframe keeps
 * each letter page's copy factual and unique (not thin/duplicated).
 */
export interface LetterFacts {
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blue: { motionType: string; start: string; end: string };
  red: { motionType: string; start: string; end: string };
}

const LETTER_FACTS = letterFactsData as Record<string, LetterFacts>;

/** Grid-location code → readable name. */
const LOCATION_NAMES: Record<string, string> = {
  n: "north", e: "east", s: "south", w: "west",
  ne: "northeast", se: "southeast", sw: "southwest", nw: "northwest",
};

function loc(code: string): string {
  return LOCATION_NAMES[code] ?? code;
}

/** Canonical motion facts for a letter, or undefined if it has no dataframe row. */
export function letterFacts(letter: string): LetterFacts | undefined {
  return LETTER_FACTS[letter];
}

/** One readable sentence describing both hands' motion, from the facts. */
export function motionSentence(facts: LetterFacts): string {
  const hand = (h: { motionType: string; start: string; end: string }) =>
    h.motionType === "static" || h.start === h.end
      ? `${h.motionType} at ${loc(h.start)}`
      : `${h.motionType} from ${loc(h.start)} to ${loc(h.end)}`;
  return `Blue hand: ${hand(facts.blue)}. Red hand: ${hand(facts.red)}.`;
}

/**
 * The 47 letters that have canonical pictograph data in
 * `static/data/pictographs/DiamondPictographDataframe.csv` — the renderable,
 * bakeable set. Extended letters in the `Letter` model (μ, ν, τ-, ζ, η, τ, ⊕)
 * carry no dataframe row and are intentionally excluded. A test asserts this
 * list equals the distinct letters in the CSV.
 */
export const CANONICAL_LETTERS: readonly Letter[] = [
  // Type1: Dual-Shift (22)
  Letter.A, Letter.B, Letter.C, Letter.D, Letter.E, Letter.F, Letter.G,
  Letter.H, Letter.I, Letter.J, Letter.K, Letter.L, Letter.M, Letter.N,
  Letter.O, Letter.P, Letter.Q, Letter.R, Letter.S, Letter.T, Letter.U,
  Letter.V,
  // Type2: Shift (8)
  Letter.W, Letter.X, Letter.Y, Letter.Z,
  Letter.SIGMA, Letter.DELTA, Letter.THETA, Letter.OMEGA,
  // Type3: Cross-Shift (8)
  Letter.W_DASH, Letter.X_DASH, Letter.Y_DASH, Letter.Z_DASH,
  Letter.SIGMA_DASH, Letter.DELTA_DASH, Letter.THETA_DASH, Letter.OMEGA_DASH,
  // Type4: Dash (3)
  Letter.PHI, Letter.PSI, Letter.LAMBDA,
  // Type5: Dual-Dash (3)
  Letter.PHI_DASH, Letter.PSI_DASH, Letter.LAMBDA_DASH,
  // Type6: Static (3)
  Letter.ALPHA, Letter.BETA, Letter.GAMMA,
];

/** Human label + one-line description per type. MCP-grounded, matches app labels. */
export const LETTER_TYPE_INFO: Record<LetterType, { name: string; blurb: string }> = {
  [LetterType.TYPE1]: {
    name: "Dual-Shift",
    blurb: "Both hands shift to adjacent grid points. The most common letter type.",
  },
  [LetterType.TYPE2]: {
    name: "Shift",
    blurb: "One hand shifts to an adjacent point while the other stays static.",
  },
  [LetterType.TYPE3]: {
    name: "Cross-Shift",
    blurb: "One hand shifts and one hand dashes to the opposite point.",
  },
  [LetterType.TYPE4]: {
    name: "Dash",
    blurb: "One hand dashes to the opposite point while the other stays static.",
  },
  [LetterType.TYPE5]: {
    name: "Dual-Dash",
    blurb: "Both hands dash to opposite points simultaneously.",
  },
  [LetterType.TYPE6]: {
    name: "Static",
    blurb: "Both hands stay in place while the props rotate.",
  },
};

/** Greek glyph → ASCII name, for URL- and filename-safe slugs. */
const GREEK_TO_ASCII: Record<string, string> = {
  "Σ": "sigma",
  "Δ": "delta",
  "Θ": "theta",
  "Ω": "omega",
  "Φ": "phi",
  "Ψ": "psi",
  "Λ": "lambda",
  "α": "alpha",
  "β": "beta",
  "γ": "gamma",
};

/**
 * Convert a letter to a URL/filename-safe slug.
 * `A` → `a`, `Σ` → `sigma`, `W-` → `w-dash`, `Σ-` → `sigma-dash`.
 */
export function letterToSlug(letter: string): string {
  const isDash = letter.endsWith("-");
  const base = isDash ? letter.slice(0, -1) : letter;
  const baseSlug = GREEK_TO_ASCII[base] ?? base.toLowerCase();
  return isDash ? `${baseSlug}-dash` : baseSlug;
}

const SLUG_TO_LETTER: ReadonlyMap<string, Letter> = new Map(
  CANONICAL_LETTERS.map((l) => [letterToSlug(l), l]),
);

/** Reverse of {@link letterToSlug}, restricted to the canonical set. */
export function slugToLetter(slug: string): Letter | undefined {
  return SLUG_TO_LETTER.get(slug);
}

/** Public directory (under `static/`) that baked letter images live in. */
export const LETTER_IMAGE_DIR = "notation/letters";

/** Rendered pictograph size in px (square). Matches the app renderer viewBox. */
export const LETTER_IMAGE_SIZE = 950;
/** Smaller variant edge, used by the letters index grid and thumbnails. */
export const LETTER_IMAGE_SMALL_SIZE = 400;

/** Filename base (no extension) for a letter's baked image. */
export function letterImageBasename(letter: string): string {
  return `kinetic-alphabet-letter-${letterToSlug(letter)}`;
}

/** Absolute site paths (served from `static/`) for a letter's baked variants. */
export function letterImagePaths(letter: string) {
  const base = `/${LETTER_IMAGE_DIR}/${letterImageBasename(letter)}`;
  return {
    webp: `${base}.webp`,
    webpSmall: `${base}-small.webp`,
    png: `${base}.png`,
  };
}

export interface LetterSeo {
  letter: Letter;
  slug: string;
  type: LetterType;
  /** "Dual-Shift", "Static", … */
  typeName: string;
  /** One-line description of the type. */
  typeBlurb: string;
  /** "Type1", … for display alongside the name. */
  typeLabel: string;
  /** Page route, e.g. `/notation/letters/sigma-dash`. */
  href: string;
  /** `<title>` / og:title. */
  title: string;
  /** meta description / og:description / ImageObject.description. */
  description: string;
  /** `<img alt>` — concise, keyword-bearing. */
  alt: string;
  /** `<figcaption>` under the pictograph. */
  caption: string;
  /** Readable both-hands motion sentence from the canonical dataframe, if any. */
  motion?: string;
  facts?: LetterFacts;
  images: ReturnType<typeof letterImagePaths>;
}

/** Build the full SEO payload for one letter. */
export function letterSeo(letter: Letter): LetterSeo {
  const type = getLetterType(letter);
  const info = LETTER_TYPE_INFO[type];
  const slug = letterToSlug(letter);
  const typeLong = type.replace("Type", "Type ");
  const facts = letterFacts(letter);
  const motion = facts ? motionSentence(facts) : undefined;
  return {
    letter,
    slug,
    type,
    typeName: info.name,
    typeBlurb: info.blurb,
    typeLabel: type, // "Type1".."Type6"
    href: `/${LETTER_IMAGE_DIR}/${slug}`,
    title: `Letter ${letter} — ${info.name} Pictograph | Kinetic Alphabet Notation`,
    description:
      `The Kinetic Alphabet pictograph for letter ${letter}, a ${typeLong} ` +
      `${info.name} letter in flow arts notation. ${info.blurb}` +
      (motion ? ` ${motion}` : ""),
    alt: `Kinetic Alphabet letter ${letter} pictograph — a ${info.name} flow arts notation symbol`,
    caption: `Letter ${letter} — ${info.name} (${typeLong})`,
    motion,
    facts,
    images: letterImagePaths(letter),
  };
}

/** All 47 letters as SEO payloads, in canonical order. */
export function allLetterSeo(): LetterSeo[] {
  return CANONICAL_LETTERS.map((l) => letterSeo(l));
}
