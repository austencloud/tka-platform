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
  import "$lib/shared/animation-panel/bento/rail-tile.css";
  import { columnOptionsFor } from "./bento/columns-stepper";
  import ControlDock, { type ControlDockTab } from "./ControlDock.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { getInfoCellCount, type InfoCellChoice } from "../services/info-cell-display";

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
  const showStartPos = $derived.by(() => { void compositionVersion; return imageComposition.includeStartPosition; });
  const startPosLayout = $derived.by(() => {
    void compositionVersion;
    return imageComposition.getStartPositionLayoutForStepCount(stepCount);
  });

  // One-spot cards (a single empty info cell) route QR vs Mandala through one
  // explicit chooser; multi-cell cards keep the two independent chips.
  const infoCellCount = $derived.by(() => {
    void compositionVersion;
    return getInfoCellCount({
      stepCount,
      includeStartPosition: imageComposition.includeStartPosition,
      startPositionLayout: startPosLayout,
      columnCount: imageComposition.getColumnCountForStepCount(stepCount),
    });
  });
  const isOneSpot = $derived(infoCellCount === 1);
  // Zero info cells (start position hidden, or a 1-count) means a QR/mandala has
  // nowhere to render — hide the controls entirely rather than offer dead toggles.
  const hasInfoCell = $derived(infoCellCount >= 1);

  // Guests cannot render a scannable QR — drop the QR segment for them so the
  // lone cell can never resolve to a blank QR.
  // Text labels (not icons): they read at the same size as the sibling chips in
  // this panel (Word / Level / Grid …) and a tiny QR/asterisk glyph is cryptic.
  // QR is always offered (matches the original always-visible QR toggle); a guest
  // who picks it gets the mandala at render time via resolveInfoCellDisplay's
  // guest degrade, so the cell never blanks.
  const infoCellOptions: { value: InfoCellChoice; label: string }[] = [
    { value: "qr", label: "QR" },
    { value: "mandala", label: "Mandala" },
    { value: "none", label: "None" },
  ];

  const infoCellChoice = $derived.by<InfoCellChoice>(() => {
    void compositionVersion;
    return imageComposition.getInfoCellChoiceForStepCount(stepCount);
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

  // TnD and elemental glyphs move together.
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

  // ── Mobile ControlDock state ─────────────────────────────────────────
  const DISPLAY_TABS: ControlDockTab[] = [
    { id: "labels", label: "Labels", icon: "fa-font" },
    { id: "pictograph", label: "Pictograph", icon: "fa-shapes" },
    { id: "columns", label: "Columns", icon: "fa-table-columns" },
    { id: "theme", label: "Theme", icon: "fa-circle-half-stroke" },
  ];
  let activeTab = $state<string | null>(null);

  // Touch devices share; desktop downloads. Icon/label reflect the intent;
  // the consumer's onExport branches (navigator.share with the PNG vs download).
  let coarsePointer = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    coarsePointer = mq.matches;
    const h = () => (coarsePointer = mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  });
  const dockTrailing = $derived({
    icon: coarsePointer ? "fa-share-nodes" : "fa-download",
    label: coarsePointer ? "Share card" : "Download card",
    onClick: onExport,
    busy: isExporting,
  });
</script>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: ControlDock. Card preview stays the hero. Display
       controls collapse into Content / Columns / Theme tabs with a
       compact Share/Download trailing trigger.
       ============================================================ -->
  <ControlDock
    tabs={DISPLAY_TABS}
    activeTab={activeTab}
    onTabSelect={(id) => (activeTab = activeTab === id ? null : id)}
    trailingAction={dockTrailing}
  >
    {#snippet tray()}
      <div class="dock-dense">
        {#if activeTab === "labels"}
          <div class="field">
            <span class="field-label">Header</span>
            <div class="rt-chip-row">
              <button type="button" class="rt-chip" aria-pressed={showWord} onclick={() => imageComposition.setAddWord(!showWord)}>Word</button>
              <button type="button" class="rt-chip" aria-pressed={showDifficulty} onclick={() => imageComposition.setAddDifficultyLevel(!showDifficulty)}>Level</button>
              <button type="button" class="rt-chip" aria-pressed={showLoopGlyph} onclick={() => imageComposition.setShowLoopGlyph(!showLoopGlyph)}>LOOP</button>
            </div>
          </div>
          <div class="field">
            <span class="field-label">Footer</span>
            <div class="rt-chip-row">
              <button type="button" class="rt-chip" aria-pressed={showCreatorName} onclick={() => imageComposition.setShowCreatorName(!showCreatorName)}>Name</button>
              <button type="button" class="rt-chip" aria-pressed={showNotes} onclick={() => imageComposition.setShowNotes(!showNotes)}>Notes</button>
              <button type="button" class="rt-chip" aria-pressed={showBirthday} onclick={() => imageComposition.setShowBirthday(!showBirthday)}>Date</button>
            </div>
          </div>
        {:else if activeTab === "pictograph"}
          <div class="field">
            <span class="field-label">Glyphs</span>
            <div class="rt-chip-row">
              <button type="button" class="rt-chip" aria-pressed={showGrid} onclick={() => vm.setGridVisibility(!showGrid)}>Grid</button>
              <button type="button" class="rt-chip" aria-pressed={tkaGlyph} onclick={() => vm.setGlyphVisibility("tkaGlyph", !tkaGlyph)}>TKA</button>
              <button type="button" class="rt-chip" aria-pressed={tndGlyph} onclick={toggleTnD}>TnD</button>
              <button type="button" class="rt-chip" aria-pressed={positionsGlyph} onclick={() => vm.setGlyphVisibility("positionsGlyph", !positionsGlyph)}>Positions</button>
              <button type="button" class="rt-chip" aria-pressed={nonRadial} onclick={() => vm.setNonRadialVisibility(!nonRadial)}>Non-radial</button>
            </div>
          </div>
          <div class="field">
            <span class="field-label">Info</span>
            <div class="rt-chip-row">
              {#if hasInfoCell}
                {#if isOneSpot}
                  <div class="seg-fill">
                    <SegmentedControl
                      options={infoCellOptions}
                      value={infoCellChoice}
                      onchange={(v) => imageComposition.setInfoCellChoiceForStepCount(stepCount, v)}
                      color="accent"
                      size="sm"
                    />
                  </div>
                {:else}
                  <button type="button" class="rt-chip" aria-pressed={showQRCode} onclick={() => imageComposition.setShowQRCode(!showQRCode)}><i class="fas fa-qrcode" aria-hidden="true"></i> QR</button>
                  <button type="button" class="rt-chip" aria-pressed={showMandala} onclick={() => imageComposition.setShowMandala(!showMandala)}><i class="fas fa-asterisk" aria-hidden="true"></i> Mandala</button>
                {/if}
              {/if}
              <button type="button" class="rt-chip" aria-pressed={showStartPos} onclick={() => imageComposition.setIncludeStartPosition(!showStartPos)}>Start</button>
              {#if showStartPos}
                <button type="button" class="rt-chip" aria-pressed={startPosLayout === "row"} onclick={() => imageComposition.setStartPositionLayoutForStepCount(stepCount, "row")}>Top Row</button>
                <button type="button" class="rt-chip" aria-pressed={startPosLayout === "column"} onclick={() => imageComposition.setStartPositionLayoutForStepCount(stepCount, "column")}>Left Column</button>
              {/if}
            </div>
          </div>
        {:else if activeTab === "columns"}
          <div class="rt-chip-row">
            {#each columnOptions as option}
              <button type="button" class="rt-chip" aria-pressed={currentColumnCount === option.value} onclick={() => setColumns(option.value)}>{option.label}</button>
            {/each}
          </div>
        {:else if activeTab === "theme"}
          <div class="rt-chip-row">
            <button type="button" class="rt-chip" aria-pressed={!exportOptions.imageDarkMode} onclick={() => exportOptions.setImageDarkMode(false)}><i class="fas fa-sun" aria-hidden="true"></i> Light</button>
            <button type="button" class="rt-chip" aria-pressed={exportOptions.imageDarkMode} onclick={() => exportOptions.setImageDarkMode(true)}><i class="fas fa-moon" aria-hidden="true"></i> Dark</button>
          </div>
        {/if}
      </div>
    {/snippet}
  </ControlDock>
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

      {#if hasInfoCell}
      {#if isOneSpot}
        <!-- One info cell: QR and Mandala compete for it -> single chooser. -->
        <div class="setting-row">
          <span class="setting-label">Info Cell</span>
          <div class="chip-group seg-fill">
            <SegmentedControl
              options={infoCellOptions}
              value={infoCellChoice}
              onchange={(v) => imageComposition.setInfoCellChoiceForStepCount(stepCount, v)}
              color="accent"
              size="sm"
            />
          </div>
        </div>
      {:else}
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
      {/if}
      {/if}

      <div class="setting-row">
        <span class="setting-label">Start</span>
        <div class="chip-group">
          <button type="button" class="chip"
            class:active={showStartPos}
            onclick={() => imageComposition.setIncludeStartPosition(!showStartPos)}
            aria-pressed={showStartPos}
          >Show</button>
          {#if showStartPos}
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
          {/if}
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

  /* Mobile dock tray density (mirrors AnimationPanel .dock-dense). */
  .dock-dense { display: flex; flex-direction: column; gap: 8px; }
  /* Inline label-left rows: each section is one row, not a label line + chips line. */
  .dock-dense .field {
    display: grid;
    grid-template-columns: 58px 1fr;
    align-items: center;
    gap: 10px;
  }
  .dock-dense .field-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .dock-dense :global(.rt-chip-row) { gap: 6px; flex-wrap: wrap; }
  /* Size chips to their label (override rail-tile's flex:1 + min-width:44 that
     squeezed long labels like "Non-radial" until they clipped) and let the row
     wrap. Each chip stays one unbroken line at >=44px tap height. */
  .dock-dense :global(.rt-chip) {
    flex: 0 1 auto;
    min-width: 0;
    min-height: 44px;
    padding: 6px 12px;
    white-space: nowrap;
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

  /* SegmentedControl is width:100%; give it room to fill next to the label. */
  .seg-fill {
    flex: 1 1 auto;
    min-width: 0;
  }
  .dock-dense .seg-fill {
    flex: 1 1 160px;
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
