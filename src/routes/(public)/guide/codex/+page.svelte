<script lang="ts">
  import { onMount } from "svelte";
  import CodexSheet from "./_components/CodexSheet.svelte";
  import { SHEETS } from "./_data/codex-groups";
  import GuideSeo from "../level-1/_components/GuideSeo.svelte";

  function print() {
    window.print();
  }

  // Scale-to-fit-width (client-only) - same treatment as GuidePageHost's print-
  // sheet toggle: each artboard is a fixed 816x1056 (8.5x11in) print page that
  // otherwise renders at its native size regardless of viewport, floating tiny
  // in a wide/4K viewport. Shrinks below 816px available width (mobile),
  // upscales up to 1.9x above it (past that the raster gets soft, not crisp).
  // One shared scale for every sheet on the page - they're all the same
  // nominal size, so a single measurement covers all of them.
  let sheetsEl = $state<HTMLDivElement>();
  let scale = $state(1);
  // .sheets centers each (always-816px-wide) .sheet-wrap via flex
  // `align-items: center`, so at ANY scale the box's own unscaled center
  // already sits at the container's visual center. transform-origin: top left
  // grows/shrinks .sheet-scale from ITS OWN top-left corner though, which
  // moves that center - shifting by half the size delta (816 * (1 - scale) / 2)
  // re-centers it. Unlike GuidePageHost's clamped version, this formula is
  // continuous across both directions because flex centering (unlike
  // margin: auto) doesn't clamp to flush-left when the box is wider than its
  // container - it stays symmetric, so no max(0, ...) is needed here.
  const shiftPx = $derived(408 * (1 - scale));

  onMount(() => {
    const fit = () => {
      if (!sheetsEl) return;
      scale = Math.min(sheetsEl.clientWidth / 816, 1.9);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (sheetsEl) ro.observe(sheetsEl);
    return () => ro.disconnect();
  });
</script>

<GuideSeo
  title="Double Staff Codex: Every Base Letter, Printable | The Kinetic Alphabet"
  description="The complete Kinetic Alphabet base-letter codex for double staves, Types 1–6, as a printable reference sheet."
  path="/guide/codex"
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Codex", path: "/guide/codex" },
  ]}
/>

<div class="codex-print-root">
  <div class="toolbar">
    <button class="print-btn" onclick={print}>Print / Save PDF</button>
  </div>

  <div class="sheets" bind:this={sheetsEl}>
    {#each SHEETS as sheet, i (i)}
      <div class="sheet-wrap" style="height: {1056 * scale}px">
        <div class="sheet-scale" style="transform: translateX({shiftPx}px) scale({scale})">
          <CodexSheet {sheet} />
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .codex-print-root {
    min-height: 100vh;
    background: #4a4f57;
    padding: 1.5rem 0 3rem;
  }

  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    padding: 0 0 1.25rem;
  }

  .print-btn {
    font: 600 0.95rem/1 system-ui, sans-serif;
    padding: 0.7rem 1.4rem;
    border: none;
    border-radius: 999px;
    background: #111;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }

  .print-btn:hover {
    background: #000;
  }

  .sheets {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  /* Reserves the SCALED footprint (bound in the markup to 1056 * scale) so a
     stack of upscaled sheets doesn't overlap the next one down (transform
     doesn't affect layout). Fixed 816px width matches .sheet-scale's own
     unscaled width, so flex `align-items: center` on .sheets centers it. */
  .sheet-wrap {
    width: 816px;
  }

  /* The actual print-page artboard: fixed native size, scaled to fit via
     transform (see shiftPx above for the centering compensation). */
  .sheet-scale {
    width: 816px;
    height: 1056px;
    transform-origin: top left;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }

  @media print {
    .codex-print-root {
      background: #fff;
      padding: 0;
    }
    .toolbar {
      display: none;
    }
    .sheets {
      gap: 0;
    }
    /* Printing always wants the native 1:1 page size, never the screen-fit
       scale (a wide-monitor 1.9x scale would print oversized/clipped) - the
       reserved height and transform are both screen-only concerns. */
    .sheet-wrap {
      width: auto;
      height: auto !important;
      break-after: page;
    }
    .sheet-wrap:last-child {
      break-after: auto;
    }
    .sheet-scale {
      transform: none !important;
      box-shadow: none;
    }
  }

  @page {
    size: letter portrait;
    margin: 0;
  }
</style>
