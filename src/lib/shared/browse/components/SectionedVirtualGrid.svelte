<!--
  SectionedVirtualGrid — windowed rendering for the SECTIONED gallery.

  The gallery always runs with sections enabled, so the old sectioned path in
  BrowseGrid rendered a ChoreoCardThumbnail for every word across every section
  with NO virtualization (BrowseGrid's `useVirtualization` excludes the
  sectioned case). Tapping a big filter (e.g. Level 1/2) mounted 150–250 cards
  synchronously and froze the tap.

  This virtualizes the sectioned layout by flattening sections into a typed item
  stream — banner (Level N) / header (letter) / row (≤columnCount cards) — and
  windowing it with @tanstack/svelte-virtual (the same lib the flat
  VirtualizedSequenceGrid uses).

  Integration decision: it does NOT own a scroll container. It virtualizes
  against an EXTERNAL scroll element (BrowsePanel's `.panel-content`, passed in),
  so there stays exactly ONE scroller — required because the section sidebar is
  position:sticky inside it, and scroll-restore / toolbar-hide / the skeleton
  overlay are all already wired to it. TanStack `scrollMargin` accounts for the
  list's offset below the toolbar/filter bar.
-->
<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import {
    createVirtualizer,
    type VirtualItem,
    type SvelteVirtualizer,
  } from "@tanstack/svelte-virtual";
  import type { Readable } from "svelte/store";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import SectionHeader from "$lib/shared/browse/components/SectionHeader.svelte";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import type { SequenceSection } from "$lib/shared/browse/domain/models/browse-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { BrowseThumbnailProvider } from "$lib/shared/browse/services/browse-thumbnail-provider";
  import type { BrowseEngine } from "../engine/types";
  import {
    buildVariationMap,
    variationGroupKey,
  } from "$lib/shared/browse/services/variation-grouper";
  import { calculateGalleryAspectRatio } from "$lib/shared/render/services/layout-calculator";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/cell-pre-warmer";
  import { prefetch as prefetchSequenceData } from "$lib/shared/sequence-viewer/services/sequence-data-provider";

  export interface SectionedGridApi {
    /** Scroll the section whose header carries `title` to the top of the view. */
    scrollToSectionTitle: (title: string) => void;
  }

  interface Props {
    engine: BrowseEngine;
    thumbnailService: BrowseThumbnailProvider | null;
    /** The single external scroll container (BrowsePanel's `.panel-content`). */
    scrollElement: HTMLElement | null;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    eager?: boolean;
    handPathMode?: boolean;
    showBlueMotion?: boolean;
    showRedMotion?: boolean;
    addWord?: boolean;
    addDifficultyLevel?: boolean;
    selectedIds?: ReadonlySet<string>;
    /** Imperative API for the sidebar's section jump. */
    onGridReady?: (api: SectionedGridApi) => void;
    /** Reports the section title at the top of the viewport (sidebar highlight). */
    onActiveSectionChange?: (title: string | undefined) => void;
  }

  const {
    engine,
    thumbnailService,
    scrollElement,
    onAction = () => {},
    eager = false,
    handPathMode = false,
    showBlueMotion = true,
    showRedMotion = true,
    addWord = true,
    addDifficultyLevel = true,
    selectedIds,
    onGridReady,
    onActiveSectionChange,
  }: Props = $props();

  const compositionManager = getImageCompositionManager();

  // ── Card render context (mirrors VirtualizedSequenceGrid) ──────────────
  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });
  const isCatDog = $derived(
    isCatDogMode(propSettings.bluePropType, propSettings.redPropType, propSettings.catDogMode)
  );

  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());
  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }
  visibilityManager.registerObserver(handleVisibilityChange);

  // ── Variation grouping (map from the FULL filtered set) ────────────────
  const variationMap = $derived.by(() =>
    buildVariationMap(engine.sequences as SequenceData[])
  );
  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const key = variationGroupKey(sequence);
    if (!key) return [sequence];
    return variationMap.get(key) ?? [sequence];
  }

  // One card per WORD — collapse a word's variations to a single card (the pill
  // cycles the rest). Keyed by the simplified word (variationGroupKey).
  function dedupeByWord(seqs: SequenceData[]): SequenceData[] {
    const seen = new Set<string>();
    const out: SequenceData[] = [];
    for (const seq of seqs) {
      const key = variationGroupKey(seq) ?? seq.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(seq);
    }
    return out;
  }

  /** Strip the "Level N · " prefix so a level section's header shows just the letter. */
  function letterTitle(title: string): string {
    return title.replace(/^Level\s+\d+\s+·\s+/u, "");
  }

  // ── Flatten sections into a typed, windowable item stream ──────────────
  type Item =
    | { type: "banner"; key: string; sectionTitle: string; level: number; levelTotal: number }
    | { type: "header"; key: string; sectionTitle: string; label: string; count: number; hideSteps: boolean; isLevel: boolean }
    | { type: "row"; key: string; sectionTitle: string; sequences: SequenceData[]; isLevel: boolean };

  const stepsRedundant = $derived(engine.activeFilters.has("length"));

  const flat = $derived.by(() => {
    const secs = engine.sections as SequenceSection[];
    const cols = engine.columnCount;
    const isLevel = secs.length > 0 && secs.every((s) => typeof s.level === "number");

    const totals = new Map<number, number>();
    if (isLevel) for (const s of secs) totals.set(s.level!, (totals.get(s.level!) ?? 0) + s.count);

    const items: Item[] = [];
    const headerIndexByTitle = new Map<string, number>();
    let prevLevel: number | undefined;

    for (const s of secs) {
      const showBanner = isLevel && s.level !== prevLevel;
      if (showBanner) {
        items.push({
          type: "banner",
          key: `b-${s.level}`,
          sectionTitle: s.title,
          level: s.level ?? 0,
          levelTotal: totals.get(s.level!) ?? 0,
        });
      }
      prevLevel = s.level;

      const display = dedupeByWord(s.sequences as SequenceData[]);

      headerIndexByTitle.set(s.title, items.length);
      items.push({
        type: "header",
        key: `h-${s.id}`,
        sectionTitle: s.title,
        label: isLevel ? letterTitle(s.title) : s.title,
        count: display.length,
        hideSteps: stepsRedundant,
        isLevel,
      });

      for (let i = 0; i < display.length; i += cols) {
        items.push({
          type: "row",
          key: `r-${s.id}-${i}`,
          sectionTitle: s.title,
          sequences: display.slice(i, i + cols),
          isLevel,
        });
      }
    }

    return { items, headerIndexByTitle, isLevel };
  });

  // ── Virtualizer wiring ─────────────────────────────────────────────────
  let listEl = $state<HTMLDivElement | null>(null);
  let listWidth = $state(0);
  let scrollMargin = $state(0);

  let virtualItems = $state<VirtualItem[]>([]);
  let totalHeight = $state(0);

  const BANNER_H = 64;
  const HEADER_H = 44;
  const ROW_SPACING = 8;

  function estimateItemSize(index: number): number {
    const it = flat.items[index];
    if (!it) return HEADER_H;
    if (it.type === "banner") return BANNER_H;
    if (it.type === "header") return HEADER_H;
    // row
    const cols = engine.columnCount;
    // Never estimate from a made-up width: a 360px guess on a 4K container
    // under-estimated every row ~4x, so first paint scattered rows into wrong
    // slots (visible as a hole between rows until measurement caught up). The
    // scroller's width is always real and available before the list's own
    // ResizeObserver fires.
    const width =
      listWidth > 0 ? listWidth : (scrollElement?.clientWidth ?? 360);
    const gap = 8;
    const cardWidth = (width - (cols - 1) * gap) / cols;
    let maxSteps = 4;
    for (const seq of it.sequences) {
      const steps = seq?.steps?.length || seq?.sequenceLength || 4;
      if (steps > maxSteps) maxSteps = steps;
    }
    const aspect = calculateGalleryAspectRatio(maxSteps, compositionManager.startPositionLayout);
    return cardWidth / aspect + ROW_SPACING;
  }

  type VirtualizerInstance = SvelteVirtualizer<HTMLElement, Element>;
  type VirtualizerStore = Readable<VirtualizerInstance>;
  let currentVirtualizer: VirtualizerInstance | null = null;
  let virtualizerStore: VirtualizerStore | null = null;
  let storeUnsub: (() => void) | null = null;
  let lastActive: string | undefined;

  function measureScrollMargin(): number {
    if (!listEl || !scrollElement) return 0;
    const listRect = listEl.getBoundingClientRect();
    const scRect = scrollElement.getBoundingClientRect();
    return Math.max(0, listRect.top - scRect.top + scrollElement.scrollTop);
  }

  function reportActive(v: VirtualizerInstance) {
    const off = v.scrollOffset ?? 0;
    const vis = v.getVirtualItems();
    let active: string | undefined;
    for (const vi of vis) {
      if (vi.start + vi.size > off + 4) {
        active = flat.items[vi.index]?.sectionTitle;
        break;
      }
    }
    if (active !== lastActive) {
      lastActive = active;
      onActiveSectionChange?.(active);
    }
  }

  let createSignature = "";

  function createAndSubscribe() {
    if (!scrollElement) return;
    // Recreate ONLY on structural change (item count / columns) — those remount
    // the item nodes so `use:measureItem` re-runs. Recreating on width/scroll-
    // margin churn discards the measurement cache WITHOUT remounting nodes, which
    // strands stale estimates and opens gaps between sections. Width changes go
    // through currentVirtualizer.measure() instead (see the ResizeObserver).
    const sig = `${flat.items.length}|${engine.columnCount}`;
    if (sig === createSignature && currentVirtualizer) return;
    createSignature = sig;

    // Seed the row width SYNCHRONOUSLY before the first estimates. The rAF
    // seed below (onMount) lands a frame after the virtualizer has already
    // positioned every row from a zero-width fallback — that one bad frame is
    // the "hole" between rows on wide screens.
    if (listEl) {
      const w = listEl.getBoundingClientRect().width;
      if (w > 0 && Math.abs(w - listWidth) > 1) listWidth = w;
    }

    // Refresh the (stable) list offset within the scroller before creating.
    scrollMargin = measureScrollMargin();

    storeUnsub?.();

    virtualizerStore = createVirtualizer({
      count: flat.items.length,
      getScrollElement: () => scrollElement,
      estimateSize: estimateItemSize,
      overscan: 4,
      scrollMargin,
    });

    storeUnsub = virtualizerStore.subscribe((v) => {
      currentVirtualizer = v;
      virtualItems = v.getVirtualItems();
      totalHeight = v.getTotalSize();
      reportActive(v);
    });

    // A fresh virtualizer starts from estimates. The already-mounted item nodes
    // won't re-run the `use:measureItem` action, so feed their real heights back
    // in — otherwise stale estimates leave gaps between sections.
    requestAnimationFrame(remeasureMounted);
  }

  function remeasureMounted() {
    if (!currentVirtualizer || !listEl) return;
    for (const node of listEl.querySelectorAll<HTMLElement>(".v-item")) {
      currentVirtualizer.measureElement(node);
    }
  }

  function measureItem(node: HTMLElement) {
    currentVirtualizer?.measureElement(node);
    // Card thumbnails can settle to a different height after mount (aspect
    // finalization / async cells); keep the measured size in sync.
    const ro = new ResizeObserver(() => currentVirtualizer?.measureElement(node));
    ro.observe(node);
    return { destroy: () => ro.disconnect() };
  }

  onMount(() => {
    scrollMargin = measureScrollMargin();
    createAndSubscribe();

    if (onGridReady) {
      onGridReady({
        scrollToSectionTitle: (title: string) => {
          const idx = flat.headerIndexByTitle.get(title);
          if (idx == null || !currentVirtualizer) return;
          // Variable-size virtualization: the first jump uses estimates for the
          // still-unmeasured sections above the target, so it lands short. Each
          // jump measures more en route; re-jump a couple frames to converge on
          // the exact position. Instant (not smooth) so each correction is crisp.
          const jump = () => currentVirtualizer?.scrollToIndex(idx, { align: "start" });
          jump();
          requestAnimationFrame(() => {
            jump();
            requestAnimationFrame(() => jump());
          });
        },
      });
    }

    let resizeRaf: number | null = null;
    const ro = new ResizeObserver((entries) => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        let widthChanged = false;
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0 && Math.abs(w - listWidth) > 1) {
            listWidth = w;
            widthChanged = true;
          }
        }
        // Width change: re-estimate + re-measure IN PLACE. Never recreate here —
        // recreating without remounting nodes strands stale estimates.
        if (widthChanged) currentVirtualizer?.measure();
      });
    });
    if (listEl) ro.observe(listEl);

    // Settle the initial width once, then let measurement/RO take over.
    requestAnimationFrame(() => {
      if (listEl) {
        const w = listEl.getBoundingClientRect().width;
        if (w > 0 && Math.abs(w - listWidth) > 1) {
          listWidth = w;
          currentVirtualizer?.measure();
        }
      }
    });

    return () => {
      ro.disconnect();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
    };
  });

  onDestroy(() => {
    storeUnsub?.();
    visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // Recreate when the item stream, column count, or (late-arriving) scroll
  // element changes. Tracking `scrollElement` covers BrowsePanel's `bind:this`
  // landing after this child mounts.
  $effect(() => {
    const _count = flat.items.length;
    const _cols = engine.columnCount;
    const sc = scrollElement;
    untrack(() => {
      if (sc) createAndSubscribe();
    });
  });

  // Pre-warm pictograph cells for visible rows (debounced), matching the flat grid.
  let preWarmTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const rows = virtualItems;
    if (!rows.length) return;
    untrack(() => {
      if (preWarmTimer) clearTimeout(preWarmTimer);
      preWarmTimer = setTimeout(() => {
        preWarmTimer = null;
        for (const vi of rows) {
          const it = flat.items[vi.index];
          if (it?.type !== "row") continue;
          for (const seq of it.sequences) cellPreWarmer.preWarmSequence(seq, "background");
        }
      }, 150);
    });
  });
  onDestroy(() => {
    if (preWarmTimer) clearTimeout(preWarmTimer);
  });

  function handleAction(action: string, sequence: SequenceData, variations?: SequenceData[]) {
    onAction(action, sequence, variations);
  }
  function handleHover(seq: SequenceData) {
    cellPreWarmer.preWarmSequence(seq, "user-visible");
    prefetchSequenceData(seq);
  }
