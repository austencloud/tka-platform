# Tunnel Speed — Per-Performer Control (design)

**Status:** Shipped 2026-07-08.

## Problem

The tunnel "Speed" control was a `boolean` modulator. On = alternate copies
cycled through a hardcoded `SPEED_CYCLE = [1, 2, 0.5]`; off = every copy at 1×.
"Speed" reads like a dial but shipped as a fixed hidden preset switch — and its
sibling modulator Stagger was already a numeric stepper, so the affordances were
inconsistent. Austen: *"if we allow modifying speed we should specify HOW it's
modified but it acts like a boolean."*

Key reframing from the brainstorm: speed modulation is inherently
**per-performer** — with Mirror/Flip/fold spawning up to 16 copies, "which copy
runs fast" is the real question. A single global dial is the wrong shape. Speed
wants its own destination with presets + deep customization, like the effects
rail.

## Decision (Approach B)

Speed becomes its own **rail destination** in the Art settings tunnel rail
(`Tunnel / Speed / Effects / Effort / Playback`), with two surfaces:

- **Primary — a preset** (`SegmentedControl`): Off / Alternating / Accelerando.
- **Secondary — a per-performer drawer**: one row per rendered copy (from the
  existing `performer-ring-model` cast), each a `[¼× ½× 1× 2× 4×]`
  `SegmentedControl`. "You" (the base) is the fixed 1× reference row.

Named **"Speed"** (Austen's word). Playback › Tempo already owns BPM and Effort
owns per-beat dynamics, so the model uses `speed*` naming to stay distinct in
code while the label reads "Speed".

## Model (`tunnel-config.ts`)

`TunnelConfig.speed: boolean` → two fields:

```ts
speedPattern: "off" | "alternating" | "accelerando";
speedOverrides: Record<number, number>; // arm 1..n → multiplier, wins over pattern
```

- `patternSpeed(pattern, arm, count)` — `off`→1; `alternating`→`[1,2,0.5][arm%3]`
  (**exact legacy behavior preserved**); `accelerando`→monotonic sweep over
  `[0.5,1,2]` across the copies.
- `effectiveSpeed(cfg, arm, count) = overrides[arm] ?? patternSpeed(...)`.
- `copyModulators` feeds `effectiveSpeed` into the existing `.speed` output field
  — **the render path is unchanged** (`additionalLayersAt` already read
  `copyModulators().speed`).
- Base ("you", arm 0) is fixed 1× in v1: the always-drawn reference anchor, and
  the render path only covers copies. Variable base tempo = deferred.
- Overrides key by arm **slot**, not geometric identity — toggling fold/mirror/
  flip re-slots them; selecting a preset clears them (clean slate).
- `configsEqual` + `configKey` extended (`alternating` keeps the legacy `"x"`
  glyph so pre-existing keys/filenames stay stable; `accelerando`→`"xz"`;
  overrides→`t{arm}-{ladderIndex}`).

## Persistence + migration

`coerceSpeedPattern(v, legacySpeed)` and `coerceSpeedOverrides(v)` live in
`tunnel-config.ts` and are reused by both persisters:

- `tunnel-view-state.ts` (localStorage view state) and
  `tunnel-user-presets.svelte.ts` (saved presets) migrate legacy `speed: true` →
  `speedPattern: "alternating"`; absent/false → `"off"`.
- The view-state `section` union gains `"speed"` (+ load guard).

## Controller (`tunnel-view-controller.svelte.ts`)

`speed`/`setSpeed` → `speedPattern` + `speedOverrides` state with
`setSpeedPattern` (clears overrides), `setPerformerSpeed(arm, rate)` (immutable),
`resetSpeed`, and a `speedPerformers` `$derived` (performer rows for the drawer,
index 0 = locked "You"). The spatial rebuild effect excludes speed (sample-time
only, like Stagger) so tweaking it never re-bakes.

## UI (`ArtSettingsPanel.svelte`)

Speed chip removed from the Motion row (leaves Invert / Echo). New `"speed"` rail
entry (`fa-gauge-high`) + section body (preset segmented + collapsible
per-performer drawer, shown only with 2+ performers). Reuses `SegmentedControl` +
`controller.speedPerformers`; no new primitives; `tabular-nums` + reserved widths
keep the layout stable.

## Deferred

Variable base ("you") tempo · more presets (Random/Canon) · per-performer speed
in the video export (export path stays pattern-driven until wired, matching the
existing tunnel-export deferral).

## Downstream idea unlocked

Per-performer speed is the data a **tunnel → choreo reconstruction sheet** needs
(see memory `project_tunnel_choreo_reconstruction`): each copy's transform +
speed = one performer's physical part.

## Tests

`tunnel-config.test.ts` — pattern rates, accelerando sweep, override-wins,
`configsEqual`/`configKey` for pattern+overrides, migration/coercion.
`performer-ring-model.test.ts` — speed pattern/overrides still leave the cast
identical. Full `npm run check` = 0/0; tunnel unit tests 36/36; rig routes 200.
