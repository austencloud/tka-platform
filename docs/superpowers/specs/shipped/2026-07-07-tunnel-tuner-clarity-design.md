# Tunnel Tuner Clarity — Design

**Date:** 2026-07-07
**Status:** Shipped 2026-07-07 (design validated live via `/test/tunnel-tuner`)
**Area:** `src/lib/shared/sequence-viewer/tunnel/*`, `ArtSettingsPanel.svelte`

> **Refinements from the interactive prototype** (all folded into the sections
> below): the fold control is **"Copies ×N"** (a ×multiplier), NOT "Performers" —
> a slider labeled "Performers: 1" contradicted a "2 performers" readout the
> instant Mirror was on. Reframed so ONE base performer ("you", haloed in the
> ring) is multiplied by every count-builder. Each performer draws as a **little
> staff** (bar + blue/red ends), so you count staves = performers, ends = props
> (the loose dot-pairs read as ambiguous "stamps"). The count is a **big plain
> result** with the multiplication demoted to a faint sub-line.

## Problem

The tunnel Customize tuner exposes seven orthogonal primitives (fold, mirror,
flip, invert, echo, stagger, speed). It is powerful but not legible. A user sets
"2 performers" (Fold 2 → 4 props), toggles **Mirror**, and the prop count jumps
to 8 with no explanation. Austen, verbatim:

> "why suddenly there are 8 props when I only set 2 performers which should lead
> to 4 props — it just doesn't really follow or get explained in a way that makes
> sense."

His arithmetic is correct. `propCount = fold × (mirror?2:1) × (flip?2:1) × 2`
(`tunnel-config.ts:107,111`). Fold 2 = 4 props; Mirror doubles to 8.

### Root causes (not "can't see the result")

The live tunnel render sits **beside** the tuner in the same pane
(`ViewerSplitPane.svelte:669-686`, `ArtPane` renders `TunnelArtView` + settings
sidebar; `layout="sidebar"` desktop / `"bottom"` mobile). Toggling Mirror
already reshapes a visible mandala and updates a `{propCount} props` readout. So
visibility is not the gap. Two other things are:

1. **No predictability, weak cause→effect.** All five boolean toggles
   (Mirror/Flip/Invert/Echo/Speed) render as identical `FilterChipBase` chips.
   Nothing signals — before tapping — that Mirror/Flip **double** the count while
   Invert/Echo/Speed add zero props. After tapping, nothing links "4 → 8" to
   "Mirror reflects the whole set." The generator-vs-modulator split is real and
   documented **in a code comment** (`ArtSettingsPanel.svelte:141`) but never
   reaches the screen.
2. **Vocabulary mismatch.** The rotational control is labeled **"Fold."** The
   user's intuition is **"performers."** The word on screen never meets the
   mental model.

## North Star

**Dead simple to understand without sacrificing customizability.** Every one of
the seven primitives stays reachable. The tuner becomes legible by *showing*, not
by hiding depth.

### The mental model the UI teaches

- **Start from one base performer ("you")** — a single dancer, drawn as a staff.
  Everything else *multiplies* that one. A performer has **two hands** (blue +
  red), so one performer = two props.
- **Two kinds of control:**

  | Family | Controls | Effect on count |
  |---|---|---|
  | **Count-builders** | **Copies ×N** (fold), Mirror, Flip | Multiply the cast. Copies is ×1/×2/×4/×8; Mirror/Flip each add a reflected twin of every performer → **×2**. |
  | **Motion** (variation) | Invert, Echo, Stagger, Speed | Change *how* performers move. **Never** change the count. |

- **The count is always** `performers × 2 hands = props`, and `performers` is the
  product of the active ×multipliers off the base 1 (`1 × copies × mirror × flip`).
  The fold control shows **×N** (not a bare count) precisely so its value never
  reads as the total — `×1` selected + `Mirror ×2` obviously = 2 performers.

