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

  // Fit to WIDTH so the page is readable; taller-than-pane pages scroll
  // vertically (the natural document feel). Capped so an ultrawide pane doesn't
  // blow the sheet up past ~1.4× its native 816pt width.
  function fit() {
    if (!stageEl) return;
    const w = stageEl.clientWidth - 32; // horizontal breathing room
    scale = Math.max(0.1, Math.min(1.4, w / PAGE_W));
  }

  // Show only the active page (GuideDocument mounts them all, like /book), and
  // reset the scroll to the top of the newly shown page.
  $effect(() => {
    const w = docWrap;
    if (!w) return;
    const i = activeIndex;
    w.querySelectorAll<HTMLElement>(".reader-page").forEach((p, k) => {
      p.style.display = k === i ? "block" : "none";
    });
    w.scrollTop = 0;
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
    position: relative;
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--theme-bg, oklch(0.13 0.015 270));
    color: var(--theme-text, #e8e6f0);
  }
  .reader-aside {
    width: 240px;
    min-width: 240px;
    height: 100%;
    background: var(--theme-panel-bg, oklch(0.15 0.02 270 / 0.6));
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
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
    align-items: flex-start; /* top-align so tall pages scroll from the top */
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
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
    font: 600 0.85rem system-ui, sans-serif;
    min-height: var(--min-touch-target, 44px);
    padding: 0.5rem 1.15rem;
    border-radius: 999px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #e8e6f0);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    .transport button:hover:not(:disabled) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.22));
    }
  }
  .transport button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 70%, transparent);
    outline-offset: 2px;
  }
  .transport button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .transport .pos {
    font: 600 0.8rem system-ui, sans-serif;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
    min-width: 72px;
    text-align: center;
  }
  /* Companion slides open from the right (reduced-motion collapses the slide). */
  .reader-companion {
    flex: 0 0 auto;
    width: 0;
    min-width: 0;
    overflow: hidden;
    background: var(--theme-panel-bg, oklch(0.15 0.02 270 / 0.6));
    border-left: 0 solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    transition: width 240ms ease, min-width 240ms ease;
  }
  .reader-companion.open {
    width: clamp(360px, 40vw, 560px);
    min-width: 360px;
    border-left-width: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .reader-companion {
      transition: none;
    }
  }

  /* Mobile: nav collapses and the companion becomes a full-panel overlay that
     slides up over the sheet (a 360px push would swallow a phone). */
  @container (max-width: 720px) {
    .reader-aside {
      display: none;
    }
    .reader-companion {
      position: absolute;
      inset: 0;
      width: auto;
      min-width: 0;
      border-left: 0;
      transform: translateY(100%);
      transition: transform 240ms ease;
    }
    .reader-companion.open {
      width: auto;
      min-width: 0;
      transform: translateY(0);
    }
  }
</style>
