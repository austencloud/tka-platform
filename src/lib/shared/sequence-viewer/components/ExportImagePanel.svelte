<!--
  ExportImagePanel.svelte

  Image export settings panel.
  Desktop: side panel next to choreo card preview (all settings visible).
  Mobile: compact bottom bar with [Download Card] [Settings gear].
    Settings open in a slide-up overlay. Choreo card gets full screen space.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import type { ExportOptionsStateManager } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import RailBentoSheet from "$lib/shared/animation-panel/bento/RailBentoSheet.svelte";
  import "$lib/shared/animation-panel/bento/rail-tile.css";
  import { nextColumnValue, prevColumnValue, columnOptionsFor } from "./bento/columns-stepper";

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    isExporting: boolean;
    layout?: PanelLayout;
    stepCount: number;
    onExport: () => void;
    onClose?: () => void;
  }

  let {
    exportOptions,
    isExporting,
    layout = "bottom",
    stepCount,
    onExport,
    onClose,
  }: Props = $props();

  // Include chips read/write the global visibility settings so the Visibility tab,
  // the side-by-side preview, and the download view all stay in sync.
  const imageComposition = getImageCompositionManager();
  let compositionVersion = $state(0);
  function onCompositionChanged(): void { compositionVersion++; }
  imageComposition.registerObserver(onCompositionChanged);
  onDestroy(() => imageComposition.unregisterObserver(onCompositionChanged));

  const showWord = $derived.by(() => { void compositionVersion; return imageComposition.addWord; });
  const showDifficulty = $derived.by(() => { void compositionVersion; return imageComposition.addDifficultyLevel; });
  const showCreatorName = $derived.by(() => { void compositionVersion; return imageComposition.showCreatorName; });
  const showNotes = $derived.by(() => { void compositionVersion; return imageComposition.showNotes; });
  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });
  const showMandala = $derived.by(() => { void compositionVersion; return imageComposition.showMandala; });
  const showLoopGlyph = $derived.by(() => { void compositionVersion; return imageComposition.showLoopGlyph; });
  const showBirthday = $derived.by(() => { void compositionVersion; return imageComposition.showBirthday; });
  const startPosLayout = $derived.by(() => {
    void compositionVersion;
    return imageComposition.getStartPositionLayoutForStepCount(stepCount);
  });

  // Pictograph visibility - sourced from VisibilityManager so this panel
  // stays in sync with the Visibility tab, context menus, and voice control.
  const vm = getVisibilityStateManager();
  let vmVersion = $state(0);
  function onVmChanged(): void { vmVersion++; }
  vm.registerObserver(onVmChanged, ["all"]);
  onDestroy(() => vm.unregisterObserver(onVmChanged));

  const showGrid = $derived.by(() => { void vmVersion; return vm.getGridVisibility(); });
  const tkaGlyph = $derived.by(() => { void vmVersion; return vm.getRawGlyphVisibility("tkaGlyph"); });
  const tndGlyph = $derived.by(() => { void vmVersion; return vm.getRawGlyphVisibility("tndGlyph"); });
  const positionsGlyph = $derived.by(() => { void vmVersion; return vm.getRawGlyphVisibility("positionsGlyph"); });
  const nonRadial = $derived.by(() => { void vmVersion; return vm.getNonRadialVisibility(); });

  // Master toggles: clicking a section label flips all its children.
  // If any child is on, master is "on" and a click turns everything off;
  // if all are off, a click turns everything on.
  const headerAnyOn = $derived(showWord || showDifficulty || showLoopGlyph);
  const footerAnyOn = $derived(showCreatorName || showNotes || showBirthday);
  const pictographAnyOn = $derived(
    showGrid || tkaGlyph || tndGlyph || positionsGlyph || nonRadial
  );

  function toggleHeader(): void {
    const target = !headerAnyOn;
    imageComposition.setAddWord(target);
    imageComposition.setAddDifficultyLevel(target);
    imageComposition.setShowLoopGlyph(target);
  }

  function toggleFooter(): void {
    const target = !footerAnyOn;
    imageComposition.setShowCreatorName(target);
    imageComposition.setShowNotes(target);
    imageComposition.setShowBirthday(target);
  }

  function togglePictograph(): void {
    const target = !pictographAnyOn;
    vm.setGridVisibility(target);
    vm.setGlyphVisibility("tkaGlyph", target);
    vm.setGlyphVisibility("tndGlyph", target);
    vm.setGlyphVisibility("elementalGlyph", target);
    vm.setGlyphVisibility("positionsGlyph", target);
    vm.setNonRadialVisibility(target);
  }

  // TnD and elemental glyphs move together (matching VisibilityTab behavior).
  function toggleTnD(): void {
    const next = !tndGlyph;
    vm.setGlyphVisibility("tndGlyph", next);
    vm.setGlyphVisibility("elementalGlyph", next);
  }

  // Columns options share one source with the mobile stepper (columnOptionsFor):
  // numeric counts capped at the beat count, with awkward layouts hidden.
  const columnOptions = $derived<{ label: string; value: number | null }[]>([
    { label: "Auto", value: null },
    ...columnOptionsFor(stepCount).map((v) => ({ label: String(v), value: v })),
  ]);

  // The rendered layout reads the per-step column override from the composition
  // manager (ChoreoCard + choreo-card-layout-state). That is the authoritative
  // store for what the user sees, so the control reflects and writes it.
  // null = Auto = calculated layout.
  const currentColumnCount = $derived.by<number | null>(() => {
    void compositionVersion;
    return imageComposition.getColumnCountForStepCount(stepCount);
  });

  // Write both stores: composition drives the live preview and persists the
  // per-length choice; export-options feeds the PNG export pipeline. Syncing
  // them keeps the preview and the downloaded card from disagreeing.
  function setColumns(value: number | null): void {
    imageComposition.setColumnCountForStepCount(stepCount, value);
    exportOptions.setImageColumnCount(value);
  }

  // If the current selection exceeds the beat count (e.g. user switched
  // to a shorter sequence), reset to Auto.
  $effect(() => {
    if (currentColumnCount !== null && currentColumnCount > stepCount) {
      setColumns(null);
    }
  });

  // ── Mobile bento state ───────────────────────────────────────────────
  let openSheet = $state<"content" | null>(null);
  function toggleContentSheet(): void {
    openSheet = openSheet === "content" ? null : "content";
  }
  function closeSheet(): void {
    openSheet = null;
  }

  // Count of all visibility toggles currently ON, for the Content tile badge.
  const contentOnCount = $derived.by(() => {
    void compositionVersion;
    void vmVersion;
    let n = 0;
    if (showWord) n++;
    if (showDifficulty) n++;
    if (showLoopGlyph) n++;
    if (showCreatorName) n++;
    if (showNotes) n++;
    if (showBirthday) n++;
    if (showGrid) n++;
    if (tkaGlyph) n++;
    if (tndGlyph) n++;
    if (positionsGlyph) n++;
    if (nonRadial) n++;
    if (showQRCode) n++;
    if (showMandala) n++;
    return n;
  });
  const CONTENT_TOTAL = 13;

  const columnsLabel = $derived(
    currentColumnCount === null ? "Auto" : String(currentColumnCount)
  );
