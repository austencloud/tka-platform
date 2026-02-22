<!--
  FirePointListPanel.svelte

  Point list with flameScale sliders, delete buttons,
  and auto-saved actions (set default, reset, copy, import).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import type { FirePointEditorState } from "../state/fire-point-editor-state.svelte";

  interface Props {
    editorState: FirePointEditorState;
  }

  const { editorState }: Props = $props();

  let showImport = $state(false);
  let importText = $state("");
  let importError = $state<string | null>(null);
  let copyFeedback = $state(false);
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (copyFeedbackTimer !== null) clearTimeout(copyFeedbackTimer);
  });

  async function handleCopyJSON() {
    try {
      await navigator.clipboard.writeText(editorState.toJSON());
      copyFeedback = true;
      if (copyFeedbackTimer !== null) clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => { copyFeedback = false; copyFeedbackTimer = null; }, 1500);
    } catch {
      // Fallback: select-all on textarea
    }
  }

  function handleImport() {
    const err = editorState.importJSON(importText);
    if (err) {
      importError = err;
    } else {
      showImport = false;
      importText = "";
      importError = null;
    }
  }

  function handleFlameScaleChange(index: number, value: number) {
    editorState.updatePoint(index, { flameScale: value });
  }

  function handleCoordChange(index: number, field: "dx" | "dy", raw: string) {
    const value = parseFloat(raw);
    if (Number.isFinite(value)) {
      editorState.updatePoint(index, { [field]: Math.round(value * 10) / 10 });
    }
  }

  function handleCenterPoint(index: number) {
    editorState.movePoint(index, { dx: 0, dy: 0 });
  }

  function handleAddAtCenter() {
    editorState.addPoint(0, 0);
  }
</script>

