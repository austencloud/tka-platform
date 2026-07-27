# /notation as a catalog — design

**Date:** 2026-07-26
**Status:** design, awaiting review
**Supersedes:** the hub built by `2026-07-18-notation-shape-matrix-destination-design.md`, gated in `b4c870dfb7`

## Why

The `/notation` hub was taken down on 2026-07-26 and now renders the shared
`UnderConstruction` note in production. It failed on two axes at once.

**It explained systems it did not own.** Three claims in one section were wrong
or unsourced:

1. "Cushing later dropped the same idea onto a three by three grid as 9-Square
   Theory." Backwards — DrexFactor's 9-square posts date to 2009 and 2010, the
   QFT notation guide to May 2011 — and no source connects the two that way.
   Per Austen's own wiki, 9-Square maps *where* patterns happen spatially and
   QFT is the shorthand for writing the movements down.
2. VTG reduced to a timing × direction 2×2. DrexFactor describes VTG as
   combining timing, direction, **and the shapes made by spinning flowers**.
   The 2×2 was a consequence of the reduction, not a design choice.
3. QFT expanded to "Quantized Field Theory" as flat fact. The guide the page
   cites never expands the acronym; the same site tags those posts "quantum
   field theory"; the `QFT_Notation.wiki` draft that says "Quantized Field
   Theory Notation" is stamped `{{AI generated}}` and is not independent
   confirmation.

**Its layout was a wall.** Full-measure prose, oversized static figures, three
different content widths down one page, and no composition at 4K.

Austen's framing, 2026-07-26: *"a little pretentious to try to actually explain
QFT ... a little reductive to explain [VTG] as a two by two grid ... I think 99%
of the people who discover what I'm doing are at the beginning of their
journey."* And: *"framing it as a catalog seems more honest and short than
trying to explain the previous systems."*

## What the page is

A chronological catalog of systems for writing flow arts down. Roughly ten
entries, oldest first. No system is explained. Every line traces to a source
that was read.

The page answers exactly one question — *has anyone tried to write flow arts
down before?* — and then gets out of the way. It is not an argument for TKA, not
a tutorial, and not a table of contents for this site's own material.

## Sourcing rules (hard)

These are the point of the rebuild. They are not style preferences.

1. **Every factual line traces to a primary source read during implementation.**
   Not to memory, not to the current page's copy, and not to the flow-arts-wiki
   drafts.
2. **The wiki drafts are research leads, never citations.** `E:\flow-arts-wiki`
   has 181 drafts, a citation policy, an `{{Unverified claim}}` template, and
   downloaded transcripts — but every article is stamped `{{AI generated}}` and
   they contradict each other. `Poi_notation.wiki` dates TKA to "~2018" and
   credits "(developer)"; `The_Kinetic_Alphabet.wiki` and `Austen_Cloud.wiki`
   both say c. 2022 and name Austen. The summary table is the least reliable
   file in the repo and the one shaped most like this page. Source every row
   individually; never lift the table.
3. **Prefer the creator's own material.** noelyee.com for VTG, Cushing's own
   video series for 9-Square and QFT, sirlorq.com for Lorq's catalogs, Tiffany
   Fong's repository for PoiNotation, the Home of Poi threads where CAPs
   actually happened. Third-party documentation is a secondary link, used where
   the creator published nothing, and never the standing citation under an
   entry someone else authored. Ben Drexler appears where he is genuinely the
   author — he co-built the trigonometric model with Zaltymbunk — not beneath
   everyone else's work.
4. **An entry that cannot be sourced does not ship.** If Unit Circle Theory has
   no readable primary, it comes off the list. If a date cannot be established,
   the entry carries no date rather than an invented one.
5. **No acronym gets expanded without a primary.** The page writes "QFT
   Notation" and stops.
6. **No relationship claims between systems.** The current page invented one.
   Comparative framing is exactly the register a catalog avoids.

## Entries

