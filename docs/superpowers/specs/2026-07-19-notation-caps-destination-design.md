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
4. **CAPs vs LOOPs** — the conceptual comparison, side by side: per-hand trajectory
   composition vs per-beat snapshot composition; what each lens captures that the other
   cannot; parallel-not-parent/child stated plainly.
5. **CAP-space and TKA today** — honest scope statement: TKA formalizes LOOPs; CAP-space
   is adjacent territory the system does not yet notate. No colonizing claims.
6. **Cross-links** — to `/notation/loops` (its lineage section links back here), the
   `/notation` hub, and the guide.

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
