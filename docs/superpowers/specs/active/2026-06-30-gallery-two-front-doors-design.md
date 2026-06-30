---
status: active
date: 2026-06-30
---

# Gallery — Taxonomy-First Onboarding (TnD Base → LOOP) + Browse All

## The Problem

The gallery drops the raw searchable database on a newcomer at the front door:
452 notation-dense pictograph cards plus a ten-control filter toolbar
(Community/My-Library, Props/Hands, Left/Right, sort, Level, Favorites, Length,
LOOP, search). That is a **power-user tool** — it answers "find a specific
sequence in a set I already understand." A newcomer is not asking that. They are
asking "what is this, what's possible, where do I start," and they cannot even
read one card (arrows + Greek letters + QR). Result: massive overwhelm and bounce.

Every prior iteration (rearranging chips, a disclosure, an on-ramp band) tuned
the filter bar — i.e. polished the power-user tool. That is the wrong artifact.
The fix is not fewer chips; it is **changing what a newcomer sees first.**

Austen (2026-06-30): *"Are we doing this the right way altogether by showing
everything right off the bat... a newcomer looking at this is going to feel a
sense of massive overwhelm."* And then the key insight: *"our starter sequences
are the TnD (timing and direction) sequences... all those algorithms that we
created to separate all those different decks could easily be used to look
through the gallery... introduce them to the base sequences using the base
timing and direction cards... maybe that is the very first decision they should
make."*

## The Decision

**Two front doors**, and the newcomer door is **taxonomy-first onboarding**, not
content discovery.

| Surface | Audience | Job |
|---|---|---|
| **Start here** (Gallery default) | Newcomer / first contact | *Teach the system.* Enter through TKA's own structure: base movements (TnD) → how they LOOP. |
| **Browse all** (opt-in destination) | Returning / power user | *Find a specific sequence.* The full community grid + filters. |

Nobody opens on the database (Netflix, Spotify, App Store lead editorial, search
second). TKA goes further: its editorial *is* its curriculum. The deck-separation
engine we already built becomes the way a newcomer navigates.

## Why taxonomy-first (grounded)

MCP-confirmed (`get_domain_topic`, `list_vtg_categories`):

- A LOOP is **a transformation applied to a base seed** — *"Performed Sequence =
  LOOP Skeleton + Turn Assignment."* Components: Rotated / Mirrored / Flipped /
  Swapped / Inverted / Rewound. **Base TnD sequences are the foundation; LOOPs are
  built on top.** So pedagogically, base-first is the correct curriculum order.
- The TnD/VTG space is exactly **six families** — timing (split / together /
  quarter) × direction (same / opposite). Six is a teachable number; 452 is not.

Codebase-confirmed (canonical sources):

- `tnd-element.ts` already maps each family to an **element + accent color +
  icon**: Split-Same→water, Tog-Same→earth, Quarter-Same→sun, Split-Opp→fire,
  Tog-Opp→air, Quarter-Opp→moon. A newcomer picking among six colored elemental
  tiles is the opposite of overwhelm — and it's uniquely TKA, not a generic
  "popular/new" row every app has.
- The classification + deck engines exist: `LOOPDetector` classifies any
  sequence's LOOP type; `resolve-tnd-family-cards.ts` resolves a family to its
  cards; `gallery-deck-source.ts` / `deck-composer.ts` produce canonical deck
  content. Reuse, not invention (`never-hand-roll`).

## Surface 1 — "Start here" (taxonomy entry)

### The first decision: Base vs LOOP (base-first)

Two large, **described, illustrated** entry choices — not bare jargon:

- **Base movements** *(TnD)* — "the foundation: timing and direction." Shown as
  the six elemental families. **Recommended / default path.**
- **LOOPs** — "how the base movements repeat and transform" (rotated, mirrored,
  swapped…). The next level.

User-facing copy avoids raw vocabulary ("Base / Foundations", elements shown);
the internal taxonomy keeps its real names. Base is signposted as the start — you
can't loop what you haven't learned.

### Inside Base → the six elements

Six calm tiles, each its element's accent color + icon (`tnd-element.ts`). Pick
one → that family's cards, drawn from the **canonical enumerated decks**
(`gallery-deck-source` / `deck-composer`), not messy community uploads — clean,
complete, already elementally themed. Within a family, ratio/turns give a natural
difficulty ramp (`TND_RATIO_LEVEL_MAP`: 1:1 → L1, 3:1/5:1/7:1 → L2, even → L3).

### Inside LOOP → the transformation types

The LOOP types (rotated, mirrored, flipped, swapped, inverted; period
halved/quartered), each with a legible example. Classified by `LOOPDetector`;
the community gallery already carries `loopType`, so this lens works on real
data immediately.