<div class="list-panel themed-scrollbar">
  <!-- Point list -->
  <div class="section">
    <div class="section-header">
      <h3>
        Points
        <span class="point-count">{editorState.points.length}</span>
      </h3>
      <button
        class="add-center-btn"
        onclick={handleAddAtCenter}
        aria-label="Add fire point at center (0, 0)"
        title="Add point at center (0, 0)"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
        Add at Center
      </button>
    </div>

    {#if editorState.points.length === 0}
      <div class="empty-hint">
        No fire points. Click the canvas or use "Add at Center."
      </div>
    {:else}
      <div class="point-list">
        {#each editorState.points as point, i (i)}
          <div
            class="point-row"
            class:selected={editorState.selectedPointIndex === i}
            onclick={() => { editorState.selectedPointIndex = i; }}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editorState.selectedPointIndex = i; } }}
            role="button"
            tabindex="0"
            aria-label="Select point {i + 1}"
          >
            <!-- Row 1: index, coords, icon buttons -->
            <div class="point-top-row">
              <span class="point-index">{i + 1}</span>
              <div class="point-coords">
                <label class="coord-field">
                  <span class="coord-label">dx</span>
                  <input
                    type="number"
                    class="coord-input"
                    step="0.1"
                    value={point.dx}
                    onchange={(e) => handleCoordChange(i, "dx", (e.target as HTMLInputElement).value)}
                    onclick={(e) => e.stopPropagation()}
                  />
                </label>
                <label class="coord-field">
                  <span class="coord-label">dy</span>
                  <input
                    type="number"
                    class="coord-input"
                    step="0.1"
                    value={point.dy}
                    onchange={(e) => handleCoordChange(i, "dy", (e.target as HTMLInputElement).value)}
                    onclick={(e) => e.stopPropagation()}
                  />
                </label>
              </div>
              <button
                class="icon-btn center-btn"
                onclick={(e) => { e.stopPropagation(); handleCenterPoint(i); }}
                aria-label="Move point {i + 1} to center"
                title="Move to center (0, 0)"
              >
                <i class="fas fa-crosshairs" aria-hidden="true"></i>
              </button>
              <button
                class="icon-btn delete-btn"
                onclick={(e) => { e.stopPropagation(); editorState.deletePoint(i); }}
                aria-label="Delete point {i + 1}"
                title="Delete point"
              >
                <i class="fas fa-trash-alt" aria-hidden="true"></i>
              </button>
            </div>
            <!-- Row 2: flame scale slider (full width) -->
            <div class="flame-scale-row">
              <label class="flame-label" for="scale-{i}">
                <i class="fas fa-fire" aria-hidden="true"></i>
                Scale
              </label>
              <input
                id="scale-{i}"
                type="range"
                class="flame-slider"
                min="0.1"
                max="2.0"
                step="0.1"
                value={point.flameScale}
                oninput={(e) => handleFlameScaleChange(i, parseFloat((e.target as HTMLInputElement).value))}
                onclick={(e) => e.stopPropagation()}
              />
              <span class="scale-value">{point.flameScale.toFixed(1)}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="section actions-section">
    <h3>Actions</h3>

    <div class="action-buttons">
      <button
        class="action-btn default-btn"
        onclick={() => editorState.setAsDefault()}
        aria-label="Set current points as default for this prop"
        title="Save current points as your baseline default for this prop"
      >
        <i class="fas fa-bookmark" aria-hidden="true"></i>
        Set as Default
      </button>

      <button
        class="action-btn reset-btn"
        onclick={() => editorState.resetToUserDefault()}
        aria-label={editorState.hasUserDefault ? "Reset to my saved default" : "Reset to system defaults"}
        title={editorState.hasUserDefault ? "Revert to your saved default" : "Revert to system defaults (no custom default set)"}
      >
        <i class="fas fa-undo" aria-hidden="true"></i>
        {editorState.hasUserDefault ? "Reset to My Default" : "Reset to Defaults"}
      </button>

      <button
        class="action-btn undo-btn"
        onclick={() => editorState.undo()}
        disabled={!editorState.canUndo}
        aria-label="Undo last change"
      >
        <i class="fas fa-undo-alt" aria-hidden="true"></i>
        Undo
      </button>

      <button
        class="action-btn copy-btn"
        onclick={handleCopyJSON}
        aria-label={copyFeedback ? "Copied to clipboard" : "Copy points as JSON"}
      >
        <i class="fas {copyFeedback ? 'fa-check' : 'fa-copy'}" aria-hidden="true"></i>
        {copyFeedback ? "Copied!" : "Copy JSON"}
      </button>

      <button
        class="action-btn import-btn"
        onclick={() => { showImport = !showImport; importError = null; }}
        aria-label={showImport ? "Cancel import" : "Import points from JSON"}
      >
        <i class="fas fa-file-import" aria-hidden="true"></i>
        Import JSON
      </button>
    </div>

    {#if showImport}
      <div class="import-section">
        <textarea
          class="import-textarea"
          bind:value={importText}
          placeholder={'{"points": [{"dx": 0, "dy": 0, "flameScale": 1.0}]}'}
          rows="4"
        ></textarea>
        {#if importError}
          <p class="import-error">{importError}</p>
        {/if}
        <button class="action-btn" onclick={handleImport} aria-label="Apply imported JSON">
          Apply Import
        </button>
      </div>
    {/if}
  </div>

  <!-- Status -->
  <div class="status-bar">
    <span class="status-info">
      {editorState.points.length} {editorState.points.length === 1 ? "point" : "points"}
      {#if editorState.hasUserDefault}
        <span class="status-has-default" title="Custom default set">
          <i class="fas fa-bookmark" aria-hidden="true"></i>
        </span>
      {/if}
    </span>
    {#if editorState.actionFeedback}
      <span class="status-action-feedback">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        {editorState.actionFeedback}
      </span>
    {:else if editorState.saveIndicatorVisible}
      <span class="status-saved">
        <i class="fas fa-check" aria-hidden="true"></i>
        Saved
      </span>
    {/if}
  </div>
</div>

<style>
  .list-panel {
    /* Flame Lab domain color tokens */
    --flame-orange: #f97316;
    --flame-orange-dim: rgba(249, 115, 22, 0.08);
    --flame-orange-mid: rgba(249, 115, 22, 0.15);
    --flame-orange-border: rgba(249, 115, 22, 0.3);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 16px);
    overflow-y: auto;
    min-height: 0;
  }

  .section {
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
  }

  .section h3 {
    margin: 0 0 var(--spacing-sm, 8px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .point-count {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-card-bg);
    padding: 2px 8px;
    border-radius: 9999px;
  }

  .empty-hint {
    padding: var(--spacing-lg, 24px) var(--spacing-md, 16px);
    text-align: center;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  /* --- Section header --- */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm, 8px);
  }

  .section-header h3 {
    margin: 0;
  }

  .add-center-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 16px;
    border: 1px solid var(--flame-orange-border);
    border-radius: var(--border-radius-md, 8px);
    background: var(--flame-orange-dim);
    color: var(--flame-orange);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background 100ms ease;
  }

  .add-center-btn:hover {
    background: var(--flame-orange-mid);
  }

  .add-center-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  /* --- Point list --- */
  .point-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .point-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid transparent;
    border-radius: var(--border-radius-md, 8px);
    cursor: pointer;
    transition: background 100ms ease;
  }

  .point-row:hover {
    background: var(--theme-card-bg);
  }

  .point-row.selected {
    background: var(--flame-orange-dim);
    border-color: var(--flame-orange-border);
  }

  .point-row:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  /* Row 1: index + coords + icon buttons */
  .point-top-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .point-index {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--flame-orange);
    background: var(--flame-orange-mid);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .point-coords {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .coord-field {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .coord-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .coord-input {
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 6px 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-sm, 4px);
    background: var(--theme-overlay-dark, rgba(0, 0, 0, 0.3));
    color: var(--theme-text, white);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-min, 14px);
    text-align: right;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .coord-input::-webkit-inner-spin-button,
  .coord-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .coord-input:focus {
    outline: none;
    border-color: var(--flame-orange);
  }

  /* Icon buttons (center, delete) - 44px AAA touch target */
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: transparent;
    cursor: pointer;
    transition: all 100ms ease;
    flex-shrink: 0;
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  .icon-btn i {
    font-size: var(--font-size-min, 14px);
  }

  .center-btn {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .center-btn:hover {
    background: var(--flame-orange-dim);
    border-color: var(--flame-orange-border);
    color: var(--flame-orange);
  }

  .delete-btn {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .delete-btn:hover {
    background: var(--semantic-error-dim, rgba(239, 68, 68, 0.12));
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  /* Row 2: flame scale slider */
  .flame-scale-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 36px;
  }

  .flame-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
    cursor: pointer;
  }

  .flame-label i {
    color: var(--flame-orange);
    font-size: var(--font-size-compact, 12px);
  }

  .flame-slider {
    flex: 1;
    min-width: 0;
    height: 6px;
    accent-color: var(--flame-orange);
    cursor: pointer;
  }

  .scale-value {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  /* --- Action buttons --- */
  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .action-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .default-btn {
    border-color: var(--semantic-success-dim, rgba(34, 197, 94, 0.4));
    color: var(--semantic-success, #22c55e);
  }

  .default-btn:hover:not(:disabled) {
    background: var(--semantic-success-dim, rgba(34, 197, 94, 0.1));
  }

  .reset-btn {
    border-color: var(--semantic-error-dim, rgba(239, 68, 68, 0.3));
    color: var(--semantic-error, #ef4444);
  }

  .reset-btn:hover:not(:disabled) {
    background: var(--semantic-error-dim, rgba(239, 68, 68, 0.1));
  }

  .import-section {
    margin-top: var(--spacing-sm, 8px);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .import-textarea {
    width: 100%;
    min-height: 80px;
    padding: 10px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-overlay-dark, rgba(0, 0, 0, 0.3));
    color: var(--theme-text, white);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-min, 14px);
    resize: vertical;
  }

  .import-error {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--semantic-error, #ef4444);
  }

  /* --- Status bar --- */
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    font-size: var(--font-size-min, 14px);
  }

  .status-info {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-has-default {
    color: var(--semantic-success, #22c55e);
    font-size: var(--font-size-compact, 12px);
  }

  .status-saved {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    display: flex;
    align-items: center;
    gap: 4px;
    animation: fade-in-out 1.2s ease;
  }

  .status-action-feedback {
    color: var(--semantic-success, #22c55e);
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    animation: action-pop 2s ease;
  }

  @keyframes fade-in-out {
    0% { opacity: 0; }
    15% { opacity: 1; }
    75% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes action-pop {
    0% { opacity: 0; transform: scale(0.95); }
    10% { opacity: 1; transform: scale(1.02); }
    20% { transform: scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .action-btn,
    .point-row,
    .icon-btn,
    .add-center-btn {
      transition: none;
    }

    .status-saved,
    .status-action-feedback {
      animation: none;
    }
  }
</style>
