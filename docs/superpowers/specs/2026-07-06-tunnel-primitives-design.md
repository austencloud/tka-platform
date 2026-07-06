# Tunnel Primitives — a closed vocabulary for the mandala-study rig

Status: approved (2026-07-06). Supersedes the named-look catalog (`tunnel-looks.ts`
/ ADR `tunnel-looks.md`, 2026-07-06 morning).

## Problem

The tunnel art view shipped a catalog of 7 named looks (Radial, Mirror, Flip,
Counter, Echo, Cross, Mandala) plus two Radial-only sub-knobs (Density, Mirror).
Two faults:

1. **Redundant + confusing.** `Radial + mirror + 4 arms` is byte-for-byte the
   Mandala tile; Cross is `Fold 2 + reflect`. The same kaleidoscope is reachable
   two ways, and Mirror is a hidden sub-toggle bolted onto one look — exactly the
   "reflection applied on top of rotation" model that caused the original prop
   explosion.
2. **Wrong abstraction for the goal.** The tunnel is a *study rig*: run any
   sequence through the gamut, see its mandala every representative way. A curated
   named-look list is a ceiling on that, not a floor.

Austen (2026-07-06): *"reduce all of the variables and parameters down to their
most reasonably sized minimum primitive so that you can construct them through the
combination of multiple without much domain knowledge."* Then, on scope: Counter
and Echo are peers (not sub-toggles), Flip stays, and two primitives were never
modeled — **Stagger** and **Speed**.

## Decision

Replace the look catalog with a **closed primitive vocabulary**. A tunnel is the
always-drawn base plus a set of overlaid copies *generated* from an orthogonal
`TunnelConfig`. No named looks; every mandala is a point in the config space.

```ts
interface TunnelConfig {
  fold: 1 | 2 | 4 | 8;   // rotational arms (cyclic order)
  mirror: boolean;       // reflect across vertical axis
  flip: boolean;         // reflect across horizontal axis (N↔S)
  counter: boolean;      // alternate arms motion-invert (PRO↔ANTI)
  echo: boolean;         // alternate arms time-reverse
  staggerSteps: number;  // arm k shows the sequence offset by k×this (0 = off)
  speed: boolean;        // alternate arms traverse at ½× / 2× (canon)
}
```

### Two kinds of primitive

**Symmetry generators** — grow the copy *set* by group closure (spatial, baked
once at build via `sequence-transforms.ts`):

| Primitive | Control | Effect |
|---|---|---|
| Fold | 1 / 2 / 4 / 8 | rotational arms at 360/N° |
| Mirror | on/off | ∪ vertical reflection of the set |
| Flip | on/off | ∪ horizontal reflection of the set |

Image count = `fold × (mirror?2:1) × (flip?2:1)`. Grid = 8 points (45° steps), so
2/4/8-fold are the representable rotations (3/6-fold are not).

**Per-copy modulators** — do NOT add copies; they make arms *differ from each
other* (a uniform modulator is a no-op — invert the whole ring and it's the same
ring). Applied at the playhead, in the step domain (never the grid-angle domain
that snapped everything last time):

| Primitive | Distribution | Effect |
|---|---|---|
| Counter | alternate arms (odd ordinal) | append `invert` op |
| Echo | alternate arms (odd ordinal) | append `rewind` op |
| Stagger | accumulate: arm k → +k×S steps | canon / spiral |
| Speed | alternate arms cycle 1 → 2 → ½ | overlaid tempos |

Counter/Echo are *baked* modulators (they append a `CopyOp`); Stagger/Speed are
*sample-time* modulators (they set a per-copy `{ staggerSteps, speed }` the
sampler uses to shift the playhead: `beat' = beat × speed + offset`, wrapped).

### Copy descriptor

```ts
interface TunnelCopy { ops: CopyOp[]; staggerSteps: number; speed: number; }
```

