<script lang="ts">
  /**
   * GuideReader — the durable 3-pane shell for the faithful guide: manifest nav
   * (left) + one printable page fit-to-pane (center) + slide-open live-animation
   * companion (right). Renders the shared GuideDocument (all manifest pages, the
   * single source of truth) and shows only the active page, scaled to fit — the
   * same technique /book uses, so /print + /book never drift from this.
   *
   * The center is rendered through the `sheetFrame` snippet. Keeping it a snippet
   * is the swappable-frame seam: a future reflow frame drops in here without
   * touching nav or companion (see docs/superpowers/specs/2026-07-07-guide-reader-design.md).
   */
  import { onMount } from "svelte";
  import "../_styles/guide.css";
  import "../_styles/guide-print.css";
  import {
    setGuidePrintMode,
    setGuideSequenceClick,
    type GuideSequenceClick,
  } from "../_data/guide-data-context";
  import GuidePage from "./GuidePage.svelte";
  import GuideDocument from "./GuideDocument.svelte";
  import GuidePageNav from "./GuidePageNav.svelte";
  import GuideCompanion from "./GuideCompanion.svelte";
  import { stripToSequence } from "../_data/guide-sequence-adapter";
  import { ensureMotionData } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";
  import type { GuidePageMeta } from "../_data/guide-manifest";
  import { READER_PAGE_COUNT } from "../_data/guide-reader-nav";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { BUILT } from "../_data/built-pages";

  // Faithful pages render in print STYLE (ink-on-white, static pictographs).
  setGuidePrintMode();

  const PAGE_W = 816; // 8.5in @96dpi
  const PAGE_H = 1056; // 11in

  let activeIndex = $state(5); // open on The Grid (first body page)
  let scale = $state(0.5);
  let stageEl = $state<HTMLDivElement>();
  let docWrap = $state<HTMLDivElement>();

  let clicked = $state<SequenceData | null>(null);
  let companionOpen = $state(false);

  const go = (n: number) => (activeIndex = Math.max(0, Math.min(READER_PAGE_COUNT - 1, n)));

  async function handleSequenceClick(payload: GuideSequenceClick) {
    const seq = stripToSequence(payload.strip, { word: payload.word });
    clicked = (await ensureMotionData(seq)) ?? seq;
    companionOpen = true;
  }
  setGuideSequenceClick(handleSequenceClick);

  function fit() {
    if (!stageEl) return;
    const w = stageEl.clientWidth - 32;
    const h = stageEl.clientHeight - 56; // minus transport row
    scale = Math.max(0.1, Math.min(w / PAGE_W, h / PAGE_H));
  }

  // Show only the active page (GuideDocument mounts them all, like /book).
  $effect(() => {
    const w = docWrap;
    if (!w) return;
    const i = activeIndex;
    w.querySelectorAll<HTMLElement>(".reader-page").forEach((p, k) => {
      p.style.display = k === i ? "block" : "none";
    });
  });

  // Close the companion when navigating to another page.
  $effect(() => {
    activeIndex;
    companionOpen = false;
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowRight") go(activeIndex + 1);
    else if (e.key === "ArrowLeft") go(activeIndex - 1);
  }

  onMount(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (stageEl) ro.observe(stageEl);
    window.addEventListener("keydown", onKey);
    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

{#snippet sheetFrame(meta: GuidePageMeta)}
  <div class="reader-page">
    <div class="page-fixed" style="transform: scale({scale})">
      <GuidePage title={meta.title} pageNumber={meta.pageNumber} fullBleed={meta.fullBleed}>
        {@render meta.content()}
      </GuidePage>
    </div>
  </div>
{/snippet}

<div class="reader">
  <aside class="reader-aside">
    <GuidePageNav built={BUILT} {activeIndex} onSelect={go} />
  </aside>

  <div class="reader-stage" bind:this={stageEl}>
    <div
      class="reader-doc"
      bind:this={docWrap}
      style="--w:{PAGE_W * scale}px; --h:{PAGE_H * scale}px"
    >
      <GuideDocument built={BUILT} page={sheetFrame} />
    </div>
    <div class="transport">
      <button onclick={() => go(activeIndex - 1)} disabled={activeIndex <= 0} aria-label="Previous page">‹ Prev</button>
      <span class="pos">{activeIndex + 1} / {READER_PAGE_COUNT}</span>
      <button onclick={() => go(activeIndex + 1)} disabled={activeIndex >= READER_PAGE_COUNT - 1} aria-label="Next page">Next ›</button>
    </div>
  </div>

  <aside class="reader-companion" class:open={companionOpen} aria-hidden={!companionOpen}>
    {#if companionOpen}
      <GuideCompanion sequence={clicked} onClose={() => (companionOpen = false)} />
    {/if}
  </aside>
</div>

<style>
  .reader {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: #efeaf4;
    color: #1a1a1a;
  }
  .reader-aside {
    width: 240px;
    min-width: 240px;
    height: 100%;
    background: #fff;
    border-right: 1px solid #e2dcec;
  }
  .reader-stage {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .reader-doc {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  /* Each page shows scaled; the fixed 816x1056 sheet is scaled into a footprint
     box so it centres cleanly (transform alone doesn't shrink layout size). */
  .reader-doc :global(.reader-page) {
    display: none;
    width: var(--w);
    height: var(--h);
    overflow: hidden;
    box-shadow: 0 6px 28px rgba(40, 30, 70, 0.28);
    border-radius: 2px;
  }
  .reader-doc :global(.reader-page .page-fixed) {
    width: 816px;
    height: 1056px;
    transform-origin: top left;
    background: #fff;
  }
  .reader-doc :global(.reader-page .guide-page) {
    margin: 0;
    box-shadow: none;
  }
  .transport {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.75rem;
  }
  .transport button {
    font: 500 0.85rem system-ui, sans-serif;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid #cfc6df;
    background: #fff;
    color: #4a2f8a;
    cursor: pointer;
  }
  .transport button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .transport .pos {
    font: 500 0.8rem system-ui, sans-serif;
    color: #6b6386;
    font-variant-numeric: tabular-nums;
    min-width: 64px;
    text-align: center;
  }
  /* Companion slides open from the right (reduced-motion collapses the slide). */
  .reader-companion {
    width: 0;
    min-width: 0;
    overflow: hidden;
    background: #fff;
    border-left: 0 solid #e2dcec;
    transition: width 240ms ease, min-width 240ms ease;
  }
  .reader-companion.open {
    width: 340px;
    min-width: 340px;
    border-left-width: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .reader-companion {
      transition: none;
    }
  }

  /* Mobile: nav collapses when the host establishes an inline-size container. */
  @container (max-width: 720px) {
    .reader-aside {
      display: none;
    }
  }
</style>
