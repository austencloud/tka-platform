<!--
  CardDesigner.svelte - Split-screen card designer orchestrator

  Owns all localStorage persistence, observer registrations, keyboard
  navigation, and export. Wires three child components together:
  - SequencePickerGrid (left panel)
  - CardPreviewStack (right panel)
  - DesignerSettingsSidebar (slide-out settings)
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { container } from "$lib/shared/di";
  import { onMount, onDestroy } from "svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import SequencePickerGrid from "./designer/SequencePickerGrid.svelte";
  import CardPreviewStack from "./designer/CardPreviewStack.svelte";
  import DesignerSettingsSidebar from "./designer/DesignerSettingsSidebar.svelte";

  interface Props {
    sequences: SequenceData[];
    isLoading: boolean;
  }

  let { sequences, isLoading }: Props = $props();

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

  // ── State ───────────────────────────────────────────────────────────

  let selectedLength = $state(loadInt(STORAGE_KEYS.length, 0));
  let selectedIndex = $state(0);
  let focusedCard = $state<"front" | "back" | null>(loadString(STORAGE_KEYS.focusedCard) as "front" | "back" | null ?? null);
  let showInfoCard = $state(loadBool(STORAGE_KEYS.infoCard, false));
  let sidebarOpen = $state(loadBool(STORAGE_KEYS.sidebarOpen, false));
  let isExporting = $state(false);

  // ── Derived state ───────────────────────────────────────────────────

  const filteredSequences = $derived(
    selectedLength === 0 ? sequences : sequences.filter(s => s.sequenceLength === selectedLength)
  );

  const currentSequence = $derived<SequenceData | null>(
    filteredSequences.length > 0 && selectedIndex < filteredSequences.length
      ? filteredSequences[selectedIndex] ?? null
      : null
  );

  // Bounds check: clamp selectedIndex when the filtered list shrinks
  $effect(() => {
    if (selectedIndex >= filteredSequences.length)
      selectedIndex = Math.max(0, filteredSequences.length - 1);
  });

  // ── Observer registrations ──────────────────────────────────────────

  const imageComposition = getImageCompositionManager();
  const visibilityManager = getVisibilityStateManager();

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
  const startPositionLayout = $derived.by(() => {
    void compositionVersion;
    const stepCount = currentSequence?.steps?.length ?? 0;
    if (stepCount > 0) return imageComposition.getStartPositionLayoutForStepCount(stepCount);
    return imageComposition.startPositionLayout;
  });
  const showBirthday = $derived.by(() => { void compositionVersion; return imageComposition.showBirthday; });
  const showQRCode = $derived.by(() => { void compositionVersion; return imageComposition.showQRCode; });

  // ── Event handlers ──────────────────────────────────────────────────

  let hapticService: import("$lib/shared/application/services/contracts/IHapticFeedback").IHapticFeedback | undefined;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleSelect(index: number) {
    selectedIndex = index;
    const seq = filteredSequences[index];
    if (seq) save(STORAGE_KEYS.sequenceId, seq.id ?? "");
  }

  function handleLengthChange(length: number) {
    selectedLength = length;
    selectedIndex = 0;
    save(STORAGE_KEYS.length, length);
    const first = (length === 0 ? sequences : sequences.filter(s => s.sequenceLength === length))[0];
    if (first) save(STORAGE_KEYS.sequenceId, first.id ?? "");
  }

  function handleFocusChange(card: "front" | "back" | null) {
    focusedCard = card;
    save(STORAGE_KEYS.focusedCard, card);
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
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (selectedIndex > 0) selectedIndex--;
      save(STORAGE_KEYS.sequenceId, filteredSequences[selectedIndex]?.id ?? "");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (selectedIndex < filteredSequences.length - 1) selectedIndex++;
      save(STORAGE_KEYS.sequenceId, filteredSequences[selectedIndex]?.id ?? "");
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
</script>

<svelte:window onkeydown={onKey} />

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
  <div class="designer-split">
    <!-- Left: Sequence picker -->
    <div class="picker-panel">
      <SequencePickerGrid
        sequences={filteredSequences}
        {selectedIndex}
        {selectedLength}
        onSelect={handleSelect}
        onLengthChange={handleLengthChange}
      />
    </div>

    <!-- Right: Card preview + settings -->
    <div class="preview-panel">
      <CardPreviewStack
        sequence={currentSequence}
        {focusedCard}
        onFocusChange={handleFocusChange}
        {handPointsVisible}
        {showGrid}
        {showTKA}
        {showWord}
        {includeStartPosition}
        {startPositionLayout}
        {showBirthday}
        {showQRCode}
        {showInfoCard}
      />

      <button
        class="settings-toggle"
        onclick={handleSidebarToggle}
        title="Settings"
        type="button"
      >
        <i class="fas fa-gear" aria-hidden="true"></i>
      </button>

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
{/if}

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
    .settings-toggle { transition: none; }
    .empty i { animation: none; }
  }
</style>
