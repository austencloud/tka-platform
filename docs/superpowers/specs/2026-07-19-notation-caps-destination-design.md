# /notation/caps — The CAP Story (Historical v1)

**Date:** 2026-07-19
**Status:** Approved shape (Austen picked "historical v1" via MC); content pending research
verification before ship
**Route:** `/notation/caps` (sibling of `/notation/loops` and `/notation/shape-matrix`)

## Problem

TKA's LOOP algebra has a real intellectual neighbor: CAPs (Continuous Assembly Patterns),
a poi-community concept with its own history and its own people. Giving LOOPs front-page
treatment without crediting CAPs thoroughly would misrepresent the landscape. The credit
deserves more than a lineage paragraph on the LOOPs page — it gets its own destination
(Austen, 2026-07-19: "give credence to CAPs thoroughly, which is its own spec entirely").

## Ground truth (MCP `get_term_definition("CAP")`, retrieved 2026-07-19)

- CAPs coined by **Damien (Zaltymbunk)** on the Home of Poi forums.
- Originally meant ANY composite cyclic pattern; the community narrowed "cap" to the
  **C-CAP** (extension + antispin petal alternation, kidney-bean shape).
- Key figures: Damien (coined), **Alien Jon** (promoted), **Nick Woolsey / PlayPoi**
  (popularized as "Capped Antispin Patterns"), **DrexFactor** (documented),
  **Charlie Cushing** (8-step CAP, 9-Square Theory).
- **CAPs and LOOPs are parallel concepts, not parent/child.** Neither is a subset of the
  other. CAPs compose per-hand trajectories (overlay left path + right path); LOOPs
  compose per-beat snapshots (one letter = both hands).

## V1 Shape: a historical/theory page, no interactive build

Page structure (reuses the loops/shape-matrix destination skeleton — own `Seo`, JSON-LD,
`public-editorial.css`):

1. **Hero** — a C-CAP illustrated (static SVG/art of the kidney-bean trajectory). TKA has
   no per-hand trajectory renderer; an honest illustration is correct here, NOT a faked
   pictograph. One-line framing: before TKA formalized LOOPs, the poi world was already
   composing cyclic patterns — and named them first.
2. **The Story** — origin on Home of Poi; the original broad definition; how community
   usage narrowed it to the C-CAP. Timeline treatment.
3. **The People** — credit cards for the five named figures with their specific
   contributions (as listed in ground truth; nothing beyond it without verification).
4. **CAPs vs LOOPs — twin diagrams, one pattern** (decided 2026-07-19). Pick ONE pattern
   that is both a CAP and a TKA-notatable sequence. Show it twice, side by side: left =
   per-hand trajectory art (the CAP lens; animated SVG path-trace of the kidney-bean),
   right = the real pictograph strip (the LOOP lens; real renderer, 8-count). Caption
   thesis: same movement, two ways of seeing — CAPs read the paths, LOOPs read the beats.
   Below the diagrams, a tight comparison table (composes what / unit / geometry /
   community origin) and short prose. Parallel-not-parent/child stated plainly.
   Interactive lens-toggle (crossfade between views) is the phase-3 upgrade, not v1.
5. **CAP-space and TKA today** — honest scope statement: TKA formalizes LOOPs; CAP-space
   is adjacent territory the system does not yet notate. No colonizing claims.
6. **Cross-links** — to `/notation/loops` (its lineage section links back here), the
   `/notation` hub, and the guide.

## P1 Research Findings (2026-07-19 web verification pass)

Claim-by-claim status against public primary sources:

- **Alien Jon promoted** — VERIFIED (DrexFactor C-CAP tutorial credits his teaching
  technique; multiple sources place him in the Burning Man 2007 theory group).
- **Nick Woolsey / PlayPoi "Capped Antispin Patterns"** — VERIFIED (his 2016 tutorial is
  literally titled that; "popularized" is inference from the tutorial's existence, not a
  stated fact — phrase carefully).
- **DrexFactor documented** — VERIFIED extensively (Tech Blogs 2009–2016, C-CAPs tutorial
  2012, 8-Step CAP Recipe 2016).
- **Charlie (Cushing) — 8-step CAP + 9-Square Theory** — VERIFIED for the attribution
  ("The idea comes to us from Charlie's 9-square theory" — DrexFactor); surname "Cushing"
  only in third-party sources (SpinMorePoi series, Instagram), never on a directly-read
  DrexFactor/HoP page.
- **Broad→narrow definition drift** — PARTIALLY SUPPORTED in substance; the specific
  "kidney bean" descriptor was NOT found in primary sources (may be Austen's/community
  verbal shorthand — fine to use, don't attribute it).
- **⚠ OPEN: coiner identity.** MCP KB says "coined by Damien (Zaltymbunk)". Web sources
  say Damien's HoP username is **French_Saltimbanque**, while **Zaltymbunk** appears as a
  (possibly distinct) HoP contributor — "Trochoid Master", Toulouse/Angers — who authored
  "The Math of CAPs" (hosted on DrexFactor) and writes "what's that i have called CAPs"
  (itself a coinage-flavored claim). Possibly two people conflated in the KB; possibly one
  person, two usernames ("Saltimbanque"→"Zaltymbunk" is a plausible respelling). The
  origin thread (homeofpoi.com "What are CAP's?", topic 891193) is behind Cloudflare bot
  protection — needs a human browser visit or Austen's personal knowledge. MUST be
  resolved before the People section ships; if the KB is wrong, fix packages/domain (the
  canonical source) too.

Canonical citation set for the page:
1. The Math of CAPs — drexfactor.com/reference/math_caps (Zaltymbunk's framework)
2. Learning CAPs (Capped Antispin Patterns) — playpoi.com/learn/learning-caps-capped-antispin-patterns/
3. Basic Poi Dancing Tutorial: C-CAPs — DrexFactor (2012)
4. Tutorial: Double Staff 8-Step CAP Recipe — DrexFactor (2016)
5. "What are CAP's?" — Home of Poi forums topic 891193 (origin thread; verify manually)

## Content Integrity Gate (hard requirement)

This page names real people. Before ship:

- Every historical claim verified against MCP + public primary sources (Home of Poi
  threads, DrexFactor's published documentation, PlayPoi materials). Claims that can't be
  verified get cut or flagged to Austen — never shipped on vibes
  (`no-fabrication`, `feedback_no_fabricated_community_lore`).
- Austen reviews the People + Story copy personally before it goes live (ghostwriting
  guard; these are his community peers).
- Voice: fire-jam test. Respectful, specific, zero superlatives.

## IA & Placement

- `/notation` hub teaser card (alongside shape-matrix and loops teasers).
- `NAV` Notation-group entry.
- Sitemap entry.
- NO launchpad bento tile in v1 — front-page bento carries LOOPs + Shape Matrix; CAPs is
  reached through them and the hub. Revisit if the page earns it.

## Non-Goals (v1)

- Interactive per-hand trajectory rendering (phase 2 candidate; new rendering work).
- Any CAP notation system.
- Lineage/ancestry claims in either direction — parallel concepts, stated as such.

## Phases

- **P1** — research pass (verify claims, gather citations) + copy draft → Austen review.
- **P2** — page build (skeleton clone from loops destination) + hub/nav/sitemap wiring.
- **P3 (future, separate decision)** — interactive trajectory visuals.
