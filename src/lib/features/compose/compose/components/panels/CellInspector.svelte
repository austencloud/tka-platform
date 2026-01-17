<script lang="ts">
  /**
   * CellInspector - Inline panel for cell configuration
   *
   * Displayed as a sidebar on desktop, taking up actual space in the layout
   * rather than overlaying as a drawer. This creates less disruptive UX
   * where canvas and config are side-by-side.
   */

  import SequenceBrowserPanel from "$lib/shared/animation-engine/components/SequenceBrowserPanel.svelte";
  import { getCompositionState } from "../../state/composition-state.svelte";
  import type { CellType } from "../../domain/types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  const compState = getCompositionState();

  // Sequence browser state
  let showSequenceBrowser = $state(false);

  // Get the selected cell
  const selectedCellId = $derived(compState.selectedCellId);
  const cell = $derived(
    selectedCellId
      ? compState.composition.cells.find((c) => c.id === selectedCellId)
      : null
  );

  // Cell type options
  const cellTypes: { value: CellType; label: string; icon: string }[] = [
    { value: "single", label: "Single", icon: "fa-square" },
    { value: "tunnel", label: "Tunnel", icon: "fa-layer-group" },
  ];

  // Rotation options
  const rotationOptions = [0, 90, 180, 270];

  function handleTypeChange(type: CellType) {
    if (selectedCellId) {
      compState.setCellType(selectedCellId, type);
    }
  }

  function handleRotationChange(rotation: number) {
    if (selectedCellId) {
      compState.setCellRotation(selectedCellId, rotation);
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

  function handleDeselect() {
    compState.closeCellConfig();
  }
</script>

<aside class="cell-inspector" class:has-cell={!!cell}>
  {#if cell}
    <header class="inspector-header">
      <h3 class="inspector-title">Cell Config</h3>
      <button
        class="close-btn"
        onclick={handleDeselect}
        title="Deselect cell"
        aria-label="Deselect cell"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>

    <div class="inspector-content">
      <!-- Cell Type -->
      <section class="inspector-section">
        <span class="section-label" id="type-label">Type</span>
        <div class="type-toggle" role="group" aria-labelledby="type-label">
          {#each cellTypes as option}
            <button
              class="type-btn"
              class:selected={cell.type === option.value}
              onclick={() => handleTypeChange(option.value)}
              title={option.label}
              aria-label={option.label}
            >
              <i class="fas {option.icon}" aria-hidden="true"></i>
            </button>
          {/each}
        </div>
      </section>

      <!-- Sequences -->
      <section class="inspector-section">
        <span class="section-label" id="sequence-label">
          Sequence
          {#if cell.type === "tunnel"}
            <span class="count">{cell.sequences.length}/4</span>
          {/if}
        </span>

        {#if cell.sequences.length === 0}
          <button class="add-sequence-btn" onclick={handleBrowseSequences}>
            <i class="fas fa-plus" aria-hidden="true"></i>
            <span>Add</span>
          </button>
        {:else}
          <div class="sequence-list">
            {#each cell.sequences as sequence, index}
              <div class="sequence-chip">
                <span class="chip-name">{sequence.name}</span>
                <button
                  class="chip-remove"
                  onclick={() =>
                    selectedCellId &&
                    compState.removeSequenceFromCell(selectedCellId, index)}
                  title="Remove"
                  aria-label="Remove {sequence.name}"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}

            {#if cell.sequences.length < (cell.type === "tunnel" ? 4 : 1)}
              <button
                class="add-more-btn"
                onclick={handleBrowseSequences}
                title="Add sequence"
                aria-label="Add sequence"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
            {/if}
          </div>
        {/if}
      </section>

      <!-- Rotation (single mode only) -->
      {#if cell.type === "single"}
        <section class="inspector-section">
          <span class="section-label" id="rotation-label">Rotation</span>
          <div
            class="rotation-grid"
            role="group"
            aria-labelledby="rotation-label"
          >
            {#each rotationOptions as rotation}
              <button
                class="rotation-btn"
                class:selected={cell.rotationOffset === rotation}
                onclick={() => handleRotationChange(rotation)}
                title="{rotation}°"
                aria-label="Rotate {rotation} degrees"
              >
                <i
                  class="fas fa-arrow-up"
                  style:transform="rotate({rotation}deg)"
                  aria-hidden="true"
                ></i>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Clear Action -->
      {#if cell.sequences.length > 0}
        <button class="clear-btn" onclick={handleClearCell}>
          <i class="fas fa-trash-alt" aria-hidden="true"></i>
          Clear
        </button>
      {/if}
    </div>
  {:else}
    <div class="no-selection">
      <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
      <p>Select a cell to configure</p>
    </div>
  {/if}
</aside>

<!-- Sequence Browser Panel -->
<SequenceBrowserPanel
  mode="primary"
  show={showSequenceBrowser}
  onSelect={handleSequenceSelect}
  onClose={handleSequenceBrowserClose}
/>

<style>
  .cell-inspector {
    /* Fluid width: 15% of viewport, clamped between 220px and 320px */
    width: clamp(220px, 18vw, 320px);
    flex-shrink: 0;
    background: var(--theme-panel-bg);
    border-left: 1px solid var(--theme-stroke, var(--theme-stroke));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    container-type: inline-size;
    container-name: inspector;
  }

  .inspector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(10px, 4cqi, 16px);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .inspector-title {
    margin: 0;
    font-size: clamp(0.8rem, 3.5cqi, 0.95rem);
    font-weight: 600;
    color: var(--theme-text, var(--theme-text));
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(24px, 10cqi, 32px);
    height: clamp(24px, 10cqi, 32px);
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: clamp(3px, 1.5cqi, 6px);
    transition: all var(--duration-fast) ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .inspector-content {
    flex: 1;
    overflow-y: auto;
    padding: clamp(10px, 4cqi, 18px);
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 5cqi, 20px);
  }

  .inspector-section {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 2cqi, 8px);
  }

  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: clamp(0.65rem, 2.8cqi, 0.75rem);
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .count {
    font-weight: 400;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Type Toggle */
  .type-toggle {
    display: flex;
    gap: clamp(3px, 1.5cqi, 6px);
  }

  .type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: clamp(36px, 14cqi, 48px);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(4px, 2cqi, 8px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .type-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .type-btn.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 20%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 50%,
      transparent
    );
    color: var(--theme-accent, var(--theme-accent));
  }

  /* Sequence List */
  .sequence-list {
    display: flex;
    flex-direction: column;
    gap: clamp(3px, 1.5cqi, 6px);
  }

  .sequence-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(5px, 2cqi, 10px) clamp(6px, 2.5cqi, 12px);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(3px, 1.5cqi, 6px);
  }

  .chip-name {
    font-size: clamp(0.75rem, 3cqi, 0.9rem);
    color: var(--theme-text, var(--theme-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(18px, 7cqi, 24px);
    height: clamp(18px, 7cqi, 24px);
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

  /* Add Sequence Button */
  .add-sequence-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 2cqi, 8px);
    min-height: clamp(36px, 14cqi, 48px);
    padding: clamp(6px, 2.5cqi, 12px);
    background: rgba(16, 185, 129, 0.15);
    border: 1px dashed rgba(16, 185, 129, 0.4);
    border-radius: clamp(4px, 2cqi, 8px);
    color: rgba(16, 185, 129, 0.9);
    font-size: clamp(0.75rem, 3cqi, 0.9rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .add-sequence-btn:hover {
    background: rgba(16, 185, 129, 0.25);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .add-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: clamp(28px, 11cqi, 38px);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px dashed var(--theme-stroke-strong);
    border-radius: clamp(3px, 1.5cqi, 6px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .add-more-btn:hover {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: rgba(16, 185, 129, 0.9);
  }

  /* Rotation Grid */
  .rotation-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: clamp(3px, 1.5cqi, 6px);
  }

  .rotation-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: clamp(32px, 12cqi, 44px);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(3px, 1.5cqi, 6px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .rotation-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .rotation-btn.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 20%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 50%,
      transparent
    );
    color: var(--theme-accent, var(--theme-accent));
  }

  .rotation-btn i {
    transition: transform var(--duration-fast) ease;
  }

  /* Clear Button */
  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 2cqi, 8px);
    min-height: clamp(32px, 12cqi, 44px);
    padding: clamp(6px, 2.5cqi, 12px);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: clamp(4px, 2cqi, 8px);
    color: rgba(239, 68, 68, 0.8);
    font-size: clamp(0.75rem, 3cqi, 0.9rem);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    margin-top: auto;
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
    gap: clamp(6px, 3cqi, 12px);
    color: var(--theme-text-dim);
    text-align: center;
    padding: clamp(16px, 6cqi, 28px);
  }

  .no-selection i {
    font-size: clamp(1.2rem, 5cqi, 1.8rem);
    opacity: 0.5;
  }

  .no-selection p {
    margin: 0;
    font-size: clamp(0.75rem, 3cqi, 0.9rem);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .type-btn,
    .rotation-btn,
    .add-sequence-btn,
    .clear-btn {
      transition: none;
    }
  }
</style>
