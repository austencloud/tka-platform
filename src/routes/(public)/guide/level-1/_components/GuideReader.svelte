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

  // Persist scroll position so it survives HMR remounts, full reloads, and
  // navigating away and back — sessionStorage, restored after the first fit()
  // lays the pages out. Keyed per-reader (one reader today; keep it explicit).
  const SCROLL_KEY = "guide-reader-scroll";

  let activeIndex = $state(0); // highlighted page — driven by scroll position
  let scale = $state(0.5);
  let stageEl = $state<HTMLDivElement>();
  let docWrap = $state<HTMLDivElement>();

  let clicked = $state<SequenceData | null>(null);
  let companionOpen = $state(false);

  // Scroll a page into view; the scroll handler keeps activeIndex (the nav
  // highlight) in sync as you scroll freely between the stacked pages.
  function go(n: number) {
    const i = Math.max(0, Math.min(READER_PAGE_COUNT - 1, n));
    activeIndex = i;
    docWrap?.querySelectorAll<HTMLElement>(".reader-page")[i]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // Nearest-to-viewport-centre page becomes the active (highlighted) one, and
  // the raw scrollTop is persisted so a remount/reload can restore it.
  let scrollRaf = 0;
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!docWrap) return;
      const cont = docWrap.getBoundingClientRect();
      const mid = cont.top + cont.height / 2;
      let best = 0;
      let bestDist = Infinity;
      docWrap.querySelectorAll<HTMLElement>(".reader-page").forEach((p, i) => {
        const r = p.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best !== activeIndex) activeIndex = best;
      try {
        sessionStorage.setItem(SCROLL_KEY, String(docWrap.scrollTop));
      } catch {
        // sessionStorage unavailable (private mode / disabled) — scroll just
        // won't persist; not worth surfacing.
      }
    });
  }

  async function handleSequenceClick(payload: GuideSequenceClick) {
    const seq = stripToSequence(payload.strip, { word: payload.word });
    clicked = (await ensureMotionData(seq)) ?? seq;
    companionOpen = true;
  }
  setGuideSequenceClick(handleSequenceClick);

  // Fit each page FULLY inside the pane (whole page visible — no per-page
  // scrolling); the pages then stack and you scroll between them, like a PDF
  // reader's continuous view. 40/32 = the reader-doc padding (20px / 16px).
  function fit() {
    if (!stageEl) return;
    const w = stageEl.clientWidth - 32;
    const h = stageEl.clientHeight - 40;
    scale = Math.max(0.1, Math.min(w / PAGE_W, h / PAGE_H));
  }

  function restoreScroll() {
    if (!docWrap) return;
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
    } catch {
      return;
    }
    if (Number.isFinite(saved) && saved > 0) {
      // Instant (not smooth) so a remount lands exactly where it left off; the
      // scroll handler then re-derives activeIndex from the restored position.
      docWrap.scrollTo({ top: saved, behavior: "auto" });
    }
  }

  onMount(() => {
    fit();
    // Restore after fit()'s scale change flushes and the pages take their real
    // heights — otherwise scrollTop clamps to a shorter, pre-layout scrollHeight.
    requestAnimationFrame(restoreScroll);
    const ro = new ResizeObserver(fit);
    if (stageEl) ro.observe(stageEl);
    return () => {
      ro.disconnect();
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
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
      onscroll={onScroll}
      style="--w:{PAGE_W * scale}px; --h:{PAGE_H * scale}px"
    >
      <GuideDocument built={BUILT} page={sheetFrame} />
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
  /* Continuous scroller: pages stack vertically, each fit fully to the pane, and
     you scroll between them. */
  .reader-doc {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px 16px;
    scroll-behavior: smooth;
  }
  /* Each page is a scaled footprint box (the fixed 816×1056 sheet is transformed
     down; transform alone doesn't shrink layout size, so the box carries --w/--h).
     flex:0 0 auto keeps its height so the stack scrolls page-by-page. */
  .reader-doc :global(.reader-page) {
    flex: 0 0 auto;
    width: var(--w);
    height: var(--h);
    overflow: hidden;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.4);
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
    .reader-doc {
      scroll-behavior: auto;
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
