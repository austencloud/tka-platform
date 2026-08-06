<!--
  CompositionLab.svelte

  Composition Lab for designing layout presets.
  Presets created here will be offered to users in a simplified picker.
  Features:
  - Preset layouts
  - Drag-to-move and resize cells
  - Snap guides
  - Z-index layering
  - Cell inspector
  - Persistence (survives refresh)
  - Custom preset saving
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import CompositionCanvas from "./components/CompositionCanvas.svelte";
  import PresetPicker from "./components/PresetPicker.svelte";
  import CellInspector from "./components/CellInspector.svelte";
  import { createCompositionLabState, ICON_OPTIONS } from "./state/composition-lab-state.svelte";
  import EditHistoryShortcutBridge from "$lib/shared/keyboard/components/EditHistoryShortcutBridge.svelte";

  // Props
  interface Props {
    /** Optional preset ID to apply on mount */
    initialPresetId?: string;
  }

  let { initialPresetId }: Props = $props();

  // Container element ref (observed via ResizeObserver)
  let containerEl: HTMLDivElement | null = $state(null);

  // Save Preset dialog ref (focused on open for keyboard users)
  let dialogEl: HTMLDivElement | null = $state(null);

  // Create lab state (owns cells, selection, undo/redo, persistence effects)
  const lab = $derived(createCompositionLabState(initialPresetId));

  // Move focus into the dialog when it opens so keyboard users aren't stranded
  $effect(() => {
    if (lab.showSaveDialog) {
      dialogEl?.focus();
    }
  });

  // Observe container size and forward to lab state
  $effect(() => {
    if (!containerEl || !browser) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      lab.setContainerBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div class="composition-lab" data-edit-history-shortcut-scope>
  <EditHistoryShortcutBridge
    onUndo={lab.undo}
    onRedo={lab.redo}
    canUndo={lab.canUndo}
    canRedo={lab.canRedo}
    undoLabel="Layout change"
    redoLabel="Layout change"
  />
  <header class="lab-header">
    <h1>Composition Lab</h1>
    <p class="subtitle">
      Drag to move, handles to resize. Shift=constrain, Alt+drag=duplicate, Ctrl=free move, Space+drag=pan, Alt+scroll=zoom.
    </p>
  </header>

  <div class="lab-content">
    <!-- Canvas area -->
    <div class="canvas-wrapper" bind:this={containerEl}>
      {#if !lab.initialized}
        <div class="loading-hint" aria-live="polite">Loading layout…</div>
      {/if}
      <CompositionCanvas
        cells={lab.cells}
        containerBounds={lab.containerBounds}
        selectedCellIds={lab.selectedCellIds}
        onSelectCell={lab.handleSelectCell}
        onUpdateCellPosition={lab.handleUpdateCellPosition}
        onUpdateCellSize={lab.handleUpdateCellSize}
        onDuplicateCell={lab.handleDuplicateCellAt}
        onDragStart={lab.handleDragStart}
      />
    </div>

    <!-- Control panel -->
    <div class="control-panel themed-scrollbar">
      <!-- Add cell button -->
      <button class="add-cell-btn" onclick={lab.handleAddCell}>
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add Cell
      </button>

      <!-- Export button -->
      <button
        class="export-btn"
        class:copied={lab.exportStatus === "copied"}
        class:error={lab.exportStatus === "error"}
        onclick={lab.handleExportLayout}
        disabled={lab.cells.length === 0}
      >
        {#if lab.exportStatus === "copied"}
          <i class="fas fa-check" aria-hidden="true"></i>
          Copied!
        {:else if lab.exportStatus === "error"}
          <i class="fas fa-times" aria-hidden="true"></i>
          Failed
        {:else}
          <i class="fas fa-copy" aria-hidden="true"></i>
          Export JSON
        {/if}
      </button>

      <!-- Save as preset button -->
      <button data-save-shortcut class="save-preset-btn" onclick={() => (lab.showSaveDialog = true)} disabled={lab.cells.length === 0}>
        <i class="fas fa-save" aria-hidden="true"></i>
        Save as Preset
      </button>

      <!-- Presets -->
      <PresetPicker
        presets={lab.allPresets}
        onSelectPreset={lab.applyPreset}
        onDeletePreset={lab.handleDeletePreset}
      />

      <!-- Inspector (when cell selected) -->
      {#if lab.selectedCell}
        <div class="divider"></div>
        <CellInspector
          cell={lab.selectedCell}
          onUpdateLabel={lab.handleUpdateLabel}
          onUpdateZIndex={lab.handleUpdateZIndex}
          onUpdateColor={lab.handleUpdateColor}
          onUpdateMediaType={lab.handleUpdateMediaType}
          onDeleteCell={lab.handleDeleteCell}
          onDuplicateCell={lab.handleDuplicateCell}
        />
      {:else if lab.selectedCount > 1}
        <div class="divider"></div>
        <div class="multi-selection">
          <p class="multi-label">{lab.selectedCount} cells selected</p>
          <button class="action-btn danger" onclick={lab.handleDeleteCell}>
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete Selected
          </button>
        </div>
      {:else}
        <div class="no-selection">
          <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
          <p>Click a cell to select it</p>
        </div>
      {/if}

      <!-- Cell count -->
      <div class="cell-count">
        {lab.cells.length} cell{lab.cells.length !== 1 ? "s" : ""}
      </div>
    </div>
  </div>

  <!-- Save preset dialog -->
  {#if lab.showSaveDialog}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog-backdrop" role="presentation" onclick={lab.handleCancelSaveDialog}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        bind:this={dialogEl}
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-preset-title"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            lab.handleCancelSaveDialog();
          }
        }}
      >
        <h2 id="save-preset-title" class="dialog-title">Save as Preset</h2>

        <div class="form-field">
          <label for="preset-name">Name</label>
          <input
            id="preset-name"
            type="text"
            value={lab.newPresetName}
            oninput={(e) => (lab.newPresetName = e.currentTarget.value)}
            placeholder="My Layout"
            maxlength="30"
          />
        </div>

        <div class="form-field">
          <label for="preset-description">Description (optional)</label>
          <input
            id="preset-description"
            type="text"
            value={lab.newPresetDescription}
            oninput={(e) => (lab.newPresetDescription = e.currentTarget.value)}
            placeholder="A custom layout..."
            maxlength="100"
          />
        </div>

        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Icon</label>
          <div class="icon-picker" role="radiogroup" aria-label="Preset icon">
            {#each ICON_OPTIONS as icon}
              <button
                class="icon-btn"
                class:selected={lab.newPresetIcon === icon}
                onclick={() => (lab.newPresetIcon = icon)}
                type="button"
                aria-label="Select {icon} icon"
              >
                <i class="fas fa-{icon}" aria-hidden="true"></i>
              </button>
            {/each}
          </div>
        </div>

        <div class="dialog-actions">
          <button class="cancel-btn" onclick={lab.handleCancelSaveDialog} type="button">
            Cancel
          </button>
          <button
            data-save-shortcut
            class="save-btn"
            onclick={lab.handleSaveAsPreset}
            type="button"
            disabled={!lab.newPresetName.trim()}
          >
            Save Preset
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .composition-lab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, white);
  }

  .lab-header {
    padding: var(--spacing-lg, 16px) var(--spacing-xl, 24px);
    flex-shrink: 0;
  }

  .lab-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .subtitle {
    margin: var(--spacing-xs, 4px) 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .lab-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: var(--spacing-lg, 16px);
    padding: 0 var(--spacing-xl, 24px) var(--spacing-xl, 24px);
    min-height: 0;
  }

  .canvas-wrapper {
    position: relative;
    min-height: 400px;
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  .loading-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    pointer-events: none;
    z-index: 1;
  }

  .control-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow-y: auto;
  }

  .add-cell-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 12px);
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .add-cell-btn:hover {
    background: var(--theme-accent-hover, #7c3aed);
  }

  .save-preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: transparent;
    border: 1px dashed var(--theme-accent, #8b5cf6);
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .save-preset-btn:hover:not(:disabled) {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .save-preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, white);
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-btn.copied {
    background: var(--semantic-success, #10b981);
    border-color: var(--semantic-success, #10b981);
    color: white;
  }

  .export-btn.error {
    background: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
    color: white;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: var(--spacing-sm, 8px) 0;
  }

  .multi-selection {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-md, 12px) 0;
  }

  .multi-label {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .multi-selection .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: transparent;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .multi-selection .action-btn.danger {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .multi-selection .action-btn.danger:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xl, 24px);
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .no-selection i {
    font-size: 1.5rem;
  }

  .no-selection p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .cell-count {
    margin-top: auto;
    padding-top: var(--spacing-md, 12px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  /* Dialog styles */
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .dialog {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    padding: var(--spacing-xl, 24px);
    width: 100%;
    max-width: 400px;
    margin: var(--spacing-lg, 16px);
  }

  .dialog-title {
    margin: 0 0 var(--spacing-lg, 16px);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
    margin-bottom: var(--spacing-md, 12px);
  }

  .form-field label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .form-field input {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
  }

  .form-field input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b5cf6);
  }

  .form-field input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .icon-btn.selected {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .dialog-actions {
    display: flex;
    gap: var(--spacing-sm, 8px);
    justify-content: flex-end;
    margin-top: var(--spacing-lg, 16px);
  }

  .cancel-btn {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .cancel-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .save-btn {
    padding: var(--spacing-sm, 8px) var(--spacing-lg, 16px);
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: var(--border-radius-md, 8px);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--theme-accent-hover, #7c3aed);
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .lab-content {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .control-panel {
      max-height: 300px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .save-preset-btn,
    .icon-btn,
    .cancel-btn,
    .save-btn {
      transition: none;
    }
  }
</style>
