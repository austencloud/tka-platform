<!--
  CardDesigner.svelte - Split-screen card designer orchestrator

  Owns all localStorage persistence, observer registrations, keyboard
  navigation, and export. Wires three child components together:
  - BrowsePanel/minimal (left panel — sequence picker)
  - CardPreviewStack (right panel)
  - DesignerSettingsSidebar (slide-out settings)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { getSequenceRenderer } from "$lib/shared/render/getSequenceRenderer";
  import { onMount, onDestroy } from "svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import CardPreviewStack from "./designer/CardPreviewStack.svelte";
  import DesignerSettingsSidebar from "./designer/DesignerSettingsSidebar.svelte";
  import CardDesignerContextMenuHost from "./context-menu/CardDesignerContextMenuHost.svelte";

  // No sequences/isLoading props — the picker engine loads its own data.

  // ── localStorage persistence ────────────────────────────────────────

  const STORAGE_KEYS = {
    sequenceId: "choreoCard.designerSequenceId",
    length: "choreoCard.designerLength",
    focusedCard: "choreoCard.designerFocusedCard",
    infoCard: "choreoCard.designerShowInfoCard",
    sidebarOpen: "choreoCard.designerSidebarOpen",
  } as const;

  function loadInt(key: string, def: number): number {
    try { const v = localStorage.getItem(key); return v ? parseInt(v, 10) : def; } catch { return def; }
  }
  function loadBool(key: string, def: boolean): boolean {
    try { const v = localStorage.getItem(key); return v !== null ? v === "true" : def; } catch { return def; }
  }
  function loadString(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function save(key: string, value: string | number | boolean | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch { /* storage full */ }
  }

  // ── Picker engine ───────────────────────────────────────────────────

  const pickerEngine = createBrowseEngine({
    persistKey: null,
    minColumns: 2,
    initialColumns: 3,
  });

  // ── State ───────────────────────────────────────────────────────────

  let selectedLength = $state(loadInt(STORAGE_KEYS.length, 0));
  let currentSequence = $state<SequenceData | null>(null);
  let showInfoCard = $state(loadBool(STORAGE_KEYS.infoCard, false));
  let sidebarOpen = $state(loadBool(STORAGE_KEYS.sidebarOpen, false));
  let isExporting = $state(false);
  let contextMenuHost: CardDesignerContextMenuHost | undefined = $state(undefined);
  let activeRerender: (() => void) | undefined = $state(undefined);

  function handleCardContextMenu(x: number, y: number, rerender: () => void) {
    activeRerender = rerender;
    contextMenuHost?.openContextMenu(x, y);
  }

  // ── Sync selectedLength → engine filter ────────────────────────────

  $effect(() => {
    if (selectedLength > 0) {
      pickerEngine.addFilter(BrowseFilterType.LENGTH, selectedLength, `${selectedLength} beats`, "#f59e0b");
    } else {
      pickerEngine.removeFilter(String(BrowseFilterType.LENGTH));
    }
  });

  // ── Restore selected sequence from localStorage after engine loads ──

  let hasRestored = false;

  $effect(() => {
    // Wait until engine has sequences loaded
    const engineSeqs = pickerEngine.sequences;
    if (hasRestored || engineSeqs.length === 0) return;
    hasRestored = true;

    const restoredId = loadString(STORAGE_KEYS.sequenceId);
    if (!restoredId) {
      // Default to first sequence
      if (engineSeqs[0]) currentSequence = engineSeqs[0];
      return;
    }

    const found = engineSeqs.find(s => s.id === restoredId);
    if (found) {
      currentSequence = found;
    } else {
      // Might be filtered out — clear length filter and retry
      const allSeq = pickerEngine.allSequences.find(s => s.id === restoredId);
      if (allSeq) {
        selectedLength = 0;
        save(STORAGE_KEYS.length, 0);
        currentSequence = allSeq;
      } else {
        save(STORAGE_KEYS.sequenceId, null);
        if (engineSeqs[0]) currentSequence = engineSeqs[0];
      }
    }
  });

  // ── Observer registrations ──────────────────────────────────────────

  const imageComposition = getImageCompositionManager();
  const visibilityManager = getVisibilityStateManager();

  let visibilityVersion = $state(0);
  let compositionVersion = $state(0);

  function onVisibilityChanged(): void { visibilityVersion++; }
  function onCompositionChanged(): void { compositionVersion++; }

  onMount(() => {
    visibilityManager.registerObserver(onVisibilityChanged, ["all"]);
    imageComposition.registerObserver(onCompositionChanged);
  });

  onDestroy(() => {
    visibilityManager.unregisterObserver(onVisibilityChanged);
    imageComposition.unregisterObserver(onCompositionChanged);
    pickerEngine.destroy();
  });

  // Derived visibility props that react to observer changes
  const handPointsVisible = $derived.by(() => { void visibilityVersion; return visibilityManager.getHandPointVisibility() === "all"; });
  const showGrid = $derived.by(() => { void visibilityVersion; return visibilityManager.getGridVisibility(); });
  const showTKA = $derived.by(() => { void visibilityVersion; return visibilityManager.getGlyphVisibility("tkaGlyph"); });
  const showWord = $derived.by(() => { void compositionVersion; return imageComposition.addWord; });
  const includeStartPosition = $derived.by(() => { void compositionVersion; return imageComposition.includeStartPosition; });
  const startPositionLayout = $derived.by(() => {
    void compositionVersion;
    const stepCount = currentSequence?.steps?.length ?? 0;
    if (stepCount > 0) return imageComposition.getStartPositionLayoutForStepCount(stepCount);
    return imageComposition.startPositionLayout;
  });
  const showBirthday = $derived.by(() => { void compositionVersion; return imageComposition.showBirthday; });
  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });

  // ── Event handlers ──────────────────────────────────────────────────

  let hapticService: import("$lib/shared/application/services/haptic-feedback").HapticFeedback | undefined;

  onMount(async () => {
    hapticService = getHapticFeedback();
    await pickerEngine.initialize();
  });

  function handleSelect(seq: SequenceData) {
    currentSequence = seq;
    save(STORAGE_KEYS.sequenceId, seq.id ?? "");
  }

  function handleLengthChange(length: number) {
    selectedLength = length;
    save(STORAGE_KEYS.length, length);
    // Select first sequence in the newly filtered list
    const first = pickerEngine.sequences[0];
    if (first) {
      currentSequence = first;
      save(STORAGE_KEYS.sequenceId, first.id ?? "");
    }
  }

  function handleSidebarToggle() {
    sidebarOpen = !sidebarOpen;
    save(STORAGE_KEYS.sidebarOpen, sidebarOpen);
  }

  function handleInfoCardToggle() {
    showInfoCard = !showInfoCard;
    save(STORAGE_KEYS.infoCard, showInfoCard);
  }

  // ── Keyboard navigation ─────────────────────────────────────────────

  function onKey(e: KeyboardEvent) {
    const seqs = pickerEngine.sequences;
    const currentIdx = currentSequence ? seqs.findIndex(s => s.id === currentSequence!.id) : -1;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : 0;
      const prev = seqs[prevIdx];
      if (prev) { currentSequence = prev; save(STORAGE_KEYS.sequenceId, prev.id ?? ""); }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = currentIdx < seqs.length - 1 ? currentIdx + 1 : seqs.length - 1;
      const next = seqs[nextIdx];
      if (next) { currentSequence = next; save(STORAGE_KEYS.sequenceId, next.id ?? ""); }
    } else if (e.key === "Escape" && sidebarOpen) {
      sidebarOpen = false;
      save(STORAGE_KEYS.sidebarOpen, false);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────

  async function handleExport() {
    const seq = currentSequence;
    if (!seq || isExporting) return;
    isExporting = true;
    hapticService?.trigger("selection");

    try {
      const renderer = getSequenceRenderer();
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
      console.warn("[CardDesigner] Export failed:", error);
      hapticService?.trigger("error");
      toast.error("Export failed. Try again.");
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="designer-split">
  <!-- Left: Sequence picker (BrowsePanel minimal mode) -->
  <div class="picker-panel">
    <!-- Length filter chips above the browse grid -->
    <div class="filter-chips" role="group" aria-label="Filter by step length">
      {#each [0, 2, 4, 6, 8, 10, 12, 16] as len (len)}
        <button
          class="chip"
          class:active={selectedLength === len}
          onclick={() => handleLengthChange(len)}
          aria-pressed={selectedLength === len}
          aria-label={len === 0 ? "Show all lengths" : `Filter by ${len} beats`}
          type="button"
        >
          {len === 0 ? "All" : len}
        </button>
      {/each}
    </div>

    <BrowsePanel
      engine={pickerEngine}
      layout="minimal"
      onSelect={(seq) => handleSelect(seq)}
      eager
    />
  </div>

  <!-- Right: Card preview + settings -->
  <div class="preview-panel">
    <CardPreviewStack
      sequence={currentSequence}
      {handPointsVisible}
      {showGrid}
      {showTKA}
      {showWord}
      {includeStartPosition}
      {startPositionLayout}
      {showBirthday}
      {showQRCode}
      {showInfoCard}
      onCardContextMenu={handleCardContextMenu}
    />

    <button
      class="settings-toggle"
      onclick={handleSidebarToggle}
      title="Settings"
      aria-label="Toggle card settings"
      type="button"
    >
      <i class="fas fa-gear" aria-hidden="true"></i>
    </button>

    <CardDesignerContextMenuHost
      bind:this={contextMenuHost}
      onOpenSettings={handleSidebarToggle}
      onRerender={activeRerender}
    />

    <DesignerSettingsSidebar
      open={sidebarOpen}
      onClose={() => { sidebarOpen = false; save(STORAGE_KEYS.sidebarOpen, false); }}
      onExport={handleExport}
      {isExporting}
      {showInfoCard}
      onInfoCardToggle={handleInfoCardToggle}
    />
  </div>
</div>

<style>
  .designer-split {
    display: flex;
    width: 100%;
    height: 100%;
    gap: 16px;
    overflow: hidden;
  }

  .picker-panel {
    width: 40%;
    min-width: 200px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .preview-panel {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .settings-toggle {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: background 200ms;
  }

  .settings-toggle:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
  }

  /* ── Length filter chips ────────────────────────────── */
  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .chip {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    white-space: nowrap;
    line-height: 1.4;
  }

  .chip:hover:not(.active) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .chip.active {
    background: var(--theme-accent, #4488ff);
    border-color: var(--theme-accent, #4488ff);
    color: #ffffff;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-toggle, .chip { transition: none; }
  }
</style>
