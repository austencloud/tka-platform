# Level 1 Guide — Page Numbering + Auto-Updating TOC

**Date:** 2026-06-22
**Status:** Approved (Austen, 2026-06-22 — "proceed through spec, plan, implementation")
**Related:** `2026-06-21-guide-rebuild-tracker.md`

## Goal

Give the printable Level 1 guide a real book page-numbering system and a Table
of Contents that derives its page numbers from a single source of truth, so:

1. The TOC page numbers update automatically as pages are built / reordered.
2. Page numbers print in the correct place, **recto/verso** (alternating to the
   outer corner like the original bound guide).
3. Numbers can be toggled on/off (not every read needs a print copy).
4. Numbers are **final and correct now** — the full body page sequence is
   reserved up front (Austen's call), so building a page fills content into an
   already-numbered slot rather than shifting numbers.

## Decisions (locked)

- **Reserve full sequence now.** Manifest enumerates every body page; unbuilt
  pages render as numbered placeholders. Numbers match the intended final
  pagination from day one.
- **On-screen toggle button** in the viewer chrome (drives screen + print),
  default ON.
- **Paged.js rejected.** Its `target-counter()` is the web-standard way to
  auto-number a TOC from *flowing* content, but we author discrete one-page
  `GuidePage` units, so an explicit manifest is simpler, deterministic, and
  SSR-safe. Paged.js's reflow engine would also fight the GuidePage WYSIWYG model
  and pictograph rendering.

## Architecture

### 1. Single source of truth — `_data/guide-manifest.ts`

Ordered array of **body** pages (front matter excluded). One entry per physical
page:

```ts
export type GuidePageEntry = {
  id: string;            // stable slug, e.g. "the-grid"
  title: string;         // TOC label
  level: 0 | 1;          // 0 = section row, 1 = indented sub-entry
  group: "1.0" | "1.1" | "1.2";  // TOC section grouping + heading
};
export const GUIDE_BODY_PAGES: GuidePageEntry[] = [ /* … */ ];
```

Page number = `index + 1` (first body page = 1 = The Grid). Helpers:
`pageNumberOf(id)`, `entryByPage(n)`. Seeded from the rebuild's intended
pagination (tracker inventory + original TOC), 1 entry = 1 reserved page. As real
pages split/merge during conversion, entries are added/removed and **all
downstream numbers + the TOC re-derive automatically.**

Initial seed (34 body pages):

- **1.0 Positions / Motions** (p1–p10): The Grid, Hand Positions, Hand Motions,
  └ Type 1 Dual-Shifts - Alpha/Beta, └ Gamma / Type 2 Shifts, └ Type 3/4
  Cross-Shifts and Dashes, └ Type 5/6 Dual-Dashes and Statics, Staff Positions,
  Staff Motions, Negative Space / Body Turns.
- **1.1 Letters** (p11–p29): Base Letters, └ Double Staff, └ Clubs, └ Buugeng,
  └ Triads, └ Fans, └ Mini Hoops, Type 1 - Dual-Shifts, └ ABC GHI, └ DJ EK FL,
  └ MP NQ OR STUV, Type 2 - Shifts, └ WXYZ ΣΔθΩ, Type 3 - Cross-Shifts,
  └ W- X- Y- Z- …, Type 4 5 6, └ Φ Ψ Λ, └ Φ- Ψ- Λ-, └ α β γ.
- **1.2 Words** (p30–p34): Words, Permutations, Reversals, Examples with A B C,
  Misc. Permutation Examples.

### 2. Toggle state — `_data/page-number-prefs.svelte.ts`

A rune module exporting a reactive singleton `{ show: boolean }` (default true).
GuidePage footers and the toggle button both read/write it. (Follows the
project's `*.svelte.ts` factory/singleton pattern.)

### 3. `GuidePage.svelte` — page-number footer

New optional props: `pageNumber?: number`. Renders a footer with the number at
the bottom **outer** corner: odd → right, even → left (page 1 = recto/right).
Footer hidden when `pageNumber` is undefined (front matter) or `prefs.show` is
false.

Print-fidelity change: keep the sheet at a fixed **8.5×11in** in print (stop
collapsing `min-height`), set `@page { size: Letter; margin: 0 }`, and let the
sheet's own padding supply the printed margin. This makes the absolutely
positioned footer land at the same spot on screen and on paper (true WYSIWYG),
and avoids CSS `counter(page)` (which counts front matter and can't express the
manifest's numbering). Risk: the @page-margin change touches existing pages'
print margins — verify all front-matter pages still print correctly.

### 4. `GuideTOC.svelte` — generated TOC

Extract the TOC into its own component that reads `GUIDE_BODY_PAGES`. Renders
section groups (1.0 / 1.1 / 1.2 headings), level-0 rows and level-1 indented
subs, each with a dot leader + page number. Replaces the hardcoded `TOC`/
`TOC_LEFT`/`TOC_RIGHT` arrays currently in the print route. Keeps the existing
de-blanded styling (Fraunces heads, gold rule, two columns, flourish).

### 5. `PagePlaceholder.svelte` — numbered placeholder

For manifest entries not yet built: a centered "{title}" + a muted "in progress"
note, inside a normal numbered GuidePage. Lets the doc carry the full, correctly
numbered sequence while content is filled in page-by-page.

### 6. `PageNumberToggle.svelte` — viewer control

A small button fixed in the viewer chrome (the dark backdrop, screen-only,
`@media print { display:none }`). Flips `prefs.show`. Label: "Page numbers ·
On/Off".

### 7. Print route wiring

- Front matter pages (cover, drink water, support, read me, TOC) stay hardcoded,
  **unnumbered**. TOC becomes `<GuideTOC />`.
- After front matter, **map `GUIDE_BODY_PAGES`**: each entry → `GuidePage` with
  `pageNumber={i+1}`; content = the built component for that `id` if one exists,
  else `<PagePlaceholder>`.
- Remove the legacy continuous-flow block (`<PositionsMotions/> <Letters/>
  <Words/>` + `.legacy-chapters`). The section components (`TheGrid.svelte`, etc.)
  remain in the repo for reuse inside per-page GuidePages during conversion.
- Mount `<PageNumberToggle />`.

A small `id → built page component` registry (initially empty) maps manifest ids
to real per-page components as they're built. Until an id is registered, that
page renders a placeholder.

## Data flow

`guide-manifest.ts` (order + titles)
→ page number = index+1
→ `GuideTOC` reads manifest → renders rows with numbers
→ print route maps manifest → `GuidePage pageNumber=n` (real | placeholder)
→ `GuidePage` footer renders n at outer corner, gated by `page-number-prefs`.

One edit to the manifest updates TOC numbers, footer numbers, and page order
together.

## Out of scope

- Converting chapter content into real per-page GuidePages (that's the ongoing
  p6+ rebuild; this spec only builds the numbering/TOC scaffold + placeholders).
- Matching the original's exact multi-page section pagination (our manifest is
  the source of truth; it starts 1:1 per TOC entry and refines during conversion).
- Front-matter numbering (intentionally unnumbered, per the original).

## Verification

- Screenshot the TOC: numbers present, match manifest order, subs indented.
- Screenshot a body page (placeholder): number at outer corner, correct parity.
- Toggle off → numbers gone on screen; toggle on → back.
- `npm run check` green.
- Compare footer placement against the original PDF; adjust offset to match.
