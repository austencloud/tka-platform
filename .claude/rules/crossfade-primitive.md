# Crossfade Primitive — ENFORCED

## The Problem This Solves

Crossfades kept getting hand-rolled as two in-flow block siblings, each with
`transition:fade`. Both stay in normal flow during the transition, so the
outgoing element keeps its layout space while the incoming one adds its own —
they stack and shove neighbors, producing layout shift across the transition.
Austen corrected this many times since the project began (2026-06-30): *"this
has already been solved time and time again in our code base ... it's getting
annoying having you create crossfades that don't work."* The fix was known and
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

| Prop | Default | Purpose |
|---|---|---|
| `key` | — | Change it to trigger a crossfade (the discriminator). |
| `duration` | `DURATION.normal` | Fade length. Pass a `DURATION.*` token, never a raw number. |
| `mode` | `"crossfade"` | `crossfade` overlaps in+out; `swap` runs out fully, then in. |
| `fill` | `false` | Layers fill a sized parent (`absolute; inset:0`) instead of hugging content. Use inside panels / fixed-size stages. |
| `delay` | `0` | Deliberate in-transition stagger (crossfade mode only). |

It grid-stacks (or `fill`-stacks) the old and new content in one cell so neither
reflows the other — zero layout shift, by construction. Reduced-motion is owned
by the primitive (collapses duration to 0); consumers must NOT re-implement it.

## The Routing Rule

A **true crossfade** = two mutually-exclusive states that swap in the same box.
Route by two axes:

- **Sizing** — content-sized (default grid mode) vs fills a sized parent (`fill`).
- **Remount cost** — `{#key}` REMOUNTS children. Cheap content (labels, icons,
  status words, light panels): fine. Heavy/stateful content (canvas, large
  pictograph render, a panel with scroll/focus/in-progress state): NOT fine —
  remounting drops that state and costs paint. Those use the dual-source
  no-remount path, NOT this primitive.

So:

1. Cheap true crossfade → `<Crossfade>` (add `fill` if it fills a parent,
   `mode="swap"` for sequential, `delay` for a stagger).
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

## Forbidden

- A new crossfade built from two in-flow `transition:fade` siblings when
  `<Crossfade>` fits.
- Re-deriving the grid-stack / absolute-stack technique inline instead of using
  the primitive.
- Wrapping a single enter/exit fade in `<Crossfade>` (semantically wrong).
- Routing heavy/stateful content through `<Crossfade>`'s `{#key}` remount.
- Re-implementing reduced-motion on a `<Crossfade>` consumer (the primitive owns it).

## Related

- `never-hand-roll.md` (master), `no-layout-shift.md`, `chip-primitives.md`
- Memory: `feedback_crossfade_no_layout_shift`
- ADR: `docs/architecture/crossfade-primitive.md`
- Spec: `docs/superpowers/specs/active/2026-06-30-crossfade-consolidation-design.md`
