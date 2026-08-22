import { GLOSSARY, TERM_ALIASES, resolveTermAlias } from "@tka/domain";
import type { GlossaryCategory } from "@tka/domain";
import type { PageServerLoad } from "./$types";

// Static reference: render the current glossary at build time. The @tka/domain
// package stays server-side (this load runs at prerender); the page receives a
// serialized view-model of the glossary entries it displays.
export const prerender = true;

type PublicGlossaryCategory = GlossaryCategory | "letter";

const LETTER_ENTRY_PATTERN =
  /^letter-(?:[a-z](?:-dash)?|(?:alpha|beta|gamma|delta|lambda|omega|phi|psi|sigma|theta)(?:-dash)?)$/;

function publicCategory(
  entryKey: string,
  category: GlossaryCategory
): PublicGlossaryCategory {
  return LETTER_ENTRY_PATTERN.test(entryKey) || entryKey === "tau-dash"
    ? "letter"
    : category;
}

// Display order + human labels for every public category. Core concepts first,
// then the vocabulary that builds on them. A missing row is guarded below.
const CATEGORY_ORDER: { key: PublicGlossaryCategory; label: string }[] = [
  { key: "general", label: "Core Concepts" },
  { key: "position", label: "Positions" },
  { key: "letter", label: "Letter Codex" },
  { key: "letterType", label: "Letter Types" },
  { key: "motion", label: "Motions" },
  { key: "rotation", label: "Rotations" },
  { key: "grid", label: "Grid" },
  { key: "notation", label: "Notation" },
  { key: "sequence", label: "Words & Sequences" },
  { key: "execution", label: "Execution & Technique" },
];

// GLOSSARY keys are lowercase kebab slugs — that's the data/MCP lookup layer.
// Humans read Title Case with spaces, so the page displays humanized names.
// Overrides cover acronyms and special casing; hyphens that carry meaning
// (the "-" letter-suffix convention) keep their hyphen.
const DISPLAY_OVERRIDES: Record<string, string> = {
  vtg: "VTG",
  caps: "CAPs",
  pads: "PADS",
  "rubiks-cube": "Rubik's Cube",
  "tau-dash": "Tau-Dash (τ-)",
  "type-1": "Type 1: Dual-Shift",
  "type-2": "Type 2: Shift",
  "type-3": "Type 3: Cross-Shift",
  "type-4": "Type 4: Dash",
  "type-5": "Type 5: Dual-Dash",
  "type-6": "Type 6: Static",
  "quarter-opposite": "Quarter-Opposite",
  "quarter-same": "Quarter-Same",
};

const GREEK_LETTER_DISPLAY: Record<string, string> = {
  alpha: "Alpha (α)",
  beta: "Beta (β)",
  gamma: "Gamma (γ)",
  delta: "Delta (Δ)",
  lambda: "Lambda (Λ)",
  omega: "Omega (Ω)",
  phi: "Phi (Φ)",
  psi: "Psi (Ψ)",
  sigma: "Sigma (Σ)",
  theta: "Theta (Θ)",
};

function letterDisplayName(key: string): string | null {
  if (!LETTER_ENTRY_PATTERN.test(key)) return null;

  const rawName = key.slice("letter-".length);
  const dashed = rawName.endsWith("-dash");
  const baseName = dashed ? rawName.slice(0, -"-dash".length) : rawName;
  const latinLetter = baseName.length === 1 ? baseName.toUpperCase() : null;
  const baseDisplay = latinLetter ?? GREEK_LETTER_DISPLAY[baseName];
  if (!baseDisplay) return null;

  if (!dashed) return baseDisplay;
  const symbol = latinLetter ?? baseDisplay.match(/\((.+)\)/)?.[1];
  const spokenName = latinLetter ?? baseDisplay.split(" ")[0];
  return `${spokenName}-Dash (${symbol}-)`;
}

function displayName(key: string): string {
  const letterName = letterDisplayName(key);
  if (letterName) return letterName;
  const override = DISPLAY_OVERRIDES[key];
  if (override) return override;
  return key
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugify(key: string, i: number): string {
  const s = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Greek-only keys (α, ψ …) slugify to empty — fall back to a stable index slug.
  return s || `term-${i}`;
}

export const load: PageServerLoad = () => {
  // Slugs derive from the raw KEY (not the display name) so existing #anchors
  // and JSON-LD @ids stay stable across display-name changes.
  const sortedKeys = Object.keys(GLOSSARY).sort();
  const slugOf = new Map<string, string>();
  sortedKeys.forEach((k, i) => slugOf.set(k, slugify(k, i)));

  // Object.entries types the value as GlossaryEntry (not `| undefined`), so this
  // avoids the noUncheckedIndexedAccess flags that GLOSSARY[key] would raise.
  const entries = Object.entries(GLOSSARY);
  const aliasesByTerm = new Map<string, string[]>();
  for (const [alias, target] of Object.entries(TERM_ALIASES)) {
    if (!(target in GLOSSARY)) continue;
    const aliases = aliasesByTerm.get(target) ?? [];
    aliases.push(alias);
    aliasesByTerm.set(target, aliases);
  }

  function resolveRelatedTerm(term: string): string | null {
    if (slugOf.has(term)) return term;
    const resolved = resolveTermAlias(term);
    return slugOf.has(resolved) ? resolved : null;
  }

  const groups = CATEGORY_ORDER.map(({ key, label }) => {
    const terms = entries
      .filter(([entryKey, e]) => publicCategory(entryKey, e.category) === key)
      .map(([k, e]) => ({
        term: displayName(k),
        slug: slugOf.get(k)!,
        aliases: aliasesByTerm.get(k) ?? [],
        definition: e.definition,
        examples: e.examples,
        // Direct glossary keys win; aliases are only a fallback. This keeps a
        // canonical entry from being redirected by an over-broad alias.
        related: e.relatedTerms
          .map(resolveRelatedTerm)
          .filter((r): r is string => r !== null)
          .map((r) => ({ term: displayName(r), slug: slugOf.get(r)! })),
        benefit: e.benefit ?? null,
        importance: e.importance ?? null,
      }))
      .sort((a, b) => a.term.localeCompare(b.term));
    return { key, label, sectionSlug: `cat-${key.toLowerCase()}`, terms };
  }).filter((g) => g.terms.length > 0);

  const placed = groups.reduce((n, g) => n + g.terms.length, 0);
  // Loud during build if an entry's category has no row above.
  if (placed !== entries.length) {
    console.warn(
      `[glossary] ${entries.length - placed} term(s) dropped — category missing from CATEGORY_ORDER`
    );
  }

  return { groups, total: placed };
};
