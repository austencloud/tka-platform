import { GLOSSARY } from "@tka/domain";
import type { GlossaryCategory } from "@tka/domain";
import type { PageServerLoad } from "./$types";

// Static reference — render the whole lexicon at build time. The @tka/domain
// package stays server-side (this load runs at prerender), so the GLOSSARY
// never ships to the client; only the serialized view-model does.
export const prerender = true;

// Display order + human labels for every GlossaryCategory. Core concepts first,
// then the vocabulary that builds on them. Covers the full union type — a new
// category added upstream without a row here would be dropped (guarded below).
const CATEGORY_ORDER: { key: GlossaryCategory; label: string }[] = [
  { key: "general", label: "Core Concepts" },
  { key: "position", label: "Positions" },
  { key: "letterType", label: "Letter Types" },
  { key: "motion", label: "Motions" },
  { key: "rotation", label: "Rotations" },
  { key: "grid", label: "Grid Modes" },
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
  cw: "CW",
  ccw: "CCW",
  "rubiks-cube": "Rubik's Cube",
  "tau-dash": "Tau-Dash (τ-)",
};

function displayName(key: string): string {
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

  const groups = CATEGORY_ORDER.map(({ key, label }) => {
    const terms = entries
      .filter(([, e]) => e.category === key)
      .map(([k, e]) => ({
        term: displayName(k),
        slug: slugOf.get(k)!,
        definition: e.definition,
        examples: e.examples,
        // Only link related terms that resolve to an on-page anchor.
        related: e.relatedTerms
          .filter((r) => slugOf.has(r))
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