This maps `imageCount` → "performers" and `propCount` → "props" with no math
change: `performerCount === imageCount`, `propCount === performerCount × 2`.

## Design

### 1. Centerpiece — the Performer Ring (new schematic component)

A small inline-SVG diagram, hero-positioned at the **top of the Customize
panel**, above the controls. It renders the **current** cast as countable
blue+red hand-dot pairs arranged around a ring — the schematic, countable
counterpart to the dense live mandala beside the panel (which, at Fold 8, cannot
be counted by eye).

**Geometry (schematic, count-faithful — not a pixel map of prop positions):**

- Each performer draws as a **little staff**: a short bar with a blue end and a
  red end (hand colors `#2E86DE` / `#E74C3C` from `StartPositionMiniGrid.svelte`),
  laid tangent to the ring. Count staves = performers; count ends = props. The
  base performer ("you", id `f0`) wears an accent halo — the seed everything
  multiplies from.
- Base ring: `fold` performers spaced evenly around the circle at the shared
  compass angles (`n/ne/e/se/s/sw/w/nw`). Fold divides 8 evenly (1/2/4/8).
- Each active reflection **spawns a twin** of every existing performer, seated on
  a tighter concentric ring (`depthRadiusFraction` shrinks with reflection depth)
  so twins stay countable **even when a mirror-twin's location coincides with a
  fold position** — it is a distinct reflected copy (why Fold 4 + Mirror = 8
  copies at 4 locations). The diagram always shows `performerCount`
  (= `imageCount`) countable staves.

**Animation ("watch it multiply"):**

- Changing a **Performers** control springs the added/removed twins in/out and
  ticks the count line. Tapping a **Motion** control visibly adds **no** dots —
  the count holds. That non-change is the teaching moment: the user *sees* Invert
  is free and Mirror is not.
- Reduced motion: springs collapse to instant. The diagram owns this; consumers
  never re-implement it (per `no-layout-shift.md` + reduced-motion convention).

**Component API** (`PerformerRing.svelte`, new, under
`src/lib/shared/sequence-viewer/tunnel/`):

```ts
interface Props {
  config: TunnelConfig;   // reads fold/mirror/flip for the count + twin structure
  size?: number;          // px; default hero ~96, presets ~28
  animate?: boolean;      // default true; false for static preset thumbnails
}
```

It derives everything from `config` via `imageCount`/the copy structure — no new
count math. Grep found no existing tunnel count/copy-ring
(`PositionGlyph`, `StartPositionMiniGrid`, `StaffGridPoint`, the mandala
renderers are all adjacent but none count copies), so this is new — but it is a
direct sibling of `StartPositionMiniGrid.svelte` and reuses the shared grid
`ANGLES`/compass geometry rather than inventing placement.

### 2. Count readout

Under the ring, a **big plain result** replaces the bare `{propCount} props`:

```
4 performers · 8 props
```

