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
  import { onMount, flushSync } from "svelte";
  import { replaceState } from "$app/navigation";
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
  import { GuideActiveStep, setGuideActiveStep } from "../_data/guide-active-step.svelte";
  import { SequenceSelection, setSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import "$lib/shared/selection/selection.css";
  import { stripToSequence } from "../_data/guide-sequence-adapter";
  import { ensureMotionData } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";
  import type { GuidePageMeta } from "../_data/guide-manifest";
  import { READER_PAGE_COUNT } from "../_data/guide-reader-nav";
  import {
    GUIDE_READER_BASE,
    indexForSlug,
    slugForIndex,
    slugFromPath,
  } from "../_data/guide-page-links";
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

  // Golden step ring: the companion animates a clicked strip while THIS signal
  // rings the matching cell on the page's on-screen strip, in sync — the same
  // dual-view coupling the Sequence Viewer has. Provided down to the pages via
  // context (getGuideActiveStep); the companion reports its live step in.
  const activeStep = new GuideActiveStep();
  setGuideActiveStep(activeStep);

  // Whole-sequence selection: the accent "Lift & Glow" ring marks WHICH strip is
  // active while the amber step ring (activeStep) hops through its steps. Only the
  // reader sets a scope — /print and /book don't, so their strips stay pristine.
  const selection = new SequenceSelection();
  setSequenceSelection(selection);

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
  // True while we're parking at the saved offset. It (a) drives the `restoring`
  // class that hides the doc until it's landed — so the reader APPEARS already
  // scrolled there rather than jumping from the top — and (b) blocks onScroll
  // from persisting an intermediate clamped value over the saved target. It must
  // be Svelte-owned (a class, not an imperative inline style): `.reader-doc`
  // carries a reactive `style` for --w/--h, and any scale change re-renders that
  // attribute, which would wipe an imperative visibility we set on the element.
  // Initialized hidden when there's an offset to restore so the FIRST paint is
  // already blanked (SSR-safe: savedScrollTarget() catches missing sessionStorage).
  //
  // Deep link: /learn/guide/<slug> parks on that page and takes precedence over
  // the saved scroll offset (spec: 2026-07-09-guide-deep-links-design.md).
  const deepLinkIndex: number | null =
    typeof window === "undefined"
      ? null
      : (() => {
          const slug = slugFromPath(window.location.pathname);
          return slug ? indexForSlug(slug) : null;
        })();
  let restoring = $state(deepLinkIndex !== null || savedScrollTarget() > 0);
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
      if (restoring) return; // don't clobber the saved target mid-restore
      try {
        sessionStorage.setItem(SCROLL_KEY, String(docWrap.scrollTop));
      } catch {
        // sessionStorage unavailable (private mode / disabled) — scroll just
        // won't persist; not worth surfacing.
      }
    });
  }

  // Which prop the companion animates for the clicked strip (staff pages hand
  // up "staff" so the player renders real staves from the authored orientations).
  let clickedPropType = $state<"hand" | "staff">("hand");

  async function handleSequenceClick(payload: GuideSequenceClick) {
    // Ring the clicked strip's Start box immediately (before motion data even
    // resolves), then the player's live step drives it from there.
    activeStep.begin(payload.key ?? "");
    selection.select(payload.key ?? ""); // persist the accent ring on the active strip
    clickedPropType = payload.propType ?? "hand";
    const seq = stripToSequence(payload.strip, { word: payload.word });
    clicked = (await ensureMotionData(seq)) ?? seq;
    companionOpen = true;
  }
  setGuideSequenceClick(handleSequenceClick);

  // Live URL sync: the address bar always carries the active page's deep link
  // (replaceState — no history spam; copying the URL bar IS the share
  // affordance, like the sequence ?open= sync). Gated to /learn/guide paths so
  // the test harness and other hosts never rewrite their URLs.
  $effect(() => {
    const i = activeIndex;
    if (restoring) return;
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith(GUIDE_READER_BASE)) return;
    const slug = slugForIndex(i);
    if (!slug) return;
    const t = setTimeout(() => {
      if (window.location.pathname !== `${GUIDE_READER_BASE}/${slug}`) {
        replaceState(
          `${GUIDE_READER_BASE}/${slug}${window.location.search}${window.location.hash}`,
          {}
        );
      }
    }, 200);
    return () => clearTimeout(t);
  });

  // Fit each page FULLY inside the pane (whole page visible — no per-page
  // scrolling); the pages then stack and you scroll between them, like a PDF
  // reader's continuous view. 40/32 = the reader-doc padding (20px / 16px).
  function fit() {
    if (!stageEl) return;
    const w = stageEl.clientWidth - 32;
    const h = stageEl.clientHeight - 40;
    scale = Math.max(0.1, Math.min(w / PAGE_W, h / PAGE_H));
  }

  // The persisted offset to restore (0 = nothing to restore).
  function savedScrollTarget(): number {
    try {
      const v = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }

  onMount(() => {
    // Apply the fitted scale, then flush it to the DOM synchronously so the
    // pages take their real heights before we measure/scroll — the doc is then
    // tall enough that the very first park lands at the target, in this same
    // (pre-paint) tick. `restoring` keeps the doc hidden until we land.
    fit();
    flushSync();

    const reveal = () => {
      restoring = false;
    };

    // Where to park: a /learn/guide/<slug> deep link beats the saved scroll
    // offset. The deep-link target is element-measured (recomputed each attempt
    // while layout settles); the saved offset is a fixed number.
    const fixedTarget = savedScrollTarget();
    const getTarget: (() => number | null) | null =
      deepLinkIndex !== null
        ? () => {
            if (!docWrap) return null;
            const el = docWrap.querySelectorAll<HTMLElement>(".reader-page")[deepLinkIndex];
            if (!el) return null;
            const delta = el.getBoundingClientRect().top - docWrap.getBoundingClientRect().top;
            return docWrap.scrollTop + delta;
          }
        : fixedTarget > 0
          ? () => fixedTarget
          : null;

    if (deepLinkIndex !== null) activeIndex = deepLinkIndex; // nav highlight up front

    if (getTarget && docWrap) {
      let attempts = 0;
      let lastHeight = -1;
      let stableFrames = 0;
      const park = (): void => {
        if (!docWrap) return reveal();
        const target = getTarget();
        if (target === null) return reveal();
        const scrollHeight = docWrap.scrollHeight;
        // behavior:"instant" — NOT "auto". "auto" defers to the doc's CSS
        // scroll-behavior:smooth, which animates every scrollTo and is exactly
        // the visible crawl-to-position we're eliminating. "instant" jumps.
        docWrap.scrollTo({ top: target, behavior: "instant" });
        attempts += 1;

        // Landed on the target — reveal.
        if (Math.abs(docWrap.scrollTop - target) <= 2) return reveal();

        // If the scale is still settling the height keeps growing; retry until
        // we reach the target. Only once the height holds steady across a few
        // frames AND still can't reach the target do we accept the clamp
        // (content is genuinely shorter than the target now).
        if (scrollHeight === lastHeight) stableFrames += 1;
        else {
          stableFrames = 0;
          lastHeight = scrollHeight;
        }
        const maxScroll = scrollHeight - docWrap.clientHeight;
        if ((stableFrames >= 3 && maxScroll < target) || attempts >= 90) return reveal();
        requestAnimationFrame(park);
      };
      park(); // first attempt synchronously (pre-paint); retries via rAF if needed
    } else {
      reveal();
    }

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
      class:restoring
      bind:this={docWrap}
      onscroll={onScroll}
      style="--w:{PAGE_W * scale}px; --h:{PAGE_H * scale}px"
    >
      <GuideDocument built={BUILT} page={sheetFrame} />
    </div>
  </div>

  <aside class="reader-companion" class:open={companionOpen} aria-hidden={!companionOpen}>
    {#if companionOpen}
      <GuideCompanion
        sequence={clicked}
        propType={clickedPropType}
        onStep={(s) => activeStep.report(s)}
        onClose={() => {
          companionOpen = false;
          activeStep.clear();
          selection.clear();
        }}
      />
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
  /* Hidden (but still laid out, so scrollHeight is valid and scrollTo works)
     while restoring the saved scroll offset — the doc reveals already parked
     there instead of visibly jumping from the top. */
  .reader-doc.restoring {
    visibility: hidden;
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
