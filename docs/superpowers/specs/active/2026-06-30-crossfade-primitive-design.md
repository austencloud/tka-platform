# Reusable Crossfade Primitive — Design (quick spec)

**Date:** 2026-06-30
**Status:** Active — backlog (separate from the canvas hover-affordance work that
surfaced it)
**Topic:** One shared, zero-layout-shift crossfade primitive to replace the
repeatedly-rebuilt naive fade across the whole app.

## Problem

Crossfades keep getting hand-rolled as two in-flow block siblings, each with
`transition:fade`. Both stay in normal flow during the transition, so the
outgoing element keeps its layout space while the incoming one adds its own —
they stack and shove neighbors, producing multiple layout shifts over the
transition. Austen has corrected this many times since the project began
(2026-06-30): *"this has already been solved time and time again in our code
base ... it's getting annoying having you create crossfades that don't work."*
Captured as memory `feedback_crossfade_no_layout_shift`.

The fix is known and already used in feature-specific code, but there is **no
generic primitive** to reach for, so each new crossfade re-derives it (and often
gets it wrong).

## Existing art (reuse the technique, do not duplicate)

- `src/lib/shared/sequence-viewer/components/CellRenderer.svelte` — the reference
  crossfade. Outgoing image `position:absolute; inset:0` (out of flow), incoming
  image in flow (sizes the box), opacity 1→0 / 0→1. Two modes: `crossfade`
  (overlap) and `swap` (sequential, no overlap).
- `src/lib/shared/choreo-card/state/crossfader-state.svelte.ts` — the state
  machine driving the above (begin/scheduleEnd/abort, mode, dark-mode tracking).
  Image-cell specific; not generic.
- `PipelineEditorDock.svelte` `.dock-title` — ghost-sizer (`display:grid`, layers
  `grid-area:1/1`), the no-layout-shift idiom.
- `src/lib/shared/transitions/transitions.ts` — `DURATION` / easing tokens to
  reuse (don't invent new magic numbers).

Grep confirmed: no `Crossfade.svelte` / generic crossfade component exists.

## Goal

A single primitive that crossfades arbitrary keyed content with **zero layout
shift**, design-token timing, and reduced-motion support — usable for icons,
labels, panels, images, status words, anywhere.

## Approach (grid-stack + `{#key}`)

Idiomatic Svelte fix that can't shift: a wrapper that is `display: grid` with one
implicit cell; the current content is rendered inside a `{#key value}` block so
Svelte mounts the new node and runs `out:` on the old; force **both** children to
`grid-area: 1 / 1` so neither affects the other's layout while both are mounted.

```svelte
<!-- Crossfade.svelte -->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { DURATION } from "$lib/shared/transitions/transitions";
  let { key, duration = DURATION.normal, children }:
    { key: unknown; duration?: number; children: import("svelte").Snippet } = $props();
</script>

<div class="crossfade">
  {#key key}
    <div class="layer" in:fade={{ duration }} out:fade={{ duration }}>
      {@render children()}
    </div>
  {/key}
</div>

<style>
  .crossfade { display: grid; }
  .crossfade > .layer { grid-area: 1 / 1; }      /* both layers share one cell */
  @media (prefers-reduced-motion: reduce) {
    .crossfade > .layer { transition: none; }
  }
</style>
```

Why this is shift-proof: a grid with one column/row sizes to its largest child,
and every `.layer` is pinned to the same `1 / 1` cell. During the transition both
old and new layers occupy that one cell — the box height/width is the max of the
two, and nothing downstream moves. (This is the same guarantee as the ghost-sizer
rule, generalized to transitioning content.)

## API

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `key` | `unknown` | — | Change it to trigger a crossfade (the discriminator). |
| `duration` | `number` | `DURATION.normal` | Fade length; pass a `DURATION.*` token. |
| `mode` | `"crossfade" \| "swap"` | `"crossfade"` | Overlap vs sequential (swap = out then in), mirroring CellRenderer. |
| `children` | `Snippet` | — | The content to render for the current `key`. |

Notes:
- `swap` mode: stagger via `out` then delayed `in` (in delay = out duration), same
  as CellRenderer's swap timing.
- Optional later: `axis`/`slide` blend (crossfade + small translate) using the
  `SLIDE` tokens — only if a consumer needs it (YAGNI for v1).

## Out of scope

- The image-cell crossfade (`CellRenderer` + `crossfader-state`) stays as is —
  it's solved, performance-tuned, and dark-mode aware. Don't fold it into the
  generic primitive.
- Route/view transitions (`view-transitions.css`) — different mechanism.

## Migration

Ship the primitive, then sweep for naive two-sibling fades and replace them.
Candidates to grep at migration time: `transition:fade` pairs where two siblings
share a parent and both sit in normal flow. Do this opportunistically (when
touching a file), not as one big-bang refactor.

## Verification

- A test page (`src/routes/test/*`) toggling `key` rapidly: measure the wrapper's
  `getBoundingClientRect()` and a downstream sibling's `top` across the
  transition — both must stay constant (zero shift). DevTools `evaluate_script`.
- Reduced-motion: with `prefers-reduced-motion`, content swaps with no animation,
  still no shift.

## Risks / notes

- The only genuinely new code is the wrapper; the technique is proven.
- `{#key}` remounts children — fine for cheap content (icons, labels). For
  expensive content (canvases, large images) prefer the CellRenderer
  dual-source approach so nothing remounts; note this in the component doc so
  consumers route heavy content correctly.
