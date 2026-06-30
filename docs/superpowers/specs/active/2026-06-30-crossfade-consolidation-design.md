# Crossfade Consolidation — Design

**Date:** 2026-06-30
**Status:** Active — implemented same day
**Topic:** Consolidate every true crossfade onto the shared `Crossfade` primitive,
extend the primitive to cover all sizings, and make the boundary explicit so no
future agent re-derives a crossfade.

Follows the v1 spec (`2026-06-30-crossfade-primitive-design.md`), which shipped
the primitive. This spec covers the deliberate consolidation pass Austen
requested, overriding v1's "opportunistic, not big-bang" migration guidance.

## Goal

Zero hand-rolled *content* crossfades. One discoverable primitive. A codebase
that signals to every future agent: if you're crossfading content, use
`Crossfade`. Heavy/stateful content and single fades are explicitly out, and the
code says why.

## Findings that shaped the design

A 4-agent classification of ~59 `transition:fade` usages across ~40 files found
the codebase already disciplined (Austen's prior fixes): almost everything is a
single enter/exit fade, an absolute-stacked crossfade, or a grid-stacked one.

Two axes, previously conflated, decide placement:

1. **Is it a crossfade?** Two mutually-exclusive states swapping in one box → yes.
   A single appear/dismiss → no (stays plain fade).
2. **Remount cost.** `{#key}` remounts children. Cheap content → fine. Heavy /
   stateful → must use the no-remount dual-source path.

Sizing (content-sized vs parent-filled) is a primitive option, not a boundary.

## Primitive extension (`src/lib/shared/components/Crossfade.svelte`)

Two optional props, API stays lean:

- `fill?: boolean` — layers become `position:absolute; inset:0` inside a
  `relative`, parent-sized wrapper, instead of `grid-area:1/1`. Covers crossfades
  that fill a sized parent (panels, fixed stages) as well as content-sized ones.
- `delay?: number` — deliberate in-transition stagger (crossfade mode; ignored in
  swap, which computes its own). Default 0.

Reduced-motion ownership stays inside the primitive (collapses duration to 0).
Consumers delete their local fade ternaries.

Single `duration` is intentional: bespoke asymmetric in/out timings collapse to a
`DURATION.*` token (imperceptible; killing micro-timings is the point). The one
perceptible tuning — GenerateEmptyState's 120ms delayed-in — is preserved via
`delay`.

## Migrations (all already remount via `{#key}`, so behavior is preserved)

| File | Call | Rationale |
|---|---|---|
| `landing/SpinnerStatsBar` | `key={mode}`, crossfade, `DURATION.fast` | (done in v1) flex stat-set swap was a real horizontal shift |
| `tool-panel/ToolPanel` sub-tab | `fill`, `DURATION.normal` | parent-filled; heavy but already keyed; also gains reduced-motion |
| `mandala/MandalaLoader` | `fill`, `MANDALA_CROSSFADE_MS` | parent-filled fixed stage; already cycles each dwell |
| `generate/GenerateEmptyState` | grid, `DURATION.emphasis`, `delay={120}` | content-sized; tuned stagger kept |

## Carve-outs (documented, NOT migrated)

- `CellRenderer` + `crossfader-state` — heavy-content dual-source, no remount,
  perf-tuned, dark-mode aware.
- `FuseTab`, `CreationWorkspaceArea` — heavy non-keyed swaps; remount too costly.
- `ButtonPanel` center-zone — a third sizing (absolutely centered against the
  whole panel) the primitive doesn't model; load-bearing container-query CSS on
  the faded element; migrating shifts the button's center.
- ~30 single enter/exit fades — not crossfades.

## Boundary made explicit (the "signal")

- `.claude/rules/crossfade-primitive.md` — ENFORCED routing rule.
- `docs/architecture/crossfade-primitive.md` — ADR with rationale (on-demand).
- Memory `feedback_crossfade_no_layout_shift` — points at the primitive.
- **No automated grep/lint** — a regex can't reliably tell a crossfade from a
  single fade; a noisy gate is worse than none (`component-test-discipline.md`).

## Verification

- `/test/crossfade` harness extended with `fill`, `delay`, and `swap` panels plus
  the automated zero-shift probe across all of them and a reduced-motion path.
- `npm run check` clean for all touched files.
- Curl the affected routes (landing, create) for SSR; offer the browser probe for
  runtime zero-shift proof.

## Out of scope

- Route/view transitions (`view-transitions.css`) — different mechanism.
- An automated lint gate (rejected above).