### Engagement signals demote to secondary

Easy / popular / fresh (`level`+`length`, `starCount`, `publishedAt`) are no
longer the primary organizer — they become optional *refinements within* a chosen
family or LOOP type ("simplest in Water first"). Structure leads; popularity sorts.

### Reuse (never-hand-roll)

| Need | Reuse | Path |
|---|---|---|
| Element theming (color/icon/family) | `TND_ELEMENTS` / `getTnDElement` | `src/lib/features/choreo-card/domain/tnd-element.ts` |
| Family → cards | `resolve-tnd-family-cards` | `src/lib/features/lab/vtg-lab/services/resolve-tnd-family-cards.ts` |
| Canonical deck content | `gallery-deck-source`, `deck-composer` | `src/lib/features/choreo-card/services/` |
| LOOP classification | `LOOPDetector` | `src/lib/shared/create/services/loop-detector.ts` |
| Sequence card | `ChoreoCardThumbnail` (real card — no fake name/level/favorites) | `src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte` |
| Horizontal row | `HorizontalSwipeContainer` | `src/lib/shared/foundation/ui/HorizontalSwipeContainer.svelte` |

## Surface 2 — "Browse all"

The **real `BrowsePanel`** we already mount in the harness
(`/test/gallery-redesign`) — `BrowseToolbar` + `BrowseFilterBar` + `BrowseSidebar`
+ `BrowseGrid` of real `ChoreoCardThumbnail`s — the community corpus, kept for
power users **with one cut:**

- **Remove the Props/Hands + Left/Right switcher** (`ViewModeToggle`, the
  compositional-browsing feature). Advanced, meaningless to a newcomer, over-added.
  Austen (2026-06-30): *"probably doesn't need to be there at this point."* Cut
  from the surface; the underlying `viewMode` engine capability stays dormant.

## Navigation

- **Gallery** = top-level entry → opens **"Start here"** (the taxonomy entry). No
  Browse→Gallery nesting.
- **Browse all** = reached from Start here and directly routable. Holds Surface 2.
- **My Library** = its own top-level destination; the in-gallery
  Community/My-Library source toggle is no longer the way in.

Wiring in `module-definitions.ts` / `tab-definitions.ts` /
`guest-access-config.ts`. The 30 auth/admin modules untouched.

## Legibility (later phase)

A static notation card is unreadable to a non-fluent viewer; motion reads where
notation doesn't. Wiring the existing animation engine (`AnimatorCanvas` /
`AnimationCanvas`) into a lightweight **playable card** for the hero/featured
examples is the legibility unlock — scoped behind a perf spike (N live canvases
on mobile WebGL), hero-only as the safe floor. Not assumed.

## Phasing

- **Phase 1 — Taxonomy entry + two surfaces.** Build "Start here": Base-vs-LOOP
  first decision → six elemental family tiles → family cards from canonical decks;
  LOOP types via `LOOPDetector`/`loopType`. Wire "Browse all" to the real
  `BrowsePanel`. Cut Props/Hands. This replaces "452 dumped" with a six-element
  curriculum — the structural + pedagogical win.
- **Phase 2 — Taxonomy over the community corpus.** Backfill a `tndFamily`
  classification onto `publicSequences` (run the classifier; `loopType` is already
  present) so Browse all can also filter by element/family, and Start-here can
  optionally surface community examples per family.
- **Phase 3 — Animated legibility.** Spike, then wire the animation engine into a
  playable card.

## Out of Scope

- Editorial/hand-picked curation (Collections-driven) — algorithmic/structural v1.
- Redesigning `ChoreoCardThumbnail`'s internal layout.
- The 30 auth/admin modules and the Create module internals.
- Search ranking inside Browse all.

## Open Questions / Risks

1. **TnD family not denormalized on community data** — only `loopType` is on
   `publicSequences`. Phase 1 sidesteps by drawing Start-here from canonical decks;
   Phase 2 backfills `tndFamily`. Classifier exists, so it's work, not research.
2. **Taxonomy doesn't partition all 452 uploads** — many user sequences are
   freeform/neither. Base-vs-LOOP is a teaching *entry*, not a total filter;
   "Browse all" stays the escape hatch.
3. **Base-vs-LOOP must be taught, not bare jargon** — entry choices are described +
   elementally illustrated; "TnD"/"LOOP" raw terms stay out of first-contact copy.
4. **Animated-card perf** — resolved by the Phase 3 spike; hero-only floor.

## Harness

`/test/gallery-redesign` mounts the real `BrowsePanel` (Surface 2, truthful
baseline). Phase 1 builds "Start here" alongside it in the same harness using the
real element/deck/classification engines — no fakes.
