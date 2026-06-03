<script lang="ts">
  /**
   * CellConfigPanel - Slide-out panel for cell configuration
   *
   * Opens when clicking a cell in the composition canvas.
   * Responsive behavior:
   * - Slides from right on desktop (≥768px)
   * - Slides from bottom on mobile (<768px)
   *
   * Simplified flow:
   * - If cell is empty, auto-opens sequence browser
   * - Cell type is auto-derived (1 seq = single, 2+ = tunnel)
   * - Rotation controls removed for now
   */

  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import { getCompositionState } from "../../state/composition-state.svelte";
  import type { MediaDisplayType } from "$lib/shared/animation-engine/domain/compose-types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const compState = getCompositionState();

  // Responsive placement detection
  let isDesktop = $state(false);
  const placement = $derived<"right" | "bottom">(
    isDesktop ? "right" : "bottom"
  );

  function updateDesktopState() {
    isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
  }

  onMount(() => {
    updateDesktopState();
    window.addEventListener("resize", updateDesktopState);
    return () => window.removeEventListener("resize", updateDesktopState);
  });

  // Reactive bindings
  const isOpen = $derived(compState.isCellConfigOpen);
  const selectedCellId = $derived(compState.selectedCellId);
  const cell = $derived(
    selectedCellId
      ? compState.composition.cells.find((c) => c.id === selectedCellId)
      : null
  );

  // Sequence browser state (stacked on top of this panel)
  let showSequenceBrowser = $state(false);

  // Auto-open sequence browser when panel opens with empty cell
  $effect(() => {
    if (isOpen && cell && cell.sequences.length === 0) {
      // Small delay to let the panel animate in first
      setTimeout(() => {
        showSequenceBrowser = true;
      }, 100);
    }
  });

  // Reset sequence browser state when panel closes
  $effect(() => {
    if (!isOpen) {
      showSequenceBrowser = false;
    }
  });

  // Media display type options (simplified - just animation for now)
  const mediaTypes: { value: MediaDisplayType; label: string; icon: string }[] =
    [
      { value: "animation", label: "Animation", icon: "fa-play-circle" },
      { value: "video", label: "Video", icon: "fa-video" },
      { value: "stepGrid", label: "Step Grid", icon: "fa-th" },
      { value: "image", label: "Image", icon: "fa-image" },
    ];

  // Handlers
  function handleClose() {
    compState.closeCellConfig();
  }

  function handleMediaTypeChange(mediaType: MediaDisplayType) {
    if (selectedCellId) {
      compState.setCellMediaType(selectedCellId, mediaType);
    }
  }

  function handleClearCell() {
    if (selectedCellId) {
      compState.clearCell(selectedCellId);
    }
  }

  function handleBrowseSequences() {
    showSequenceBrowser = true;
  }

  function handleSequenceSelect(sequence: SequenceData) {
    if (selectedCellId) {
      compState.addSequenceToCell(selectedCellId, sequence);
    }
    showSequenceBrowser = false;
  }

  function handleSequenceBrowserClose() {
    showSequenceBrowser = false;
  }

  function handleRemoveSequence(index: number) {
    if (selectedCellId) {
      compState.removeSequenceFromCell(selectedCellId, index);
    }
  }

  // Derived: cell type label and max sequences (auto-derived from count)
  const cellTypeLabel = $derived(
    (cell?.sequences?.length ?? 0) > 1 ? "Tunnel" : "Single"
  );
  const maxSequences = 4; // Always allow up to 4 for tunnel capability
  const canAddMore = $derived((cell?.sequences?.length ?? 0) < maxSequences);
  const currentMediaType = $derived(cell?.mediaType ?? "animation");
</script>

<Drawer
  {isOpen}
  {placement}
  ariaLabel="Configure cell"
  class="cell-config-panel"
  showHandle={true}
  onclose={handleClose}