</script>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: Bento grid. Card preview stays visible.
       Content opens a fixed-position sub-sheet with all visibility
       toggles. Columns + Theme use inline controls.
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Card export"
  >
    {#if openSheet === "content"}
      <RailBentoSheet title="Content" onClose={closeSheet}>
        <div class="rt-section">
          <span class="rt-section-label">Header</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showWord}
              onclick={() => imageComposition.setAddWord(!showWord)}
            >Word</button>
            <button type="button" class="rt-chip"
              aria-pressed={showDifficulty}
              onclick={() => imageComposition.setAddDifficultyLevel(!showDifficulty)}
            >Level</button>
            <button type="button" class="rt-chip"
              aria-pressed={showLoopGlyph}
              onclick={() => imageComposition.setShowLoopGlyph(!showLoopGlyph)}
            >LOOP</button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Footer</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showCreatorName}
              onclick={() => imageComposition.setShowCreatorName(!showCreatorName)}
            >Name</button>
            <button type="button" class="rt-chip"
              aria-pressed={showNotes}
              onclick={() => imageComposition.setShowNotes(!showNotes)}
            >Notes</button>
            <button type="button" class="rt-chip"
              aria-pressed={showBirthday}
              onclick={() => imageComposition.setShowBirthday(!showBirthday)}
            >Date</button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Pictograph</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showGrid}
              onclick={() => vm.setGridVisibility(!showGrid)}
            >Grid</button>
            <button type="button" class="rt-chip"
              aria-pressed={tkaGlyph}
              onclick={() => vm.setGlyphVisibility("tkaGlyph", !tkaGlyph)}
            >TKA</button>
            <button type="button" class="rt-chip"
              aria-pressed={tndGlyph}
              onclick={toggleTnD}
            >TnD</button>
            <button type="button" class="rt-chip"
              aria-pressed={positionsGlyph}
              onclick={() => vm.setGlyphVisibility("positionsGlyph", !positionsGlyph)}
            >Positions</button>
            <button type="button" class="rt-chip"
              aria-pressed={nonRadial}
              onclick={() => vm.setNonRadialVisibility(!nonRadial)}
            >Non-radial</button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Extras</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={showQRCode}
              onclick={() => imageComposition.setShowQRCode(!showQRCode)}
            >
              <i class="fas fa-qrcode" aria-hidden="true"></i> QR
            </button>
            <button type="button" class="rt-chip"
              aria-pressed={showMandala}
              onclick={() => imageComposition.setShowMandala(!showMandala)}
            >
              <i class="fas fa-asterisk" aria-hidden="true"></i> Mandala
            </button>
          </div>
        </div>

        <div class="rt-section">
          <span class="rt-section-label">Info</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={startPosLayout === "row"}
              onclick={() => imageComposition.setStartPositionLayoutForStepCount(stepCount, "row")}
            >Top Row</button>
            <button type="button" class="rt-chip"
              aria-pressed={startPosLayout === "column"}
              onclick={() => imageComposition.setStartPositionLayoutForStepCount(stepCount, "column")}
            >Left Column</button>
          </div>
        </div>
      </RailBentoSheet>
    {/if}

    <div class="rt-zone" role="group" aria-label="Card export settings">
      <div class="rt-row-3">
        <!-- Content tile - opens sub-sheet -->
        <button
          type="button"
          class="rt-tile"
          aria-pressed={openSheet === "content"}
          onclick={toggleContentSheet}
        >
          <i class="fas fa-layer-group rt-icon" aria-hidden="true"></i>
          <span class="rt-lbl">Content</span>
          <span class="rt-count">{contentOnCount}/{CONTENT_TOTAL}</span>
        </button>

        <!-- Columns tile - inline stepper -->
        <div class="rt-tile" role="group" aria-label="Card columns">
          <div class="rt-stepper">
            <button type="button" class="rt-step-btn"
              onclick={() => setColumns(prevColumnValue(currentColumnCount, stepCount))}
              aria-label="Previous column value"
            ><i class="fas fa-minus" aria-hidden="true"></i></button>
            <span class="rt-val">{columnsLabel}</span>
            <button type="button" class="rt-step-btn"
              onclick={() => setColumns(nextColumnValue(currentColumnCount, stepCount))}
              aria-label="Next column value"
            ><i class="fas fa-plus" aria-hidden="true"></i></button>
          </div>
          <span class="rt-lbl">Columns</span>
        </div>

        <!-- Theme tile - inline split-pill -->
        <div class="rt-tile" role="group" aria-label="Card theme" style="padding: 8px;">
          <div class="rt-split">
            <button type="button" class="rt-split-opt"
              aria-pressed={!exportOptions.imageDarkMode}
              onclick={() => exportOptions.setImageDarkMode(false)}
              aria-label="Light theme"
            ><i class="fas fa-sun" aria-hidden="true"></i> Light</button>
            <button type="button" class="rt-split-opt"
              aria-pressed={exportOptions.imageDarkMode}
              onclick={() => exportOptions.setImageDarkMode(true)}
              aria-label="Dark theme"
            ><i class="fas fa-moon" aria-hidden="true"></i> Dark</button>
          </div>
          <span class="rt-lbl">Theme</span>
        </div>
      </div>

      <button
        type="button"
        class="rt-download"
        onclick={onExport}
        disabled={isExporting}
        aria-label="Download card"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Download Card
        {/if}
      </button>
    </div>
  </div>
{:else}
  <!-- ============================================================
       DESKTOP SIDEBAR: All settings visible (unchanged)
       ============================================================ -->
  <div
    class="export-panel"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Card export settings"
  >
    <div class="panel-center-inner">
    {#if onClose}
      <div class="panel-header">
        <span class="panel-title">Export Settings</span>
        <button
          type="button"
          class="close-btn"
          onclick={onClose}
          aria-label="Close export panel"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    {/if}

    <div class="panel-body">
      <!-- Header section -->
      <div class="setting-row">
        <button type="button" class="setting-label section-toggle" class:on={headerAnyOn}
          onclick={toggleHeader} aria-pressed={headerAnyOn}
          aria-label={headerAnyOn ? "Hide all header elements" : "Show all header elements"}
        >Header</button>
        <div class="chip-group">
          <button type="button" class="chip" class:active={showWord}
            onclick={() => imageComposition.setAddWord(!showWord)}
            aria-pressed={showWord}
          >Word</button>
          <button type="button" class="chip" class:active={showDifficulty}
            onclick={() => imageComposition.setAddDifficultyLevel(!showDifficulty)}
            aria-pressed={showDifficulty}
          >Level</button>
          <button type="button" class="chip" class:active={showLoopGlyph}
            onclick={() => imageComposition.setShowLoopGlyph(!showLoopGlyph)}
            aria-pressed={showLoopGlyph}
          >LOOP</button>
        </div>
      </div>

      <!-- Footer section -->
      <div class="setting-row">
        <button type="button" class="setting-label section-toggle" class:on={footerAnyOn}
          onclick={toggleFooter} aria-pressed={footerAnyOn}
          aria-label={footerAnyOn ? "Hide all footer elements" : "Show all footer elements"}
        >Footer</button>
        <div class="chip-group">
          <button type="button" class="chip" class:active={showCreatorName}
            onclick={() => imageComposition.setShowCreatorName(!showCreatorName)}
            aria-pressed={showCreatorName}
          >Name</button>
          <button type="button" class="chip" class:active={showNotes}
            onclick={() => imageComposition.setShowNotes(!showNotes)}
            aria-pressed={showNotes}
          >Notes</button>
          <button type="button" class="chip" class:active={showBirthday}
            onclick={() => imageComposition.setShowBirthday(!showBirthday)}
            aria-pressed={showBirthday}
          >Date</button>
        </div>
      </div>

      <!-- Pictograph section -->
      <div class="setting-row">
        <button type="button" class="setting-label section-toggle" class:on={pictographAnyOn}
          onclick={togglePictograph} aria-pressed={pictographAnyOn}
          aria-label={pictographAnyOn ? "Hide all pictograph elements" : "Show all pictograph elements"}
        >Pictograph</button>
        <div class="chip-group">
          <button type="button" class="chip" class:active={showGrid}
            onclick={() => vm.setGridVisibility(!showGrid)}
            aria-pressed={showGrid}
          >Grid</button>
          <button type="button" class="chip" class:active={tkaGlyph}
            onclick={() => vm.setGlyphVisibility("tkaGlyph", !tkaGlyph)}
            aria-pressed={tkaGlyph}
          >TKA</button>
          <button type="button" class="chip" class:active={tndGlyph}
            onclick={toggleTnD}
            aria-pressed={tndGlyph}
          >TnD</button>
          <button type="button" class="chip" class:active={positionsGlyph}
            onclick={() => vm.setGlyphVisibility("positionsGlyph", !positionsGlyph)}
            aria-pressed={positionsGlyph}
          >Positions</button>
          <button type="button" class="chip" class:active={nonRadial}
            onclick={() => vm.setNonRadialVisibility(!nonRadial)}
            aria-pressed={nonRadial}
          >Non-radial</button>
        </div>
      </div>

      <!-- QR code (standalone - it's a grid cell, not a banner) -->
      <div class="setting-row">
        <span class="setting-label">QR</span>
        <div class="chip-group">
          <button type="button" class="chip" class:active={showQRCode}
            onclick={() => imageComposition.setShowQRCode(!showQRCode)}
            aria-pressed={showQRCode}
          >QR Code</button>
        </div>
      </div>

      <!-- Mandala fill (blue/red path visualization in empty col-0 cells) -->
      <div class="setting-row">
        <span class="setting-label">Mandala</span>
        <div class="chip-group">
          <button type="button" class="chip" class:active={showMandala}
            onclick={() => imageComposition.setShowMandala(!showMandala)}
            aria-pressed={showMandala}
          >Mandala</button>
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Info</span>
        <div class="chip-group">
          <button type="button" class="chip"
            class:active={startPosLayout === "row"}
            onclick={() => imageComposition.setStartPositionLayoutForStepCount(stepCount, "row")}
            aria-pressed={startPosLayout === "row"}
          >Top Row</button>
          <button type="button" class="chip"
            class:active={startPosLayout === "column"}
            onclick={() => imageComposition.setStartPositionLayoutForStepCount(stepCount, "column")}
            aria-pressed={startPosLayout === "column"}
          >Left Column</button>
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Columns</span>
        <div class="chip-group">
          {#each columnOptions as option}
            <button type="button" class="chip"
              class:active={currentColumnCount === option.value}
              onclick={() => setColumns(option.value)}
              aria-pressed={currentColumnCount === option.value}
            >{option.label}</button>
          {/each}
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Theme</span>
        <div class="chip-group">
          <button type="button" class="chip"
            class:active={!exportOptions.imageDarkMode}
            onclick={() => exportOptions.setImageDarkMode(false)}
            aria-pressed={!exportOptions.imageDarkMode}
          >
            <i class="fas fa-sun" aria-hidden="true"></i> Light
          </button>
          <button type="button" class="chip"
            class:active={exportOptions.imageDarkMode}
            onclick={() => exportOptions.setImageDarkMode(true)}
            aria-pressed={exportOptions.imageDarkMode}
          >
            <i class="fas fa-moon" aria-hidden="true"></i> Dark
          </button>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <button
        type="button"
        class="export-btn"
        onclick={onExport}
        disabled={isExporting}
        aria-label="Download Card"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Download Card
        {/if}
      </button>
    </div>
    </div>
  </div>
{/if}

<style>
  /* ============================================================
   * MOBILE BOTTOM BAR
   * ============================================================ */

  .mobile-export {
    position: relative;
    flex-shrink: 0;
    /* Cap total height so choreo card preview keeps breathing room */
    max-height: 45vh;
    overflow-y: auto;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  /* ============================================================
   * DESKTOP SIDEBAR (unchanged)
   * ============================================================ */

  .export-panel {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: flex;
    flex-direction: column;
    z-index: 10;
    flex-shrink: 0;
    height: 100%;
    min-height: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
  }

  /* Vertically center the settings group within the tall panel.
     auto block margins collapse to 0 when content overflows, so it
     still scrolls from the top — no clipping on long content. */
  .panel-center-inner {
    margin: auto 0;
    width: 100%;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 0;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ============================================================
   * SHARED: Settings rows and chips
   * ============================================================ */

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 16px;
    overflow-y: auto;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .setting-label {
    min-width: 72px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  /* A setting-label that doubles as a master toggle for its section.
   * Dim when the section is all-off; accent tint when any child is on. */
  button.setting-label.section-toggle {
    appearance: none;
    background: transparent;
    border: none;
    padding: 4px 0;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  button.setting-label.section-toggle:hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  button.setting-label.section-toggle.on {
    color: var(--theme-accent, #6366f1);
  }

  button.setting-label.section-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .chip-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    min-width: 40px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .chip i {
    font-size: 12px;
  }

  .panel-footer {
    padding: 8px 16px 12px;
    flex-shrink: 0;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ============================================================
   * Reduced motion
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip, .export-btn {
      transition: none !important;
      animation: none !important;
    }

    .chip:active, .export-btn:active {
      transform: none !important;
    }
  }
</style>