`generateCopies(cfg)` returns the extras (base excluded). `buildTunnelLayers(base,
cfg)` bakes each `ops` chain into a `SequenceData` and carries `staggerSteps` +
`speed` through → `{ seq, staggerSteps, speed }[]`. The sampler
(`sampleTunnelProps`) gains `(offset, speed)` params.

## Prop-count budget

Modulators are free (no new copies); only Fold/Mirror/Flip grow the count.

- **Live dock:** hard ceiling `MAX_IMAGES = 16` (32 props). Enabling a
  generator that would exceed it clamps Fold down; the live prop-count readout
  makes the clamp visible (no silent lie). Reduced motion drops the ceiling to
  `MAX_IMAGES_RM = 4` (8 props). `heavyLoad` warns at ≥16 props.
- **Playground (`/test/tunnel-looks`):** NO cap — this is where the full gamut
  (incl. 64-prop monsters) is studied. Separation is deliberate.

## UI (ArtSettingsPanel tunnel section)

Named-look grid → primitive controls, all top-level peers:

- **Fold** — `SegmentedControl` `[1 · 2 · 4 · 8]` (single-select, exactly-one).
- **Mirror / Flip / Counter / Echo / Speed** — a row of `FilterChipBase`
  `mode="toggle"` chips (independent booleans, per `chip-primitives.md`).
- **Stagger** — a compact − N + stepper (0 … L-1, wraps).
- **Grid** — the existing compact icon toggle.
- Live prop-count readout + `heavyLoad` warning.

No checkboxes; 44px touch floor; reuse `SegmentedControl` + `FilterChipBase`.

## Playground

`/test/tunnel-looks` becomes a **primitive sweep**: the same sequence rendered
across a matrix of configs (fold × reflect, plus modulator rows) so the modulator
distribution (alternating vs complementary, stagger accumulation, speed cycle) is
tuned by eye. Real components, per `visualization-routing.md`.

## Migration

`tunnel-view-state.ts` maps persisted `{ lookId, density, radialMirror }` →
`TunnelConfig`:

| old | → config |
|---|---|
| radial + density d | `fold: d` |
| mandala | `fold: 4, mirror: true` |
| mirror | `fold: 1, mirror: true` |
| flip | `fold: 1, flip: true` |
| counter | `fold: 1, counter: true` |
| echo | `fold: 1, echo: true` |
| cross | `fold: 2, mirror: true` |
| pre-looks `fold`/`mirror` | `fold: n, mirror: bool` |

## Files

- `tunnel-config.ts` (NEW, replaces `tunnel-looks.ts`) — `TunnelConfig`, `CopyOp`,
  `generateCopies`, `propCount`/`imageCount`, `clampConfig`, RM budgets.
- `tunnel-layer-builder.ts` — `buildTunnelLayers(base, cfg)` → `BuiltCopy[]`.
- `tunnel-prop-sampling.ts` — `sampleTunnelProps(seq, step, ease?, offset?, speed?)`.
- `tunnel-view-controller.svelte.ts` — config state, setters, clamp, `configKey`.
- `tunnel-view-state.ts` — persist config + legacy migration.
- `ArtSettingsPanel.svelte` — primitive controls.
- `ArtPane.svelte` — export suffix from `configKey`.
- `PropUnlockCelebration.svelte` — port to config API.
- `routes/test/tunnel-looks/` — primitive sweep gallery.
- `tunnel-config.test.ts` (renamed) — copy counts, closure, modulator distribution.
- ADR `docs/architecture/tunnel-looks.md` — rewritten.

## Rejected

- **Keeping named looks as presets.** Austen wants *away* from the named
  vocabulary; presets re-introduce the domain-knowledge tax. The playground covers
  discoverability.
- **Modulators that add copies.** Would explode the count and double-count the
  symmetry. They transform existing arms instead.

## Related

`never-hand-roll.md`, `chip-primitives.md`, `no-checkboxes.md`,
`visualization-routing.md`, `effects-earn-their-slot.md`, `no-layout-shift.md`.
