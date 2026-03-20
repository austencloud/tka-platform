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
  import type { BackgroundType } from "@austencloud/backgrounds";
  import { container } from "$lib/shared/di";
  import { onMount, onDestroy } from "svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import CardBackV5 from "./card-back/CardBackV5.svelte";
  import InfoCardFront from "./card-back/InfoCardFront.svelte";
  import InfoCardBack from "./card-back/InfoCardBack.svelte";
  import CardDesignerContextMenuHost from "./context-menu/CardDesignerContextMenuHost.svelte";
  import CardSettingsModal from "./CardSettingsModal.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";

  interface Props {
    sequences: SequenceData[];
    isLoading: boolean;
  }

  let { sequences, isLoading }: Props = $props();
  let currentIndex = $state(0);

  // Length filter
  const STORAGE_KEY = "choreoCard.designerLength";
  let selectedLength = $state(loadPersistedLength());

  // Card back variant (only Deck for now)
  type BackVariant = "deck";
  let backVariant = $state<BackVariant>("deck");

  // Display scale: 1.0 = fill container, smaller = preview at physical size
  let displayScale = $state(1.0);

  // Show the info/rules card instead of the current sequence
  const STORAGE_KEY_INFO_CARD = "choreoCard.designerShowInfoCard";
  let showInfoCard = $state(
    typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY_INFO_CARD) === "true"
  );
  let hapticService: IHapticFeedback | undefined;
  let contextMenuHost: CardDesignerContextMenuHost;
  let choreoCardRef: ChoreoCard | undefined = $state();
  let cardSettingsOpen = $state(false);

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
  const startPositionLayout = $derived.by(() => { void compositionVersion; return imageComposition.startPositionLayout; });
  const showBirthday = $derived.by(() => { void compositionVersion; return imageComposition.showBirthday; });
  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });

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

  // Theme switcher: updates global background setting
  const currentTheme = $derived(settingsService.settings.backgroundType);

  function handleThemeClick(type: BackgroundType) {
    hapticService?.trigger("selection");
    settingsService.updateSetting("backgroundType", type);
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

  // Playing card proportions: 2.5" × 3.5" = 5:7
  const CARD_PORTRAIT = 5 / 7;  // width / height (tall)
  const CARD_LANDSCAPE = 7 / 5; // width / height (wide)

  // The front card is landscape when the sequence image is meaningfully wider
  // than tall (aspect > 1.3). Near-square images (like 16-beat grids) fit
  // better in portrait. Default to landscape for the initial render.
  const frontIsLandscape = $derived(cardAspect > 0 ? cardAspect > 1.3 : true);
  const frontAR = $derived(frontIsLandscape ? CARD_LANDSCAPE : CARD_PORTRAIT);
  // The back card is always portrait
  const backAR = CARD_PORTRAIT;

  // Calculate card sizes to fit both cards side by side in the container.
  // Front and back may have different aspect ratios (landscape front, portrait back).
  const layout = $derived.by(() => {
    if (cW === 0 || cH === 0) return { frontW: 0, frontH: 0, backW: 0, backH: 0 };

    const gap = 24;
    const labelH = 20;
    const availH = cH - labelH;

    // Side by side: we need frontW + gap + backW <= cW
    // Both cards share the same available height.
    // Scale so the taller card fills availH, then check if both fit in cW.
    // If not, scale down proportionally.

    // Start with both cards at max height
    let fH = availH;
    let fW = fH * frontAR;
    let bH = availH;
    let bW = bH * backAR;

    const totalW = fW + gap + bW;
    if (totalW > cW) {
      // Scale both down proportionally to fit width
      const scale = cW / totalW;
      fW *= scale;
      fH *= scale;
      bW *= scale;
      bH *= scale;
    }

    return {
      frontW: Math.floor(fW * displayScale),
      frontH: Math.floor(fH * displayScale),
      backW: Math.floor(bW * displayScale),
      backH: Math.floor(bH * displayScale),
    };
  });

  // The card back renders at a fixed "print" resolution so it behaves
  // like an image: zooming the page scales it uniformly instead of
  // reflowing text. We render at 500×700 (5:7) and transform: scale()
  // to fit the display frame.
  const BACK_RENDER_W = 500;
  const BACK_RENDER_H = 700;
  const backScale = $derived(
    layout.backW > 0 ? layout.backW / BACK_RENDER_W : 1
  );

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
        includeStartPosition,
        addStepNumbers: true,
        addWord: showWord,
        addDifficultyLevel: false,
        addUserInfo: false,
        addReversalSymbols: true,
        visibilityOverrides: {
          darkMode: false,
          printMode: true,
          showGrid,
          showTKA,
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
  {:else if sequences.length === 0}
    <div class="empty">
      <i class="fas fa-id-card" aria-hidden="true"></i>
      <span>No sequences</span>
    </div>
  {:else}
    <!-- Nav: only shown when there's a card to display -->
    {#if seq}
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
    {/if}

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

    <!-- Theme switcher: icon chips for each background theme -->
    <div class="filter-chips" role="toolbar" aria-label="Card back theme">
      {#each ANIMATED_BACKGROUNDS as bg (bg.type)}
        <button
          class="chip theme-chip"
          class:selected={currentTheme === bg.type}
          onclick={() => handleThemeClick(bg.type)}
          aria-pressed={currentTheme === bg.type}
          aria-label={bg.label}
          title={bg.label}
          type="button"
        >
          <i class="fas {bg.icon}" aria-hidden="true"></i>
        </button>
      {/each}
    </div>

    <!-- Info card toggle -->
    <div class="filter-chips">
      <button
        class="chip"
        class:selected={showInfoCard}
        onclick={() => { showInfoCard = !showInfoCard; try { localStorage.setItem(STORAGE_KEY_INFO_CARD, String(showInfoCard)); } catch {} hapticService?.trigger("selection"); }}
        aria-pressed={showInfoCard}
        type="button"
      >
        <i class="fas fa-info-circle" aria-hidden="true"></i>
        <span>Rules Card</span>
      </button>
    </div>

    <!-- Size slider -->
    <div class="size-control">
      <i class="fas fa-search-minus" aria-hidden="true"></i>
      <input
        type="range"
        min="0.2"
        max="1"
        step="0.05"
        bind:value={displayScale}
        aria-label="Card display size"
      />
      <i class="fas fa-search-plus" aria-hidden="true"></i>
      <span class="size-label">{Math.round(displayScale * 100)}%</span>
    </div>

    {#if seq}
      <!-- Card pair container: measured, no overflow -->
      <div class="pair-container" bind:this={containerEl}>
        <div class="pair">
          {#if showInfoCard}
            <!-- Info/rules card: front -->
            <div class="card-slot">
              <span class="side-label">Front</span>
              <div
                class="playing-card back-card-frame"
                style="width: {layout.backW}px; height: {layout.backH}px;"
              >
                <div
                  class="back-card-render"
                  style="width: {BACK_RENDER_W}px; height: {BACK_RENDER_H}px; transform: scale({backScale}); transform-origin: top left;"
                >
                  <InfoCardFront />
                </div>
              </div>
            </div>

            <!-- Info/rules card: back -->
            <div class="card-slot">
              <span class="side-label">Back</span>
              <div
                class="playing-card back-card-frame"
                style="width: {layout.backW}px; height: {layout.backH}px;"
              >
                <div
                  class="back-card-render"
                  style="width: {BACK_RENDER_W}px; height: {BACK_RENDER_H}px; transform: scale({backScale}); transform-origin: top left;"
                >
                  <InfoCardBack />
                </div>
              </div>
            </div>
          {:else}
            <!-- Front: playing card frame with sequence image inside -->
            <div class="card-slot">
              <span class="side-label">Front</span>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="playing-card"
                style="width: {layout.frontW}px; height: {layout.frontH}px;"
                use:watchForImage
                oncontextmenu={handleContextMenu}
              >
                <div class="card-image-container">
                  <ChoreoCard
                    bind:this={choreoCardRef}
                    sequence={seq}
                    printMode={true}
                    showQRCodes={showQRCode}
                    {showBirthday}
                    {handPointsVisible}
                    {showGrid}
                    {showTKA}
                    {showWord}
                    {includeStartPosition}
                    {startPositionLayout}
                  />
                </div>
              </div>
            </div>

            <!-- Back: rendered at fixed print resolution, scaled to fit -->
            <div class="card-slot">
              <span class="side-label">Back</span>
              <div
                class="playing-card back-card-frame"
                style="width: {layout.backW}px; height: {layout.backH}px;"
              >
                <div
                  class="back-card-render"
                  style="width: {BACK_RENDER_W}px; height: {BACK_RENDER_H}px; transform: scale({backScale}); transform-origin: top left;"
                >
                  <CardBackV5 sequence={seq} />
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="empty">
        <i class="fas fa-filter" aria-hidden="true"></i>
        <span>No {selectedLength}-beat sequences</span>
      </div>
    {/if}
  {/if}

  <CardDesignerContextMenuHost
    bind:this={contextMenuHost}
    onOpenSettings={() => { cardSettingsOpen = true; }}
    onRerender={() => choreoCardRef?.rerender()}
  />
  <CardSettingsModal bind:open={cardSettingsOpen} />
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

  /* Theme chips: icon-only, square touch targets */
  .theme-chip {
    min-width: var(--min-touch-target, 48px);
    padding: 0;
  }

  .theme-chip i {
    font-size: 0.85rem;
  }

  /* Size slider with proper touch targets */
  .size-control {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    flex-shrink: 0;
    margin-bottom: var(--spacing-xs, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  .size-control input[type="range"] {
    width: 160px;
    height: var(--min-touch-target, 48px);
    accent-color: var(--theme-accent, #6366f1);
    cursor: pointer;
  }

  .size-control i {
    font-size: 14px;
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .size-label {
    min-width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm, 14px);
  }

  .pair {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
  }

  .card-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .side-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  /* Playing card frame: rounded corners, shadow, like a real card */
  .playing-card {
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, #18181b);
  }

  /* The sequence image fills the front card frame, contained */
  .card-image-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ChoreoCard fills the frame; inner img uses object-fit: contain */
  .card-image-container :global(.choreo-card) {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 0;
  }

  .card-image-container :global(.prop-thumbnail) {
    width: 100%;
    height: 100%;
  }

  .card-image-container :global(.prop-thumbnail img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Back card: rendered at fixed print resolution, scaled to display size */
  .back-card-frame {
    overflow: hidden;
  }

  .back-card-render {
    transform-origin: top left;
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
