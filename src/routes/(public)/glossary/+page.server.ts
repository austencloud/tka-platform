import { GLOSSARY } from "@tka/domain";
import type { GlossaryCategory } from "@tka/domain";
import type { PageServerLoad } from "./$types";

// Static reference — render the whole lexicon at build time. The @tka/domain
// package stays server-side (this load runs at prerender), so the 110-entry
// GLOSSARY never ships to the client; only the serialized view-model does.
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

function slugify(term: string, i: number): string {
  const s = term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Greek-only keys (α, ψ …) slugify to empty — fall back to a stable index slug.
  return s || `term-${i}`;
}

export const load: PageServerLoad = () => {
  // Object.entries types the value as GlossaryEntry (not `| undefined`), so this
  // avoids the noUncheckedIndexedAccess flags that GLOSSARY[key] would raise.
  const sortedEntries = Object.entries(GLOSSARY).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const slugOf = new Map<string, string>();
  sortedEntries.forEach(([t], i) => slugOf.set(t, slugify(t, i)));

  const groups = CATEGORY_ORDER.map(({ key, label }) => {
    const terms = sortedEntries
      .filter(([, e]) => e.category === key)
      .map(([t, e]) => ({
        term: t,
        slug: slugOf.get(t)!,
        definition: e.definition,
        examples: e.examples,
        // Only link related terms that resolve to an on-page anchor.
        related: e.relatedTerms
          .filter((r) => slugOf.has(r))
          .map((r) => ({ term: r, slug: slugOf.get(r)! })),
        benefit: e.benefit ?? null,
        importance: e.importance ?? null,
      }));
    return { key, label, sectionSlug: `cat-${key.toLowerCase()}`, terms };
  }).filter((g) => g.terms.length > 0);

  const placed = groups.reduce((n, g) => n + g.terms.length, 0);
  // Loud during build if an entry's category has no row above.
  if (placed !== sortedEntries.length) {
    console.warn(
      `[glossary] ${sortedEntries.length - placed} term(s) dropped — category missing from CATEGORY_ORDER`
    );
  }

  return { groups, total: placed };
};