Chronological. Status column records what has already been verified during
design; everything else is implementation research.

| Year | System | People | Status |
|---|---|---|---|
| 2009 | Vulcan Tech Gospel | Noel Yee, the Vulcan Lofts, Oakland | ✅ timing, direction, **and flower shapes** |
| c. 2010 | 9-Square Theory | Charlie Cushing | ✅ spatial grid, one plane, 10-part series |
| 2010 | Transition Theory | Noel Yee, Jordan Campbell | source needed |
| 2011 | QFT Notation | Charlie Cushing | ✅ 8 positions + formula; **acronym not expanded** |
| ? | Unit Circle Theory | ? | source needed; drop if none |
| 2012– | Lorq Nichols' catalogs | Lorq Nichols, with Brian Thompson, David Cantor, Noel Yee | 144 Shape Matrix ✅ 2012; other works undated |
| 2009 or 2013 | Continuous Assembly Patterns | Home of Poi forums; Nick Woolsey, Alien Jon | date conflict to resolve |
| 2016 | PoiNotation | Tiffany Fong | on the old page, re-verify |
| 2017 | Trigonometric model | Zaltymbunk, Ben Drexler | source needed |
| c. 2022 | The Kinetic Alphabet | Austen Cloud | ✅ per wiki, corrected from ~2018 |

### Lorq is one entry, not four

Decided against four rows after building both in
`static/sketches/2026-07-26-notation-spine.html`. Splitting them required
inventing years for Tech Tiles, 324 Patterns, and Book of P.H.A.T. — breaking
rule 4 on the first row that used it — and broke the chronology, running
2012 → 2013 → 2014 → 2015 → 2013 once CAPs followed. It also printed "Lorq
Nichols" four times consecutively, which reads as a stutter rather than as
weight. One entry titled *Lorq Nichols' catalogs*, dated **2012–** (open-ended,
no invented end), with the four works named in a sub-list.

### Siteswap is not an entry

Flow arts did not exist as a category in 1985, siteswap is a juggling notation,
and heading a flow arts spine with it implies a lineage that is not real. The
genuine influence is a borrowed *idea* — cut a continuous flow into beats, give
each beat a symbol — not a system anyone spun with.

One short line above the spine acknowledges the two outside loans, siteswap for
beats and music notation for a compact score, with links. The spine itself
starts in 2009, where flow arts notation actually starts.

## Row anatomy

Five fields, every row identical, no per-entry accent colors and no decorative
images. The uniformity is the argument: a record where every entry has the same
shape is a record that is not arguing.

- **Year** — the visual anchor, large, left rail, `tabular-nums`
- **System name**
- **People** — who, and where when the place matters (the Vulcan Lofts, the
  Home of Poi forums)
- **One line** — what it records. Sourced or absent. Never how to use it.
- **Sources** — one to three, out to the creator's own material

Optional sixth: a **video strip** (below).

### Data shape

One typed array, `src/lib/shared/notation/notation-catalog.ts`:

```ts
interface CatalogEntry {
  id: string;
  year: string;              // display string: "2009", "c. 2010", "2012–"
  sortYear: number;          // ordering only; never rendered
  system: string;
  people: string;
  records: string;           // the one sourced line
  subWorks?: { name: string; note: string }[];   // Lorq only, today
  sources: { label: string; href: string }[];
  videos?: { id: string; title: string; creator: string; year: string; note: string }[];
}
```

`sources[].href` is one field per link, so pointing rows at `flowarts.wiki`
articles when that wiki ships is a data edit, not a layout change. The wiki is
not live today (`flowarts.wiki` does not resolve), so v1 links primaries.

## Video strip

Austen, 2026-07-26: *"if we can find links to specific videos that explain these
that would be absolutely sexy as hell ... a little video playlist underneath."*

