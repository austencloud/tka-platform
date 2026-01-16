<script lang="ts">
  /**
   * CellConfigSheet - Drawer for configuring individual composition cells
   *
   * Allows users to:
   * - Choose cell type (single or tunnel)
   * - Select sequences for the cell
   * - Configure trail settings
   * - Set rotation offset
   */

  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceBrowserPanel from "$lib/shared/animation-engine/components/SequenceBrowserPanel.svelte";
  import { getCompositionState } from "../../state/composition-state.svelte";
  import type { CellType } from "../../domain/types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    isOpen: boolean;
    cellId: string | null;
    onClose: () => void;
  }

  let { isOpen = $bindable(), cellId, onClose }: Props = $props();

  const compState = getCompositionState();

  // Sequence browser state
  let showSequenceBrowser = $state(false);

  // Get the cell being configured
  const cell = $derived(
    cellId ? compState.composition.cells.find((c) => c.id === cellId) : null
  );

  // Cell type options
  const cellTypes: {
    value: CellType;
    label: string;
    icon: string;
    description: string;
  }[] = [
    {
      value: "single",
      label: "Single",
      icon: "fa-square",
      description: "One sequence fills the cell",
    },
    {
      value: "tunnel",
      label: "Tunnel",
      icon: "fa-layer-group",
      description: "2-4 sequences overlaid",
    },
  ];

  // Rotation options
  const rotationOptions = [0, 90, 180, 270];

  function handleTypeChange(type: CellType) {
    if (cellId) {
      compState.setCellType(cellId, type);
    }
  }

  function handleRotationChange(rotation: number) {
    if (cellId) {
      compState.setCellRotation(cellId, rotation);
    }
  }

  function handleClearCell() {
    if (cellId) {
      compState.clearCell(cellId);
      onClose();
    }
  }

  // Check if we're on desktop (has navigation sidebar)
  function isDesktop(): boolean {
    return typeof window !== "undefined" && window.innerWidth >= 768;
  }

  function handleBrowseSequences() {
    // On desktop, close cell config first so sequence browser replaces it
    if (isDesktop()) {
      isOpen = false;
    }
    showSequenceBrowser = true;
  }

  function handleSequenceSelect(sequence: SequenceData) {
    if (cellId) {
      compState.addSequenceToCell(cellId, sequence);
    }
    showSequenceBrowser = false;
    // Don't reopen config panel - let user see the result immediately
    // They can click the cell again if they want to configure more
    onClose();
  }

  function handleSequenceBrowserClose() {
    showSequenceBrowser = false;
    // Reopen cell config on desktop when closing browser without selecting
    // (user probably wants to continue configuring)
    if (isDesktop()) {
      isOpen = true;
    }
  }
</script>

<Drawer
  bind:isOpen
  placement="right"
  ariaLabel="Configure cell"
  class="cell-config-drawer"