Below it, a **faint sub-line** shows the build-up for anyone who wants the
mechanism (only active >×1 factors appear; nothing when it's just you):

```
1 × 2 copies × 2 mirror
```

- `font-variant-numeric: tabular-nums` on every number.
- The headline is the low-load result; the multiplication is demoted so it
  informs without forcing arithmetic. The ring is the primary explanation.
- When no multiplier is active the sub-line reads `just you` and the result is
  `1 performer · 2 props`.

### 3. Controls, regrouped (all still reachable)

The tuner body (`ArtSettingsPanel.svelte`, `{:else}` tuner branch) restructures
into the hero + three labeled zones. Same primitives, grouped:

- **Copies** — the existing `SegmentedControl` (today's Fold control), values
  shown as **×1 / ×2 / ×4 / ×8** (a multiplier, not a count). Keeps the compact
  Grid toggle.
- **Add twins — each doubles** — group header over Mirror + Flip. Each stays a
  `FilterChipBase mode="toggle"` with a `×2` in its label + its reflect glyph
  (Mirror `fas fa-arrows-left-right`, Flip `fas fa-arrows-up-down`).
- **Motion — same count** — group header over Invert, Echo, Speed (chips) + the
  Stagger stepper (moved under this header from its former standalone row).

No control is removed or hidden. Customizability is preserved; the change is the
hero + grouping + relabels.

### 4. Presets view (companion win)

Each preset card (Duo/Radial/Mandala/Pinwheel/Spiral/Inverted/Cross,
`TUNNEL_PRESETS`) and each saved user preset swaps its generic FontAwesome glyph
for a small static `PerformerRing` (`animate={false}`, `size≈30`), so the cast
shape + density previews *before* selection. No numeric count on the card — the
ring encodes it and a "N props" string would crowd the 96px card row.

## Reuse Ledger (never-hand-roll)

| Need | Decision |
|---|---|
| Countable performer ring | **New** `PerformerRing.svelte`; adapts `StartPositionMiniGrid.svelte` pattern + shared grid `ANGLES`. Grep: no existing copy-count ring. |
| Count math | **Reuse** `imageCount`/`propCount` (`tunnel-config.ts`). Add trivial `performerCount` getter (= `imageCount`) on the controller. |
| Rotational selector | **Reuse** `SegmentedControl` (already the Fold control). |
| Boolean toggles | **Reuse** `FilterChipBase mode="toggle"` (already used). `×2` affix = small extension, not a fork (per `chip-primitives.md`). |
| Stagger control | **Reuse** existing stepper, relocated under the Motion header. |
| Hand-dot colors | **Reuse** blue `#2E86DE` / red `#E74C3C` from `StartPositionMiniGrid`. |

## Non-Goals

- **No change** to the render pipeline, the `TunnelConfig` model, baking, or
  sampling. Pure tuner-UI + one schematic component + copy.
- **No change** to video export.
- The **Cast** tab (per-performer prop costumes, `AppearanceSection.svelte`) is a
  separate concern — untouched. "Performers" here is the *count*; Cast is their
  *costumes*. Both use the word "performer"; the ring's count is the bridge, and
  the two live in different rail tabs, so there is no collision on screen.

## Testing

- **Unit** (`PerformerRing` count/structure): for representative configs
  (fold 2; fold 2 + mirror; fold 4 + mirror + flip; fold 8), assert the diagram
  emits `imageCount(config)` dot-pairs and that toggling a Motion primitive
  leaves the pair count unchanged. Pure function over `config` → keep the
  count/twin derivation in a testable helper (`performer-ring-model.ts`) the
  component renders.
- **Unit** (controller): `performerCount === imageCount(config)` and
  `propCount === performerCount × 2` across configs.
- **Component** (optional, per `component-test-discipline.md` — only if a bug is
  found while wiring): a vitest-browser check that tapping Mirror updates the
  count line and tapping Invert does not.
- **Verification**: live tuner at
  [localhost:5173](https://localhost:5173) → open a sequence → Art → Tunnel →
  Customize; toggle Mirror (count 4→8, ring twins spring in) vs Invert (count
  holds). Screenshot/eyeball is the user's confirm.

## Files

- **New:** `src/lib/shared/sequence-viewer/tunnel/PerformerRing.svelte`
- **New:** `src/lib/shared/sequence-viewer/tunnel/performer-ring-model.ts` (+ test)
- **Modify:** `src/lib/shared/sequence-viewer/components/ArtSettingsPanel.svelte`
  (tuner restructure, ring mount, count line, preset-card ring, "Fold"→"Performers")
- **Modify:** `src/lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte.ts`
  (add `performerCount` getter)
- **Test:** `src/lib/shared/sequence-viewer/tunnel/performer-ring-model.test.ts`

## Open Questions

None blocking. The `×2` affix visual weight and the exact spring timing are
implementation-tuning details, resolved live against the real tuner (per
`visualization-routing.md`: iterate on the real component, not a mockup).
