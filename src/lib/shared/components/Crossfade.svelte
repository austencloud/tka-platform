<!--
  Crossfade.svelte

  Generic, zero-layout-shift crossfade for arbitrary keyed content — icons,
  labels, status words, panels, small images. Change `key` and the old content
  fades out while the new content fades in, both pinned to the same cell so
  neither reflows the other and nothing downstream jitters during the transition.

  Two sizing modes:
  - default (grid-stack): a single-cell grid sizes to its largest child, and
    every `.layer` is forced to `grid-area: 1 / 1`. While the old layer is still
    outro-ing and the new layer is intro-ing, both occupy that one cell, so the
    box is the max of the two and siblings don't move. Use for CONTENT-SIZED
    things (labels, icons, status words) — the box hugs the content.
  - `fill`: layers become `position: absolute; inset: 0` inside a `relative`,
    parent-sized wrapper. Use when the crossfade must fill a sized parent (a
    panel, a fixed-size stage) rather than hug its content.

  Both are the same no-layout-shift guarantee as the ghost-sizer idiom
  (PipelineEditorDock `.dock-title`), generalized to transitioning content.

  REMOUNT — read before reaching for this on heavy content: `{#key}` REMOUNTS
  children on every change. Cheap for icons/labels/light panels; wasteful (and
  state-losing: scroll, focus, in-progress work) for canvases, large pictograph
  renders, or stateful heavy panels. Those route through the dual-source
  CellRenderer (`src/lib/shared/sequence-viewer/components/CellRenderer.svelte` +
  `crossfader-state.svelte.ts`) so nothing remounts — solved, perf-tuned,
  dark-mode aware. The remount cost (not the sizing) is the carve-out line.

  Boundary + rationale: docs/architecture/crossfade-primitive.md
  Routing rule: .claude/rules/crossfade-primitive.md
  Spec: docs/superpowers/specs/active/2026-06-30-crossfade-consolidation-design.md
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { Snippet } from "svelte";

  type Mode = "crossfade" | "swap";

  let {
    key,
    duration = DURATION.normal,
    mode = "crossfade",
    fill = false,
    delay = 0,
    children,
  }: {
    /** Change this to trigger a transition. The discriminator for the content. */
    key: unknown;
    /** Fade length in ms. Pass a DURATION.* token, not a raw number. */
    duration?: number;
    /** "crossfade" overlaps in+out; "swap" runs out fully, then in. */
    mode?: Mode;
    /** Layers fill a sized parent (absolute/inset:0) instead of hugging content. */
    fill?: boolean;
    /** Deliberate in-transition stagger (ms) for `crossfade` mode. Ignored in
        `swap` mode, which computes its own delay (= out duration). */
    delay?: number;
    /** Content to render for the current `key`. */
    children: Snippet;
  } = $props();

  let reducedMotion = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  $effect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  });

  // Svelte's `fade` is a JS/CSS transition, so a CSS `transition: none` media
  // query can't disable it — collapse the duration to 0 instead for an instant,
  // animation-free swap under reduced motion.
  const effDuration = $derived(reducedMotion ? 0 : duration);
  // Swap mode holds the incoming layer until the outgoing fade has finished
  // (delay = out duration), mirroring CellRenderer's sequential swap timing.
  // Crossfade mode uses the explicit `delay` prop (0 = pure overlap).
  const inDelay = $derived(
    reducedMotion ? 0 : mode === "swap" ? duration : delay,
  );
</script>

<div class="crossfade" class:fill>
  {#key key}
    <div
      class="layer"
      in:fade={{ duration: effDuration, delay: inDelay }}
      out:fade={{ duration: effDuration }}
    >
      {@render children()}
    </div>
  {/key}
</div>

<style>
  /* Content-sized stack: both layers share one implicit grid cell, so the box
     is the max of the two during the transition and neither reflows the other. */
  .crossfade {
    display: grid;
  }
  .crossfade > .layer {
    grid-area: 1 / 1;
    /* Grid items default to `min-width: auto`, so a layer whose content has a
       wide min-content (a list row with fixed-width action buttons, a nowrap
       label) sizes the track past the container and overflows it — the layer
       stops being a pass-through box. Zero here makes the layer honour whatever
       width its parent gives it, which is what every consumer assumes. */
    min-width: 0;
    min-height: 0;
  }

  /* Fill: layers stack absolutely inside a parent-sized box. Same zero-shift
     guarantee — both occupy inset:0 of the same relative wrapper. */
  .crossfade.fill {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .crossfade.fill > .layer {
    position: absolute;
    inset: 0;
  }
</style>