>
  <div class="cell-config-body">
    {#if cell}
      <!-- Header -->
      <header class="panel-header">
        <h3 class="panel-title">Cell Config</h3>
        <button
          class="close-btn"
          onclick={handleClose}
          title="Close"
          aria-label="Close panel"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>

      <!-- Sequences Section - Main focus of this panel -->
      <section class="panel-section sequences-section">
        <div class="section-header">
          <span class="section-label">
            Sequences
            {#if cell.sequences.length > 1}
              <span class="mode-badge tunnel">
                <i class="fas fa-layer-group" aria-hidden="true"></i>
                Tunnel
              </span>
            {/if}
          </span>
          <span class="count">{cell.sequences.length}/{maxSequences}</span>
        </div>

        {#if cell.sequences.length === 0}
          <div class="empty-sequences">
            <p>No sequences yet</p>
            <button class="add-sequence-btn" onclick={handleBrowseSequences}>
              <i class="fas fa-plus" aria-hidden="true"></i>
              <span>Browse Sequences</span>
            </button>
          </div>
        {:else}
          <div class="sequence-list">
            {#each cell.sequences as sequence, index}
              <div class="sequence-chip">
                <span class="chip-index">{index + 1}</span>
                <span class="chip-name">{sequence.name}</span>
                <button
                  class="chip-remove"
                  onclick={() => handleRemoveSequence(index)}
                  title="Remove"
                  aria-label="Remove {sequence.name}"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}

            {#if canAddMore}
              <button class="add-more-btn" onclick={handleBrowseSequences}>
                <i class="fas fa-plus" aria-hidden="true"></i>
                <span>Add Layer ({cell.sequences.length + 1}/{maxSequences})</span>
              </button>
            {/if}
          </div>
        {/if}
      </section>

      <!-- Actions -->
      {#if cell.sequences.length > 0}
        <div class="panel-actions">
          <button class="action-btn clear-btn" onclick={handleClearCell}>
            <i class="fas fa-trash-alt" aria-hidden="true"></i>
            Clear All
          </button>
        </div>
      {/if}
    {:else}
      <div class="no-selection">
        <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
        <p>Select a cell to configure</p>
      </div>
    {/if}
  </div>
</Drawer>

<!-- Sequence Picker Modal -->
<SequencePickerModal
  open={showSequenceBrowser}
  onSelect={handleSequenceSelect}
  onClose={handleSequenceBrowserClose}
/>

<style>
  /* Override drawer dimensions for this panel */
  :global(.cell-config-panel[data-placement="right"]) {
    width: clamp(280px, 22vw, 360px) !important;
    max-width: 90vw !important;
    height: 100% !important;
  }

  :global(.cell-config-panel[data-placement="bottom"]) {
    width: 100% !important;
    max-height: 85vh !important;
  }

  .cell-config-body {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 20px);
    padding: clamp(12px, 3cqi, 20px);
    height: 100%;
    overflow-y: auto;
    container-type: inline-size;
    container-name: cellpanel;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: clamp(8px, 2cqi, 14px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .panel-title {
    margin: 0;
    font-size: clamp(0.9rem, 3.5cqi, 1.1rem);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: clamp(4px, 1.5cqi, 8px);
    transition: all var(--duration-fast) ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  /* Sections */
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2cqi, 10px);
    font-size: clamp(0.75rem, 2.5cqi, 0.85rem);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    font-weight: 500;
    text-transform: none;
  }

  .mode-badge.tunnel {
    background: rgba(139, 92, 246, 0.2);
    color: rgba(167, 139, 250, 0.95);
  }

  .count {
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    font-weight: 400;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Empty State */
  .empty-sequences {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(10px, 3cqi, 16px);
    padding: clamp(16px, 4cqi, 24px);
    text-align: center;
  }

  .empty-sequences p {
    margin: 0;
    font-size: clamp(0.8rem, 2.8cqi, 0.9rem);
    color: var(--theme-text-dim);
  }

  /* Sequence List */
  .sequence-list {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 2cqi, 10px);
  }

  .sequence-chip {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    min-height: var(--min-touch-target);
    padding: clamp(8px, 2cqi, 12px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(6px, 2cqi, 10px);
  }

  .chip-index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(20px, 5cqi, 26px);
    height: clamp(20px, 5cqi, 26px);
    background: rgba(139, 92, 246, 0.2);
    color: rgba(167, 139, 250, 0.95);
    border-radius: 50%;
    font-size: clamp(0.7rem, 2cqi, 0.8rem);
    font-weight: 600;
    flex-shrink: 0;
  }

  .chip-name {
    flex: 1;
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    color: var(--theme-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: color var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .chip-remove:hover {
    color: rgba(239, 68, 68, 0.9);
  }

  /* Add Sequence Buttons */
  .add-sequence-btn,
  .add-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2cqi, 10px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px);
    background: rgba(16, 185, 129, 0.15);
    border: 1px dashed rgba(16, 185, 129, 0.4);
    border-radius: clamp(6px, 2cqi, 10px);
    color: rgba(16, 185, 129, 0.9);
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .add-sequence-btn:hover,
  .add-more-btn:hover {
    background: rgba(16, 185, 129, 0.25);
    border-color: rgba(16, 185, 129, 0.6);
  }

  /* Actions */
  .panel-actions {
    margin-top: auto;
    padding-top: clamp(12px, 3cqi, 18px);
    border-top: 1px solid var(--theme-stroke);
  }

  .action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2cqi, 10px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px);
    border-radius: clamp(6px, 2cqi, 10px);
    font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .clear-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: rgba(239, 68, 68, 0.8);
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
  }

  /* No Selection State */
  .no-selection {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 3cqi, 14px);
    color: var(--theme-text-dim);
    text-align: center;
    padding: clamp(20px, 6cqi, 36px);
  }

  .no-selection i {
    font-size: clamp(1.5rem, 6cqi, 2.2rem);
    opacity: 0.5;
  }

  .no-selection p {
    margin: 0;
    font-size: clamp(0.8rem, 3cqi, 0.95rem);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn,
    .add-sequence-btn,
    .add-more-btn,
    .chip-remove,
    .close-btn {
      transition: none;
    }
  }
</style>
