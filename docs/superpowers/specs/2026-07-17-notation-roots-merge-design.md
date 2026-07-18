# Flow Arts Notation Page — Merge `/notation` + `/roots` into a Comparative Lineage

**Date:** 2026-07-17
**Status:** Brainstormed with Austen this session; awaiting spec review
**Branch:** `feat/notation-roots-merge` (worktree `C:/worktrees/tka-platform/notation-redesign`)

## The Problem

`/notation` today is seven sections of the same shape — an `<h2>` followed by one
or two tidy paragraphs (`What It Is`, `The Thirty-Second Demo`, `Built on VTG`,
`It Started on Paper`, `Where to Start`, `Notation by Prop`, CTA). That uniform
header-per-bite-sized-topic rhythm is the exact structural tell `ai-bust` flags as
AI-authored. The page *asserts* everything and *shows* almost nothing — the only
live artifact is the hero demo. No worked examples.

`/roots` overlaps it: "what TKA is built on" (VTG, siteswap, music theory,
synthesis). It names influences but never shows how any of them notates a move and
never compares them to TKA. The distinction between the two pages is thin, and both
render as a 46rem single column — a stretched phone strip on a 4K monitor — while
the `public-editorial.css` breakout system (`has-duo` / `breakout` / `cinema`) that
`/composer` uses sits unused here.