</script>

<div
  bind:this={listEl}
  class="sectioned-virtual"
  style:height="{totalHeight}px"
  style:position="relative"
  style:width="100%"
>
  {#each virtualItems as vi (vi.key)}
    {@const it = flat.items[vi.index]}
    {#if it}
      <div
        class="v-item"
        data-index={vi.index}
        data-section={it.type === "header" ? it.sectionTitle : undefined}
        use:measureItem
        style:position="absolute"
        style:top="0"
        style:left="0"
        style:width="100%"
        style:transform="translateY({vi.start - scrollMargin}px)"
      >
        {#if it.type === "banner"}
          <div class="level-banner">
            <DifficultyBadge level={it.level} size="34px" />
            <span class="level-banner-title">Level {it.level}</span>
            <span class="level-banner-count">{it.levelTotal}</span>
            <div class="level-banner-divider"></div>
          </div>
        {:else if it.type === "header"}
          <div class="header-wrap" class:under-level={it.isLevel}>
            <SectionHeader title={it.label} count={it.count} hideSteps={it.hideSteps} />
          </div>
        {:else}
          <div
            class="sequences-grid grid-view"
            class:under-level={it.isLevel}
            class:is-transitioning={engine.isTransitioning}
            style:grid-template-columns="repeat({engine.columnCount}, 1fr)"
          >
            {#each it.sequences as sequence (sequence.id)}
              {@const seqVariations = getVariationsForSequence(sequence)}
              <ChoreoCardThumbnail
                {sequence}
                variations={seqVariations}
                onPrimaryAction={(seq) => handleAction("view-detail", seq, seqVariations)}
                onHover={handleHover}
                bluePropType={propSettings.bluePropType}
                redPropType={propSettings.redPropType}
                catDogModeEnabled={isCatDog}
                {lightMode}
                {eager}
                {handPathMode}
                {showBlueMotion}
                {showRedMotion}
                {addWord}
                {addDifficultyLevel}
                {selectedIds}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .sectioned-virtual {
    /* Absolute item positioning; the container reserves total height so the
       shared scroll element (`.panel-content`) can scroll the full range. */
    width: 100%;
  }

  .v-item {
    box-sizing: border-box;
  }

  /* Letter subsections sit slightly indented beneath their level banner. */
  .header-wrap.under-level,
  .sequences-grid.under-level {
    padding-left: var(--spacing-sm, 8px);
  }

  .level-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 14px) 0 var(--spacing-xs, 4px);
  }
  .level-banner-title {
    font-size: var(--font-size-lg, 20px);
    font-weight: 800;
    color: var(--theme-text, #fff);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .level-banner-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 10px;
    border-radius: 12px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .level-banner-divider {
    flex: 1;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--theme-stroke, rgba(255, 255, 255, 0.12)) 0%,
      transparent 100%
    );
    min-width: 40px;
  }

  .header-wrap {
    padding-bottom: 2px;
  }

  .sequences-grid.grid-view {
    display: grid;
    gap: var(--spacing-sm, 8px);
    align-items: start;
    padding-bottom: var(--spacing-sm, 8px);
  }
  .sequences-grid.grid-view.is-transitioning {
    transition: gap 200ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .sequences-grid.grid-view.is-transitioning {
      transition: none !important;
    }
  }
</style>
