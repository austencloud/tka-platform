# Crossfade Primitive — ENFORCED

## The Problem This Solves

Crossfades kept getting hand-rolled as two in-flow block siblings, each with
`transition:fade`. Both stay in normal flow during the transition, so the
outgoing element keeps its layout space while the incoming one adds its own —
they stack and shove neighbors, producing layout shift across the transition.
Austen corrected this many times since the project began (2026-06-30): _"this
has already been solved time and time again in our code base ... it's getting
annoying having you create crossfades that don't work."_ The fix was known and
used in feature-specific code, but there was no generic primitive to reach for,
so each new crossfade re-derived it (and often got it wrong).

A single shared primitive now exists and is the only sanctioned way to crossfade
content. This rule names it and the routing decision explicitly, the same way
`chip-primitives.md` did for filter bars.

## The Canonical Primitive

`src/lib/shared/components/Crossfade.svelte`

```svelte
<Crossfade key={discriminator} duration={DURATION.normal} mode="crossfade">
  {content for the current key}
</Crossfade>
```

Props:

| Prop            | Default           | Purpose                                                                                                                               |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `key`           | —                 | Change it to trigger a crossfade (the discriminator).                                                                                 |
| `duration`      | `DURATION.normal` | Fade length. Pass a `DURATION.*` token, never a raw number.                                                                           |
| `mode`          | `"crossfade"`     | `crossfade` overlaps in+out; `swap` runs out fully, then in.                                                                          |
| `motion`        | `"fade"`          | `step` adds the canonical short directional drift for wizard-like navigation. Pair it with `mode="swap"`.                             |
| `direction`     | `1`               | Forward is `1`, back is `-1`. Only affects `motion="step"`.                                                                           |
| `fill`          | `false`           | Layers fill a sized parent (`absolute; inset:0`) instead of hugging content. Use inside panels / fixed-size stages.                   |
| `animateHeight` | `false`           | Measures each keyed layer and eases the wrapper between materially different natural heights in both directions. Ignored with `fill`. |
| `delay`         | `0`               | Deliberate in-transition stagger (crossfade mode only).                                                                               |

It grid-stacks (or `fill`-stacks) the old and new content in one cell so neither
reflows the other — zero layout shift, by construction. Reduced-motion is owned
by the primitive (collapses duration to 0); consumers must NOT re-implement it.

## The Routing Rule

A **true crossfade** = two mutually-exclusive states that swap in the same box.
Route by two axes:

- **Sizing** — similarly sized content (default grid mode), content whose natural
  height changes materially (`animateHeight`), or layers that fill a sized parent
  (`fill`).
- **Remount cost** — `{#key}` REMOUNTS children. Cheap content (labels, icons,
  status words, light panels): fine. Heavy/stateful content (canvas, large
  pictograph render, a panel with scroll/focus/in-progress state): NOT fine —
  remounting drops that state and costs paint. Those use the dual-source
  no-remount path, NOT this primitive.

So:

1. Cheap true crossfade → `<Crossfade>` (add `animateHeight` when the wrapper
   follows materially different layer heights, `fill` if a sized parent owns
   the box, `mode="swap" motion="step" direction={direction}` for sequential
   decision screens, or `delay` for a stagger). The step mode guarantees that
   outgoing and incoming copy do not become readable at the same time and
   communicates forward/back direction without a feature-local transition.
2. Heavy/stateful true crossfade → CellRenderer dual-source
   (`src/lib/shared/sequence-viewer/components/CellRenderer.svelte` +
   `crossfader-state.svelte.ts`). No remount.
3. Single enter/exit (a modal appears, a toast dismisses, a panel mounts — NO
   second state) → plain `transition:fade`. This is NOT a crossfade. Do not wrap
   it in `<Crossfade>` (a fake `key` makes the code lie about its intent).

Full boundary + rationale: `docs/architecture/crossfade-primitive.md`.

## Keep-Separate (deliberate carve-outs — do NOT migrate to the primitive)

- `CellRenderer` + `crossfader-state` — dual-source, no remount, perf-tuned,
  dark-mode aware. The heavy-content path.
- `ToolPanel`/workspace-scale swaps that are heavy but already keyed migrate only
  with `fill`; genuinely heavy non-keyed swaps (`FuseTab`, `CreationWorkspaceArea`)
  stay hand-rolled (remount cost).
- `ButtonPanel` center-zone — absolutely centered against the whole panel (a
  third sizing the primitive doesn't model), with load-bearing container-query
  CSS on the faded element. Migrating shifts the button's center. Stays.
- All single enter/exit fades — not crossfades.

## The First-Time Failure (2026-07-10 — check BEFORE wiring any crossfade)

AI-written crossfades get this wrong on the first attempt, every time (Austen:
"ever since I started coding with AI I always get crossfades incorrectly the
very first time"). The failure shape: variable-height content in default
(content-sized) mode inside a visual stage/panel — during and after the fade the
box resizes to the current layer and shoves everything below it. The checklist:

1. Crossfade inside a visually framed stage/panel/box? Choose who owns its size:
   a fixed-height (or flex-grown) parent uses **`fill`**; a content-sized wrapper
   whose states differ materially uses **`animateHeight`**. Default grid mode is
   only for similarly sized content such as labels, icons, and status words.
2. Any content identical across keys (descriptions, captions, chrome)? → move
   it OUTSIDE the crossfade. Only what actually changes crossfades.
3. After wiring, swap to every key: does anything below or beside the crossfade
   move? If yes, wrong mode — fix before shipping.

## Forbidden

- A new crossfade built from two in-flow `transition:fade` siblings when
  `<Crossfade>` fits.
- Materially different variable-height layers in default mode. Use
  `animateHeight` when content owns the wrapper height, or `fill` when the parent
  owns a fixed/flex-grown stage (see The First-Time Failure).
- Content identical across keys living inside the crossfade.
- Re-deriving the grid-stack / absolute-stack technique inline instead of using
  the primitive.
- Wrapping a single enter/exit fade in `<Crossfade>` (semantically wrong).
- Routing heavy/stateful content through `<Crossfade>`'s `{#key}` remount.
- Re-implementing reduced-motion on a `<Crossfade>` consumer (the primitive owns it).

## Related

- `never-hand-roll.md` (master), `no-layout-shift.md`, `chip-primitives.md`
- Memory: `feedback_crossfade_no_layout_shift`
- ADR: `docs/architecture/crossfade-primitive.md`
- Spec: `docs/superpowers/specs/shipped/2026-06-30-crossfade-consolidation-design.md`