Austen's direction (this session): merge the two into one honest, comparative page
on the *family* of flow-arts notation systems. Give credence to what came before,
position TKA as a de-facto peer (not the be-all-end-all; no FAQ-conqueror framing),
**show an example for every claim** instead of uniform prose, and take real
advantage of 4K by reconfiguring the layout — not inflating the type. This is the
notation-side sibling of the already-shipped `/roots/software` ("The History of
Flow Arts Software"), which is the reference implementation for the tone and the
research rigor.

## Approach: Hybrid-A (lineage opens the page, resolves into TKA-unique)

Chosen with Austen over the two alternatives:

- **A — lineage is the spine** (pure "History of Flow Arts Notation," TKA as one
  chapter). Maximum credence, but turns the "flow arts notation" search-entry page
  into a mostly-historical read.
- **B — lineage is a supporting section** (page stays "here's TKA, go start," opens
  with credence). Keeps the entry/conversion job, less bold.
- **Hybrid-A (selected):** the lineage is the *emotional and structural opening* —
  TKA among peers, shown with examples — and then resolves into "and here's what TKA
  uniquely does; go try it." `/roots` folds in.

## Page structure

`/notation` — title stays **"Flow Arts Notation"** (owns the head term). Five beats:

1. **Opening — the family, not the pitch.** Writing flow down is an old, unsolved
   problem; many have taken a run at it. Humble framing up front, no product pitch.
2. **What came before — the verified lineage, each *shown*.** The load-bearing
   section (detail below). Every system is *shown* (a real example of how *it*
   writes a move down), not just named. `/roots`' influence material folds in here,
   reframed as "the family this belongs to." **TKA appears inside this list as one
   member.**
3. **Where TKA fits.** The lineage resolves into TKA's specific contribution — the
   one that makes prop choreography *readable like sheet music* (the exact gap
   `/roots/software` already names: "the one thing missing is notation"). Framed as
   "here's what TKA adds," never "TKA is the answer."
4. **See it work.** The existing live demo (`SequenceHeroDemo`, real pictographs).
   Examples over assertions.
5. **Go start.** Guide / cards / composer handoff — trimmed from the current
   "Where to Start."

## Section 2 content — the verified lineage

Sourced by two research passes this session (local `C:\flow-arts-wiki` + web
verification). **The local wiki articles are self-labeled `{{AI generated}}`, so
they are a map, not proof — only web-verified, sourced systems ship,** each with a
real citation (a `resource-chip`, same as `/roots/software`). No unverified claim
goes on the page.

| System | Creator | How it notates a move | Show it as | Verified source |
|---|---|---|---|---|
| **VTG** | Noel Yee / Vulcan Lofts (~2010) | Timing (tog/split) × Direction (same/opp) taxonomy + snapshots + 1:1/1:3/1:5 shape ratios | The SS/TS/SO/TO 2×2 | drexfactor.com, noelyee.com, Wikipedia "Poi definitions" |
| **QFT** | Charlie Cushing (~2011), doc. by Drex | 8 positions numbered 1–8 clockwise around the circle; a move = origin→destination (e.g. `8 ⇒ 1`) + hand/radius/direction | The numbered circle + one `8 ⇒ 1` move | [drexfactor.com QFT guide](https://drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation) |
| **Lorq Nichols / Spin Science** | Lorq Nichols | Shape Matrix (8×8 L-hand × R-hand grid), Book of P.H.A.T., 324 Patterns — visual/combinatorial | The Shape-Matrix grid idea | [sirlorq.wordpress.com](https://sirlorq.wordpress.com/about-2/) (NOT spinscience.xyz — cert expired) |
| **PoiNotation** | Tiffany Fong (2016) | A Scala text DSL that compiles written syntax into circular-motion building blocks; a CS course project, never shipped | A short code-like syntax line | [github.com/tiffanyfong/PoiNotation](https://github.com/tiffanyfong/PoiNotation) |
| **Siteswap** | Magnusson & Tiemann (~1985) | Numeric per-beat throw-timing for *juggling*; Beever's Generalised Siteswap (~2000) adds orientation rows | The ancestor idea (one symbol per beat), honestly framed as juggling, not spinning | jugglinglab.org, Wikipedia, juggle.fandom.com |
| **9-Square Theory** | Charlie Cushing | Quantizes motion onto a 3×3 grid around the body | Optional; the 3×3 grid | drexfactor.com |
| **TKA** | Austen Cloud | Letters + pictographs on a 9-point grid, center-referenced; beats spell speakable words | A real pictograph | (self) |

Clock notation ("3 o'clock") is the informal folk shorthand everyone already uses —
worth a one-line nod as the un-authored baseline QFT formalized, not a system with a
creator to cite.

### The centerpiece device — the "Rosetta row"

**One simple move shown in 3 notations side by side:** QFT's `8 ⇒ 1`, VTG's
tog-same, and the TKA pictograph for the same motion. The reader *sees* that TKA is
one dialect among many, and *sees* why the pictograph is the readable one. This is
the credence framing and the de-facto-peer framing and the "examples for everything"
principle, all in a single visual. It is the emotional core of the page.

- Rec: **3 systems** in the row (QFT, VTG, TKA) — legible; 4 crowds it. *(Decision 2
  below.)*
- The TKA cell uses a real pictograph (MCP `generate_pictograph` at authoring time,
  saved as an asset — never a hand-drawn fake). QFT/VTG cells are lightweight inline
  SVG or a sourced screenshot in a `shot-strip`.

## Framing / tone rules (the four calls, approved)

1. **Drop the light/dark toggle** (`LightsToggleButton`) — interactive chrome
   competing for attention on a "what is notation" page; live teaching belongs in
   the guide.
2. **Do not teach alpha/beta/gamma here.** At most one concrete example if it earns
   its place in "what TKA uniquely does," with the real lesson linked to `/guide`.
   Not a mini-course on the entry page.
3. **Kill the AI tone by construction:** no uniform `<h2>` + two-paragraphs rhythm.
   Every claim carries a real example (a prior-system sample, a pictograph, the
   Rosetta row, a live demo), and section *shapes vary* (prose, side-by-side duo,
   comparison rows). Structural variety is the fix, not reworded copy. **All final
   user-facing copy gets an `ai-bust` pass before ship** (and a grep for em dashes
   per `no-em-dashes` before handover).
4. **4K via the existing breakout system.** `has-duo` / `breakout` / `cinema` /
   `duo-uw` in `public-editorial.css` — the Rosetta row and demos claim full width
   while prose holds its ~46ch reading measure. Reconfigure, don't inflate type.

## Component reuse (never-hand-roll — grep evidence)

Nothing new is created. Confirmed by reading the current pages this session:

- **`SequenceHeroDemo`** (`src/lib/shared/landing/components/SequenceHeroDemo.svelte`)
  — live demo; already used on `/notation`. **Reuse.**
- **`public-editorial.css`** (`src/lib/shared/landing/styles/public-editorial.css`)
  — `editorial`, `editorial-section`, `has-duo`/`section-duo`, `breakout`/`cinema`,
  `resource-chip`, `resource-row`, `cta-card`, `bullet-list`, `prop-links`, and the
  1680px 4K tier. **Reuse; extend here if a comparison needs a layout it lacks —
  never fork.**
- **`shot-strip` galleries** — the sourced-screenshot pattern from
  `/roots/software` (`src/routes/(public)/roots/software/+page.svelte`). **Reuse**
  for prior-system visuals.
- **`PositionTrioGrid`** (`src/lib/shared/landing/components/PositionTrioGrid.svelte`)
  — only if the single sanctioned alpha/beta/gamma example earns a slot; otherwise
  dropped with the toggle.
- Pictographs come from MCP (`generate_pictograph`) baked to assets, consistent with
  the `/notation/letters` per-letter images just merged to main.

## `/roots` merge + information architecture

- **`/notation` absorbs `/roots`' influence content** (VTG, siteswap-as-ancestor,
  music theory) into section 2 + a short "what TKA is built on" beat inside "Where
  TKA fits."
- **`/roots` → 301 redirect to `/notation`.** It becomes redundant once its content
  lives in `/notation`, and `/notation` owns the "flow arts notation" head term.
  *(Decision 1 below — the alternative is a thin `/roots` stub.)*
- **`/roots/software` stays at its URL** (established, indexed, link equity). It is
  the software sibling and is not moved under `/notation`. Its breadcrumb + any
  "roots page" cross-links currently pointing at `/roots` get re-pointed at
  `/notation`. *(Decision 3 below.)*
- **Redirect + link mechanics to handle:** `src/config/domains.ts`
  (`MARKETING_EXACT` / `PUBLIC_PATH_PREFIXES` — `/roots` is currently a public
  prefix; the new redirect must not orphan `/roots/software`), the sitemap
  (`src/routes/sitemap.xml/+server.ts` — drop `/roots`, keep `/notation` and
  `/roots/software`), and every internal `href="/roots"` in the app (nav, footer,
  `/notation`'s own "Built on VTG" link, `/roots/software`, `/composer`) — grep and
  update to `/notation`.
- **SEO:** `/notation` keeps its canonical + Article JSON-LD + head-term title; the
  software cluster from `2026-07-16-flow-arts-software-seo-design.md` stays intact.

## Fold-in — fix the broken `/roots/software` Spin Science link

The research found **`spinscience.xyz` has an expired TLS certificate** and does not
load. `/roots/software` links to it (`spinScience: "http://spinscience.xyz/"`). This
is a live broken link on production. Repoint to `https://sirlorq.wordpress.com/`
(verified live). Separately, the page's PoiNotation reference is now confirmed
(Tiffany Fong, 2016) and may name the creator + link the GitHub. Small; batched here
because the same research produced it.

## Out of scope

- Rebuilding `/roots/software` (only the broken-link fix + breadcrumb re-point).
- New notation-teaching content (that is `/guide`'s job).
- The `/notation/letters` per-letter pages (just merged to main; they stay and get
  cross-linked, not reworked).

## Verification plan

- `npm run check` (types) + `npm run build`, in the worktree on a free port.
- **4K visual proof** of the breakout sections and the Rosetta row at a real
  ~3840-wide viewport (per `no-layout-shift` and the 4K intent) — DevTools screenshot
  or a `test/` harness; not a markup grep.
- **Redirect proof:** `curl -k` `/roots` returns 301 → `/notation`; `/roots/software`
  still 200.
- **Link proof:** `sirlorq.wordpress.com` resolves; no `spinscience.xyz` reference
  remains.
- `ai-bust` pass + em-dash grep on all final copy before ship.
- Existing `seo-head-contract` / sitemap unit tests still green.

## Open questions for spec review

1. **`/roots` → 301 to `/notation`, or keep a thin `/roots` "influences" stub?**
   Recommendation: **301** — it kills the thin distinction and keeps the content in
   one place. Risk (inbound links to `/roots`) is covered by the redirect.
2. **Rosetta row: 3 systems (QFT, VTG, TKA) or 4 (add Lorq's Shape Matrix)?**
   Recommendation: **3** — legibility.
3. **Keep `/roots/software` at its URL** (rec: yes) vs move it under `/notation`?
