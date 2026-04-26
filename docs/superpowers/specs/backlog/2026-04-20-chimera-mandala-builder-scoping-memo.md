---
status: backlog
value: 2
effort: L
remaining: Scoping memo. Needs canonical form first
depends_on: mandala-canonical-form
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Chimera Mandala Builder — Scoping Memo

**Date:** 2026-04-20
**Status:** Scoping memo (pre-brainstorm, pre-dependency)
**Parent effort:** Sticker Lab (Phase 3)

---

## 1. Problem Statement

A real LOOP paints two tip paths on the same canvas: one blue, one red. The Chimera Mandala Builder lets users sever that coupling. They pick any canonical blue path from the full pool of unique mandalas, pick any canonical red path from the same pool, and the middle panel composes the two into a **chimera mandala** that no real LOOP produced. The builder is a user-facing feature inside the Sticker Lab tab. It is not a sequence generator. It produces visual artifacts decoupled from any underlying motion, with an optional back-reference when a chimera happens to coincide with a real LOOP's output.

## 2. Why It Matters

- **Users become mandala designers, not curators.** Phase 1 lets users pick from LOOPs that exist. Phase 2 dedupes those LOOPs into a gallery of unique shapes. Phase 3 lets users author shapes that no sequence produces, using the canonical set as a palette.
- **Happy-coincidence discovery.** Most chimeras will be novel, but some will accidentally match a real LOOP's canonical form. Flagging those matches turns the builder into a discovery tool: "you invented a shape that LOOP XYZ already paints."
- **Teaches the blue/red duality.** Seeing the same canonical set rendered once in blue and once in red makes the hand-color swap symmetry concrete. Users learn the structure of the mandala space by manipulating its two channels independently.

## 3. Dependency Chain

Phase 3 is gated by Phase 2. The dependency order:

1. Phase 1 spec committed (done, 2026-04-20).
2. Phase 2 scoping memo committed (done, 2026-04-20).
3. Phase 2 brainstorm produces full spec.
4. Phase 2 ships (canonical form algorithm + directory).
5. Phase 3 brainstorm.
6. Phase 3 ships.

Phase 3 cannot be brainstormed meaningfully before Phase 2's spec exists. The pool structure, per-mandala metadata, canonical-lookup API, and equivalence group all come out of Phase 2. Brainstorming Phase 3 against an unsettled Phase 2 would produce a plan built on sand. Phase 1 ships standalone; Phase 3 does not.

## 4. The Mechanic

Users pick one canonical shape from the blue pool and one from the red pool. The middle panel renders the composition live.

```
┌────────────────┐  ┌──────────────────────┐  ┌────────────────┐
│  BLUE POOL     │  │  CHIMERA PREVIEW     │  │  RED POOL      │
│                │  │                      │  │                │
│  [shape 001]   │  │  ┌────────────────┐  │  │  [shape 001]   │
│  [shape 002]   │  │  │                │  │  │  [shape 002]   │
│  [shape 003] ◄─┼──┼──┤  blue path +   │  │  │  [shape 003]   │
│  [shape 004]   │  │  │  red path      │◄─┼──┤  [shape 004] ◄ │
│  [shape 005]   │  │  │                │  │  │  [shape 005]   │
│  [shape 006]   │  │  └────────────────┘  │  │  [shape 006]   │
│      ...       │  │                      │  │      ...       │
│                │  │  [match: LOOP XYZ]?  │  │                │
│                │  │  [add to sheet]      │  │                │
└────────────────┘  └──────────────────────┘  └────────────────┘
```

Both pools draw from the same Phase 2 canonical set. The left column renders each shape as blue-only (the blue-hand path of that canonical mandala in isolation). The right column renders the same set as red-only. The middle panel overlays the two picks. Resulting chimera becomes a `StickerUnit` with `sourceLoop: null`.

## 5. What's Already Wired in Phase 1

The Phase 1 data model was designed so Phase 3 stickers drop in with no migration:

- **`sourceLoop: null` is allowed on `StickerUnit`.** The loop reference is optional by spec. Chimera stickers carry no loop.
- **`size`, `presentation`, `background` are versioned and extensible.** Adding a chimera-specific presentation hint or provenance block does not break existing stickers.
- **`StickerUnit` does not require a sequence reference of any kind.** The core unit is a renderable shape plus layout metadata. A chimera is a shape; it fits.
- **Sheet composition treats all stickers uniformly.** A chimera on a sheet pages the same as a LOOP-sourced sticker.

No schema changes to ship Phase 3. Only additions.

## 6. Open Questions the Phase 3 Brainstorm Must Answer

1. **Does each canonical mandala carry metadata about which LOOPs produce it?** If yes, a chimera that coincidentally matches a real canonical form can surface "this chimera equals LOOP XYZ" on the preview panel. If no, coincidence detection is a separate lookup.
2. **Is the left pool identical to the right pool under hand-color-swap equivalence, or are they structurally different pools?** Phase 2 will settle whether blue/red swap is part of the equivalence group. If yes, left and right pools are literally the same set. If no, they are sibling pools.
3. **Can users save chimera designs independently of placing them on a sheet?** Is there a chimera gallery that persists across sessions, with its own naming, tagging, sharing?
4. **How does the builder render the middle panel in real-time as users browse?** With 1000+ shapes per pool and live composition on hover, the render path has to be cheap. Prerendered tiles plus a cheap overlay? Cached canonical SVGs? GPU compositing?
5. **What happens when the chimera result IS a real LOOP's canonical form?** Flag it and show the match, stay silent, or offer both modes (discovery mode on/off)?
6. **Can users mutate an existing chimera?** Swap only the left path while keeping the right? Swap only the right? Is mutation a first-class operation with undo, or does every change start a new chimera?
7. **Does the chimera builder support chaining?** Take this chimera's blue path and another chimera's red path. Is the blue pool augmentable with "blue paths from chimeras you've designed," or locked to canonical-only?
8. **How do chimera stickers appear in the sheet UI?** Labeled as "Chimera" with no word, given a user-chosen nickname, given a deterministic auto-name from the (blue, red) pair, or some combination?
9. **Can two users independently rediscover the same chimera?** If the id is a deterministic hash of `(blue_canonical_id, red_canonical_id)`, then yes. Is that the identity model, or do chimeras get per-user ids?
10. **Is there a sequence-recovery mode?** "Given this chimera, find me the LOOP that produces it" — or is that purely Phase 2's directory job, reached via the coincidence-match flag?

## 7. Research References / Algorithmic Neighbors

Once Phase 2 ships a canonical form, Phase 3 is mostly a UX problem, not an algorithmic one. Composing two prerendered paths into a preview is cheap. The coincidence-detection step (§6 question 1) reduces to computing the canonical form of the composed chimera and looking it up in Phase 2's canonical index — a single hash lookup per user pick pair.

The meaningful design work sits in browse ergonomics (how do you scan 1000+ shapes in each pool without fatigue), state model (does mutation feel like editing or like a fresh pick), and naming (does each chimera feel authored or feel serialized).

## 8. Next Step

Run `superpowers:brainstorming` on this memo **after Phase 2's full spec is committed**. Phase 3 cannot be meaningfully brainstormed earlier because its pool structure, per-mandala metadata, and coincidence-detection API all depend on Phase 2's canonical-form output format. Revisiting this memo before that gate is premature.