>
  <div class="cell-config-sheet">
    {#if cell}
      <header class="sheet-header">
        <h2 class="sheet-title">Configure Cell</h2>
        <p class="sheet-subtitle">Cell {cellId}</p>
      </header>

      <!-- Cell Type Selection -->
      <section class="config-section">
        <h3 class="section-title">Cell Type</h3>
        <div class="type-options">
          {#each cellTypes as option}
            <button
              class="type-option"
              class:selected={cell.type === option.value}
              onclick={() => handleTypeChange(option.value)}
            >
              <i class="fas {option.icon}" aria-hidden="true"></i>
              <div class="option-info">
                <span class="option-label">{option.label}</span>
                <span class="option-description">{option.description}</span>
              </div>
            </button>
          {/each}
        </div>
      </section>

      <!-- Sequences Section -->
      <section class="config-section">
        <h3 class="section-title">
          Sequences
          <span class="sequence-count">
            {cell.sequences.length}/{cell.type === "tunnel" ? 4 : 1}
          </span>
        </h3>

        {#if cell.sequences.length === 0}
          <div class="empty-sequences">
            <i class="fas fa-film" aria-hidden="true"></i>
            <p>No sequences assigned</p>
            <button class="add-sequence-btn" onclick={handleBrowseSequences}>
              <i class="fas fa-plus" aria-hidden="true"></i>
              Browse Sequences
            </button>
          </div>
        {:else}
          <div class="sequence-list">
            {#each cell.sequences as sequence, index}
              <div class="sequence-item">
                <div class="sequence-info">
                  <span class="sequence-name">{sequence.name}</span>
                  <span class="sequence-steps"
                    >{sequence.steps?.length ?? 0} steps</span
                  >
                </div>
                <button
                  class="remove-btn"
                  onclick={() =>
                    cellId && compState.removeSequenceFromCell(cellId, index)}
                  title="Remove sequence"
                  aria-label="Remove sequence"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}

            {#if cell.sequences.length < (cell.type === "tunnel" ? 4 : 1)}
              <button class="add-more-btn" onclick={handleBrowseSequences}>
                <i class="fas fa-plus" aria-hidden="true"></i>
                Add {cell.type === "tunnel" ? "Another" : ""} Sequence
              </button>
            {/if}
          </div>
        {/if}
      </section>

      <!-- Rotation Section (for single cells) -->
      {#if cell.type === "single"}
        <section class="config-section">
          <h3 class="section-title">Rotation</h3>
          <div class="rotation-options">
            {#each rotationOptions as rotation}
              <button
                class="rotation-btn"
                class:selected={cell.rotationOffset === rotation}
                onclick={() => handleRotationChange(rotation)}
              >
                <i
                  class="fas fa-arrow-up"
                  style:transform="rotate({rotation}deg)"
                  aria-hidden="true"
                ></i>
                <span>{rotation}°</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Trail Settings Preview -->
      <section class="config-section">
        <h3 class="section-title">Trail Settings</h3>
        <div class="trail-preview">
          <p class="coming-soon">Trail customization coming soon</p>
          <div class="trail-summary">
            <span>Width: {cell.trailSettings.lineWidth}px</span>
            <span
              >Opacity: {(cell.trailSettings.maxOpacity * 100).toFixed(
                0
              )}%</span
            >
          </div>
        </div>
      </section>

      <!-- Actions -->
      <div class="sheet-actions">
        <button class="action-btn clear-btn" onclick={handleClearCell}>
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
          Clear Cell
        </button>
        <button class="action-btn done-btn" onclick={onClose}> Done </button>
      </div>
    {:else}
      <div class="no-cell">
        <p>No cell selected</p>
      </div>
    {/if}
  </div>
</Drawer>

<!-- Sequence Browser Panel - auto-detects placement (right on desktop, bottom on mobile) -->
<SequenceBrowserPanel
  mode="primary"
  show={showSequenceBrowser}
  onSelect={handleSequenceSelect}
  onClose={handleSequenceBrowserClose}
/>

<style>
  /* Constrain drawer width for right-side panel */
  :global(.cell-config-drawer) {
    width: clamp(280px, 25vw, 360px) !important;
    max-width: 90vw !important;
  }

  .cell-config-sheet {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 4cqi, 28px);
    padding: clamp(12px, 3cqi, 20px);
    width: 100%;
    height: 100%;
    overflow-y: auto;
    container-type: inline-size;
    container-name: cellconfig;
  }

  .sheet-header {
    text-align: center;
    padding-bottom: clamp(12px, 3cqi, 20px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .sheet-title {
    font-size: clamp(1.1rem, 3.5cqi, 1.3rem);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    margin: 0 0 clamp(3px, 1cqi, 6px) 0;
  }

  .sheet-subtitle {
    font-size: clamp(0.75rem, 2.5cqi, 0.9rem);
    color: var(--theme-text-dim);
    margin: 0;
    font-family: monospace;
  }

  /* Sections */
  .config-section {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 12px);
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: clamp(0.8rem, 2.5cqi, 0.95rem);
    font-weight: 600;
    color: var(--theme-text-dim);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sequence-count {
    font-size: 0.8em;
    font-weight: 400;
    color: var(--theme-text-dim);
  }

  /* Type Options */
  .type-options {
    display: flex;
    flex-direction: column;
    gap: clamp(3px, 1cqi, 6px);
  }

  /* Type option - 48px minimum touch target */
  .type-option {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2cqi, 12px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px) clamp(12px, 3cqi, 18px);
    background: var(--theme-card-bg);
    border: clamp(1px, 0.3cqi, 2px) solid var(--theme-stroke);
    border-radius: clamp(6px, 1.5cqi, 10px);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .type-option:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .type-option.selected {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.6);
  }

  .type-option i {
    font-size: 1.2em;
    width: clamp(20px, 6cqi, 28px);
    text-align: center;
  }

  .option-info {
    display: flex;
    flex-direction: column;
    gap: clamp(1px, 0.4cqi, 3px);
  }

  .option-label {
    font-weight: 600;
    font-size: clamp(0.85rem, 2.8cqi, 1rem);
  }

  .option-description {
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    color: var(--theme-text-dim);
  }

  /* Sequences */
  .empty-sequences {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 12px);
    padding: clamp(16px, 4cqi, 28px);
    background: rgba(255, 255, 255, 0.03);
    border: clamp(1px, 0.3cqi, 2px) dashed var(--theme-stroke);
    border-radius: clamp(6px, 1.5cqi, 10px);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .empty-sequences i {
    font-size: clamp(1.5rem, 5cqi, 2.2rem);
    opacity: 0.5;
  }

  .empty-sequences p {
    margin: 0;
    font-size: clamp(0.8rem, 2.5cqi, 0.95rem);
  }

  /* Add sequence buttons - 48px minimum touch target */
  .add-sequence-btn,
  .add-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 8px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px) clamp(12px, 3cqi, 18px);
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: clamp(4px, 1cqi, 8px);
    color: rgba(16, 185, 129, 1);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-sequence-btn:hover,
  .add-more-btn:hover {
    background: rgba(16, 185, 129, 0.3);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .sequence-list {
    display: flex;
    flex-direction: column;
    gap: clamp(3px, 1cqi, 6px);
  }

  .sequence-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(6px, 1.5cqi, 10px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(4px, 1cqi, 8px);
  }

  .sequence-info {
    display: flex;
    flex-direction: column;
    gap: clamp(1px, 0.4cqi, 3px);
  }

  .sequence-name {
    font-weight: 500;
    color: var(--theme-text);
    font-size: clamp(0.85rem, 2.8cqi, 1rem);
  }

  .sequence-steps {
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    color: var(--theme-text-dim);
  }

  /* Remove button - 48px minimum touch target */
  .remove-btn {
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px);
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: color 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    color: rgba(239, 68, 68, 0.9);
  }

  /* Rotation Options */
  .rotation-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: clamp(3px, 1cqi, 6px);
  }

  /* Rotation button - 48px minimum touch target */
  .rotation-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 0.8cqi, 5px);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: clamp(6px, 1.5cqi, 10px);
    background: var(--theme-card-bg);
    border: clamp(1px, 0.3cqi, 2px) solid var(--theme-stroke);
    border-radius: clamp(4px, 1cqi, 8px);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .rotation-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .rotation-btn.selected {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.6);
    color: rgba(255, 255, 255, 0.95);
  }

  .rotation-btn i {
    font-size: clamp(0.9rem, 3cqi, 1.1rem);
    transition: transform 0.2s ease;
  }

  .rotation-btn span {
    font-size: clamp(0.65rem, 2cqi, 0.8rem);
  }

  /* Trail Settings */
  .trail-preview {
    padding: clamp(12px, 3cqi, 18px);
    background: rgba(255, 255, 255, 0.03);
    border-radius: clamp(6px, 1.5cqi, 10px);
  }

  .coming-soon {
    font-size: clamp(0.7rem, 2.2cqi, 0.85rem);
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 clamp(6px, 1.5cqi, 10px) 0;
    font-style: italic;
  }

  .trail-summary {
    display: flex;
    gap: clamp(12px, 3cqi, 18px);
    font-size: clamp(0.7rem, 2.2cqi, 0.85rem);
    color: var(--theme-text-dim);
  }

  /* Actions */
  .sheet-actions {
    display: flex;
    gap: clamp(6px, 1.5cqi, 10px);
    margin-top: auto;
    padding-top: clamp(12px, 3cqi, 18px);
    border-top: 1px solid var(--theme-stroke);
  }

  /* Action buttons - 48px minimum touch target */
  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 8px);
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px) clamp(12px, 3cqi, 18px);
    border-radius: clamp(6px, 1.5cqi, 10px);
    font-weight: 500;
    font-size: clamp(0.85rem, 2.8cqi, 1rem);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: rgba(239, 68, 68, 0.9);
  }

  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .done-btn {
    background: rgba(59, 130, 246, 0.3);
    border: 1px solid rgba(59, 130, 246, 0.5);
    color: rgba(255, 255, 255, 0.95);
  }

  .done-btn:hover {
    background: rgba(59, 130, 246, 0.4);
    border-color: rgba(59, 130, 246, 0.7);
  }

  /* No Cell State */
  .no-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .type-option,
    .rotation-btn,
    .action-btn {
      transition: none;
    }
  }
</style>