**Constraint:** the site CSP blocks `frame-src` for YouTube (`hooks.server.ts`),
so an inline player is impossible. The house pattern is
`src/routes/(public)/notation/caps/_components/CapsVideoCard.svelte` — poster
thumbnail from `img.youtube.com`, play affordance, opens YouTube in a new tab,
labelled-tile fallback when the thumbnail 404s.

Promote that component to `src/lib/shared/components/SourceVideoCard.svelte` and
have the CAPs page consume the shared version. Do not fork it
(`.claude/rules/never-hand-roll.md`).

An entry renders a strip of these when the creator taught the system on video —
Cushing's 9-Square series is a 10-part playlist and fills a strip on its own.
**Every video ID is loaded and confirmed live before it ships.** No strip for an
entry with no creator video; a strip is never padded with third-party coverage
to reach a row of four.

## Layout

Chronological spine. Year in a left rail, entry content flowing right, a
hairline rule between rows. Prototyped in
`static/sketches/2026-07-26-notation-spine.html`.

- Band is `--shell-w` like every other public page; no bespoke width.
- Rows are `rem`-sized so they ride the lockstep root ramp to 3840.
- **Known unsolved:** in the sketch, rows use ~800px of a 1720px band at 1920,
  leaving the right half empty — worse at 4K. Likely fix is moving sources (and
  the video strip) into their own right-hand column so a row spans the band, but
  this gets resolved against real viewports during implementation, not by
  arithmetic. `.claude/rules/4k-native-layout.md` applies: the band is fluid,
  no orphan rows, no dead rail.
- Below ~46rem the spine collapses to a stacked list, year above system.
- No layout shift: the year column is fixed-width with `tabular-nums`; video
  thumbnails carry `aspect-ratio: 16/9`.

## Removed

Everything in `_components/NotationHubDraft.svelte`: the Rosetta row (QFT circle
SVG, VTG 2×2, single TKA pictograph), the siteswap and PoiNotation code
figures, Lorq's chart image, the shape-matrix teaser, the LOOP teaser, the CAPs
teaser, the demo section, the prop on-ramp prose, and the closing CTA card.

The sub-pages are untouched. `/notation/shape-matrix`, `/notation/loops`,
`/notation/caps`, the per-prop pages, and the letter index are TKA's own
material and keep their place in the header nav. **The catalog links out, to
other people's sites.** It is not an index of this site.

Exception: the TKA row links to `/guide`, because every row links to its
creator's own material and TKA's creator's own material is this site. That is
the consistent choice; a CTA button would be the funnel choice, and there is
none.

Delete `_components/NotationHubDraft.svelte` once the catalog ships.

## SEO and un-gating

- Remove the `dev` gate from `src/routes/(public)/notation/+page.svelte`.
- Drop `noindex`; restore the Article/BreadcrumbList JSON-LD with copy matching
  the new page.
- Re-add `{ url: "notation" }` to `src/routes/sitemap.xml/+server.ts`.
- Update `tests/unit/notation-roots-remediation-contract.test.ts`: the "notation
  hub gate" describe block comes out, and the copy contracts that currently
  guard `NotationHubDraft.svelte` are replaced by contracts on the catalog data
  (every entry has ≥1 source; no entry has an unsourced date; no `frame`/embed
  markup for video).

## Verification

- Screenshots at 3840×2160, 2560×1440, 1920×1080, 1440×900, 820×1180, 960×412,
  375×667 before any completion claim
  (`.claude/rules/visual-verification-mandatory.md`).
- Every outbound link loaded and confirmed to resolve.
- Every video ID loaded and confirmed to play.
- `npm run check` clean for files in the diff.

## Open items

1. Unit Circle Theory — find a primary or drop the entry.
2. CAPs date — 2009 (Home of Poi forums, per the current CAPs page) vs 2013
   (`Poi_notation.wiki`). Resolve at the forum thread.
3. Transition Theory and the trigonometric model need primaries.
4. Whether Cushing published an expansion of "QFT" anywhere.
5. The 4K width problem above.
