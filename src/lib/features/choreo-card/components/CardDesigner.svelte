<!--
  CardDesigner.svelte - Front/back card preview

  Smart layout: measures the container and the card image's natural
  aspect ratio, then calculates whether vertical or horizontal placement
  gives larger cards. Both cards are rendered at the SAME calculated
  pixel size. No scrolling. No overflow. Always fits.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount, onDestroy } from "svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import CardBack from "./CardBack.svelte";
  import CardDesignerContextMenuHost from "./context-menu/CardDesignerContextMenuHost.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  interface Props {
    sequences: SequenceData[];
    isLoading: boolean;
  }

  let { sequences, isLoading }: Props = $props();
  let currentIndex = $state(0);

  // Length filter
  const STORAGE_KEY = "choreoCard.designerLength";
  let selectedLength = $state(loadPersistedLength());
  let hapticService: IHapticFeedback | undefined;
  let contextMenuHost: CardDesignerContextMenuHost;

  // Visibility state from global managers
  const imageComposition = getImageCompositionManager();
  const visibilityManager = getVisibilityStateManager();

  // Observer-driven reactivity for non-rune state managers
  let visibilityVersion = $state(0);
  let compositionVersion = $state(0);

  function onVisibilityChanged(): void { visibilityVersion++; }
  function onCompositionChanged(): void { compositionVersion++; }

  visibilityManager.registerObserver(onVisibilityChanged, ["all"]);
  imageComposition.registerObserver(onCompositionChanged);

  onDestroy(() => {
    visibilityManager.unregisterObserver(onVisibilityChanged);
    imageComposition.unregisterObserver(onCompositionChanged);
  });

  // Derived visibility props that react to observer changes
  const handPointsVisible = $derived.by(() => { void visibilityVersion; return visibilityManager.getHandPointVisibility() === "all"; });
  const showGrid = $derived.by(() => { void visibilityVersion; return visibilityManager.getGridVisibility(); });
  const showTKA = $derived.by(() => { void visibilityVersion; return visibilityManager.getGlyphVisibility("tkaGlyph"); });
  const showWord = $derived.by(() => { void compositionVersion; return imageComposition.addWord; });
  const includeStartPosition = $derived.by(() => { void compositionVersion; return imageComposition.includeStartPosition; });

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost.openContextMenu(e.clientX, e.clientY);
  }

  function loadPersistedLength(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  const lengthOptions = [
    { value: 0, label: "All", icon: "fa-layer-group" },
    { value: 2, label: "2" },
    { value: 4, label: "4" },
    { value: 6, label: "6" },
    { value: 8, label: "8" },
    { value: 10, label: "10" },
    { value: 12, label: "12" },
    { value: 16, label: "16" },
  ];

  function handleLengthClick(length: number) {
    hapticService?.trigger("selection");
    selectedLength = length;
    currentIndex = 0;
    try {
      localStorage.setItem(STORAGE_KEY, String(length));
    } catch { /* storage full or unavailable */ }
  }

  // Filtered sequences based on selected length (0 = all)
  const filteredSequences = $derived(
    selectedLength === 0
      ? sequences
      : sequences.filter((s) => s.sequenceLength === selectedLength)
  );

  // Container dimensions
  let containerEl: HTMLDivElement | undefined = $state();
  let cW = $state(0);
  let cH = $state(0);

  // Card image natural aspect ratio (width / height)
  let cardAspect = $state(0);

  // Calculated layout: picks vertical or horizontal based on which
  // gives bigger cards. Falls back to a reasonable default when we
  // don't yet know the image aspect ratio (so cards always render).
  const layout = $derived.by(() => {
    if (cW === 0 || cH === 0) return { direction: "column" as const, w: 0, h: 0, ready: false };

    // Use a default 3:1 landscape ratio until the real image loads
    const ar = cardAspect > 0 ? cardAspect : 3;

    const gap = 28;
    const labelH = 18;

    // Option A: vertical stack (top/bottom)
    const vAvailH = (cH - gap - labelH * 2) / 2;
    const vAvailW = cW;
    const vCardH = Math.min(vAvailH, vAvailW / ar);
    const vCardW = vCardH * ar;

    // Option B: horizontal (side by side)
    const hAvailW = (cW - gap) / 2;
    const hAvailH = cH - labelH;
    const hCardW = Math.min(hAvailW, hAvailH * ar);
    const hCardH = hCardW / ar;

    // Pick whichever gives a bigger card (by area)
    if (hCardW * hCardH > vCardW * vCardH) {
      return { direction: "row" as const, w: Math.floor(hCardW), h: Math.floor(hCardH), ready: cardAspect > 0 };
    }
    return { direction: "column" as const, w: Math.floor(vCardW), h: Math.floor(vCardH), ready: cardAspect > 0 };
  });

  const seq = $derived(filteredSequences.length > 0 ? filteredSequences[currentIndex] : null);
  const label = $derived(seq?.name || seq?.word || "");
  const counter = $derived(
    filteredSequences.length > 0 ? `${currentIndex + 1} / ${filteredSequences.length}` : ""
  );

  function prev() { if (currentIndex > 0) currentIndex--; }
  function next() { if (currentIndex < filteredSequences.length - 1) currentIndex++; }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  }

  $effect(() => {
    if (currentIndex >= filteredSequences.length)
      currentIndex = Math.max(0, filteredSequences.length - 1);
  });

  // Observe container size
  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) { cW = r.width; cH = r.height; }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // Export current card as PNG
  let isExporting = $state(false);

  async function handleExport() {
    if (!seq || isExporting) return;
    isExporting = true;
    hapticService?.trigger("selection");

    try {
      const renderer = container.items.sequenceRenderer;
      const blob = await renderer.renderSequenceToBlob(seq, {
        stepSize: 300,
        format: "PNG" as const,
        quality: 1.0,
        includeStartPosition: true,
        addStepNumbers: true,
        addWord: true,
        addDifficultyLevel: false,
        addUserInfo: false,
        addReversalSymbols: true,
        visibilityOverrides: {
          darkMode: false,
          printMode: true,
          showGrid: true,
          showTKA: true,
        },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${seq.word || seq.name || "choreo-card"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      hapticService?.trigger("success");
    } catch (error) {
      console.error("[CardDesigner] Export failed:", error);
      hapticService?.trigger("error");
    } finally {
      isExporting = false;
    }
  }

  // Observe the front card image to get its natural aspect ratio.
  // We poll briefly because the image loads async via PropAwareThumbnail.
  function watchForImage(node: HTMLElement) {
    let attempts = 0;
    const check = () => {
      const img = node.querySelector("img") as HTMLImageElement | null;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        cardAspect = img.naturalWidth / img.naturalHeight;
        return;
      }
      if (attempts++ < 50) requestAnimationFrame(check);
    };
    check();

    // Also listen for future image swaps (when navigating cards)
    const mo = new MutationObserver(() => {
      attempts = 0;
      check();
    });
    mo.observe(node, { childList: true, subtree: true });

    return { destroy() { mo.disconnect(); } };
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="designer" onkeydown={onKey} tabindex="0" role="application" aria-label="Card designer">
  {#if isLoading}
    <div class="empty">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Loading...</span>
    </div>
  {:else if !seq}
    <div class="empty">
      <i class="fas fa-id-card" aria-hidden="true"></i>
      <span>No sequences</span>
    </div>
  {:else}
    <!-- Nav: compact cluster, centered -->
    <nav class="nav">
      <span class="nav-name" title={label}>{label}</span>
      <div class="nav-controls">
        <button class="nav-btn" onclick={prev} disabled={currentIndex === 0} type="button" aria-label="Previous card">
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="nav-counter">{counter}</span>
        <button class="nav-btn" onclick={next} disabled={currentIndex >= filteredSequences.length - 1} type="button" aria-label="Next card">
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
        <button
          class="nav-btn export-btn"
          onclick={handleExport}
          disabled={isExporting}
          type="button"
          aria-label="Export current card as PNG"
        >
          {#if isExporting}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-download" aria-hidden="true"></i>
          {/if}
        </button>
      </div>
    </nav>

    <!-- Length filter chips -->
    <div class="filter-chips" role="toolbar" aria-label="Filter by step length">
      {#each lengthOptions as option (option.value)}
        <button
          class="chip"
          class:selected={selectedLength === option.value}
          class:all={option.value === 0}
          onclick={() => handleLengthClick(option.value)}
          aria-pressed={selectedLength === option.value}
          type="button"
        >
          {#if option.icon}
            <i class="fas {option.icon}" aria-hidden="true"></i>
          {/if}
          <span>{option.label}</span>
        </button>
      {/each}
    </div>

    <!-- Card pair container: measured, no overflow -->
    <div class="pair-container" bind:this={containerEl}>
      <div class="pair" style="flex-direction: {layout.direction};">
        <div class="card-slot">
          <span class="side-label">Front</span>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="card-frame"
            style="width: {layout.w}px; height: {layout.h}px;"
            use:watchForImage
            oncontextmenu={handleContextMenu}
          >
            <ChoreoCard
              sequence={seq}
              printMode={true}
              showQRCodes={true}
              {handPointsVisible}
              {showGrid}
              {showTKA}
              {showWord}
              {includeStartPosition}
            />
          </div>
        </div>

        <div class="card-slot">
          <span class="side-label">Back</span>
          <div class="card-frame" style="width: {layout.w}px; height: {layout.h}px;">
            <CardBack sequence={seq} />
          </div>
        </div>
      </div>
    </div>
  {/if}

  <CardDesignerContextMenuHost bind:this={contextMenuHost} />
</div>

<style>
  .designer {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-sm, 8px);
    overflow: hidden;
    outline: none;
  }

  /* Nav: compact centered cluster */
  .nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    margin-bottom: var(--spacing-xs, 4px);
    gap: 2px;
  }

  .nav-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: var(--border-radius-sm, 6px);
    background: transparent;
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .nav-btn:disabled { opacity: 0.25; cursor: default; }

  .nav-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .nav-counter {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    min-width: 60px;
    text-align: center;
  }

  .export-btn {
    margin-left: var(--spacing-xs, 4px);
    color: var(--theme-accent, #6366f1);
  }

  /* Filter chips: single centered row */
  .filter-chips {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
    flex-shrink: 0;
    margin-bottom: var(--spacing-xs, 4px);
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    padding: 0 var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .chip.all {
    min-width: 64px;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip.selected {
    background: var(--theme-accent, #f43f5e);
    border-color: var(--theme-accent, #f43f5e);
    color: #ffffff;
  }

  .chip i {
    font-size: 0.7rem;
  }

  /* Pair container: takes all remaining space, no overflow */
  .pair-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pair {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .card-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .side-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  /* Both cards: explicit pixel dimensions from JS, identical */
  .card-frame {
    overflow: hidden;
    border-radius: 2px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  /* The ChoreoCard inside fills the frame exactly */
  .card-frame :global(.choreo-card) {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 0;
  }

  .card-frame :global(.prop-thumbnail),
  .card-frame :global(.prop-thumbnail img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Empty state */
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }

  .empty i { font-size: 1.5rem; opacity: 0.4; }

  @media (prefers-reduced-motion: reduce) {
    .empty i { animation: none; }
    .chip { transition: none; }
  }
</style>
