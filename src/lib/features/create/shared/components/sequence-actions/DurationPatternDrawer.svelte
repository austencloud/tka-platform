<!--
  DurationPatternDrawer.svelte

  Drawer for saving and applying duration patterns.
  - Save: Extract durations from current sequence and save
  - Apply: Browse and apply saved patterns or templates

  Unlike Turn Patterns, duration is a step-level property (not per-motion),
  so there is no target hand selector.
-->
<script lang="ts">

import * as durationPatternManagerModule from "$lib/features/create/shared/services/duration-pattern-manager";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { durationPatternState } from "../../state/duration-pattern-state.svelte.ts";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { DurationPattern } from "../../domain/models/duration-pattern-data";
  import {
    getTemplatesForStepCount,
    getCategoryInfo,
    templateToPattern,
    type DurationCategory,
  } from "../../domain/templates/duration-templates";
  type DurationPatternManager = typeof durationPatternManagerModule;
  import PatternItemCard from "./PatternItemCard.svelte";
  import DurationPreviewGrid from "./DurationPreviewGrid.svelte";

  // Mobile detection - use layout state
  const isMobile = $derived(!layoutState.isSideBySideLayout);

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Measured tool panel width for desktop sizing (to match parent panel) */
    toolPanelWidth?: number;
    onClose: () => void;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
    /** Called when a pattern is selected for preview (instant feedback) */
    onPreview?: (sequence: SequenceData) => void;
    /** Whether preview mode is active (affects UI) */
    previewMode?: boolean;
  }

  let {
    isOpen = $bindable(),
    sequence,
    toolPanelWidth = 0,
    onClose,
    onApply,
    onPreview,
    previewMode = false,
  }: Props = $props();

  // Build inline style for drawer width when we have a valid measurement
  const drawerStyle = $derived(
    toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : ""
  );

  let mode: "save" | "apply" = $state("apply");
  let patternName = $state("");
  let savingPattern = $state(false);
  let applyingPattern = $state(false);
  let errorMessage = $state<string | null>(null);
  let categoryFilter = $state<DurationCategory | "all">("accent"); // Default to accent for mobile-first

  // Preview state - tracks currently selected pattern for preview
  let selectedPatternId = $state<string | null>(null);
  let previewedSequence = $state<SequenceData | null>(null);
  let previewWarnings = $state<readonly string[]>([]);

  const durationPatternManager: DurationPatternManager = durationPatternManagerModule;

  // Load patterns when drawer opens and set appropriate default filter
  $effect(() => {
    if (isOpen && authState.user?.uid && !durationPatternState.initialized) {
      durationPatternState.loadPatterns(authState.user.uid);
    }
    // Reset filter based on device when drawer opens
    if (isOpen) {
      categoryFilter = isMobile ? "accent" : "all";
    }
  });

  // Reset preview state when drawer closes
  $effect(() => {
    if (!isOpen) {
      selectedPatternId = null;
      previewedSequence = null;
      previewWarnings = [];
    }
  });

  function handleSavePattern() {
    if (!sequence || !authState.user?.uid) return;

    savingPattern = true;
    errorMessage = null;

    // Auto-generate name if empty
    const finalName =
      patternName.trim() || `Timing ${new Date().toLocaleTimeString()}`;

    durationPatternState
      .savePattern(finalName, authState.user.uid, sequence)
      .then((saved) => {
        if (saved) {
          patternName = "";
          mode = "apply";
        } else {
          errorMessage =
            durationPatternState.error ?? "Failed to save pattern";
        }
      })
      .finally(() => {
        savingPattern = false;
      });
  }

  function handlePatternClick(pattern: DurationPattern) {
    if (!sequence) return;

    applyingPattern = true;
    errorMessage = null;

    const result = durationPatternManager.applyPattern(pattern, sequence);

    if (result.success && result.sequence) {
      // In preview mode: update preview state and call onPreview
      if (previewMode && onPreview) {
        selectedPatternId = pattern.id;
        previewedSequence = result.sequence;
        previewWarnings = result.warnings ?? [];
        onPreview(result.sequence);
      } else {
        // Direct apply mode (mobile or no preview callback)
        onApply({
          sequence: result.sequence,
          warnings: result.warnings,
        });
      }
    } else {
      errorMessage = result.error ?? "Failed to apply pattern";
    }

    applyingPattern = false;
  }

  /** Confirm the previewed pattern - applies to the actual sequence */
  function handleConfirmPreview() {
    if (!previewedSequence) return;
    onApply({
      sequence: previewedSequence,
      warnings: previewWarnings,
    });
    // Clear preview state
    selectedPatternId = null;
    previewedSequence = null;
    previewWarnings = [];
  }

  /** Cancel the preview and revert */
  function handleCancelPreview() {
    selectedPatternId = null;
    previewedSequence = null;
    previewWarnings = [];
    // Notify parent to revert preview
    if (onPreview && sequence) {
      onPreview(sequence);
    }
  }

  function handleDeletePattern(pattern: DurationPattern) {
    if (!authState.user?.uid) return;
    durationPatternState.deletePattern(pattern.id, authState.user.uid);
  }

  function handleClose() {
    errorMessage = null;
    onClose();
  }
</script>

<div style={drawerStyle}>
  <Drawer
    bind:isOpen
    placement="right"
    onclose={handleClose}
    showHandle={false}
    respectLayoutMode={true}
    class="duration-pattern-drawer"
    backdropClass="duration-pattern-backdrop"
  >
    <div class="duration-pattern-drawer-content">
      <header class="drawer-header">
        <h2>Duration Patterns</h2>
        <div class="header-actions">
          {#if previewMode && selectedPatternId}
            <button
              class="action-btn cancel"
              onclick={handleCancelPreview}
              aria-label="Cancel preview"
            >
              Cancel
            </button>
            <button
              class="action-btn apply"
              onclick={handleConfirmPreview}
              aria-label="Apply pattern"
            >
              <i class="fas fa-check" aria-hidden="true"></i>
              Apply
            </button>
          {:else}
            <button class="close-btn" onclick={handleClose} aria-label="Close">
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
      </header>

      <!-- Mode tabs -->
      <div class="mode-tabs">
        <button
          class="tab"
          class:active={mode === "apply"}
          onclick={() => (mode = "apply")}
        >
          Apply
        </button>
        <button
          class="tab"
          class:active={mode === "save"}
          onclick={() => (mode = "save")}
        >
          Save Current
        </button>
      </div>

      {#if errorMessage}
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          {errorMessage}
        </div>
      {/if}

      {#if mode === "save"}
        <!-- Save mode -->
        <div class="save-section">
          {#if !sequence || sequence.steps.length === 0}
            <p class="empty-message">No sequence to save pattern from</p>
          {:else}
            <DurationPreviewGrid
              durations={sequence.steps.map((s) => s.duration ?? 1.0)}
              title="Current Durations ({sequence.steps.length} steps)"
            />

            <div class="save-form">
              <input
                type="text"
                placeholder="Pattern name (optional - auto-generated if empty)"
                bind:value={patternName}
                maxlength={50}
              />
              <button
                class="save-btn"
                onclick={handleSavePattern}
                disabled={savingPattern}
              >
                {#if savingPattern}
                  <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                {:else}
                  <i class="fas fa-save" aria-hidden="true"></i>
                {/if}
                Save Pattern
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Apply mode -->
        <div class="apply-section">
          {#if durationPatternState.isLoading}
            <div class="loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Loading patterns...
            </div>
          {:else}
            <!-- Templates section -->
            {@const allTemplates = sequence
              ? getTemplatesForStepCount(sequence.steps.length)
              : []}
            {@const filteredTemplates =
              categoryFilter === "all"
                ? allTemplates
                : allTemplates.filter((t) => t.category === categoryFilter)}
            {#if allTemplates.length > 0}
              <div class="templates-section">
                <div class="templates-header">
                  <h3>Patterns</h3>
                  <!-- Category filter -->
                  <div class="category-filter" class:mobile={isMobile} role="group" aria-label="Filter by category">
                    {#if !isMobile}
                      <button
                        class="filter-btn"
                        class:active={categoryFilter === "all"}
                        onclick={() => (categoryFilter = "all")}
                        aria-label="Show all categories"
                        aria-pressed={categoryFilter === "all"}>All</button
                      >
                    {/if}
                    {#each ["accent", "meter", "feel", "world"] as category}
                      {@const info = getCategoryInfo(
                        category as DurationCategory
                      )}
                      <button
                        class="filter-btn"
                        class:active={categoryFilter === category}
                        onclick={() =>
                          (categoryFilter = category as DurationCategory)}
                        style="--filter-color: {info.color}"
                        aria-label="Filter by {info.label} patterns"
                        aria-pressed={categoryFilter === category}
                      >
                        <span
                          class="category-dot"
                          style="background: {info.color}"
                          aria-hidden="true"
                        ></span>
                        {info.label}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Desktop grouped display when "All" selected -->
                {#if !isMobile && categoryFilter === "all"}
                  {#each ["accent", "meter", "feel", "world"] as category}
                    {@const groupTemplates = allTemplates.filter(
                      (t) => t.category === category
                    )}
                    {@const groupInfo = getCategoryInfo(
                      category as DurationCategory
                    )}
                    {#if groupTemplates.length > 0}
                      <div class="category-group">
                        <h4
                          class="group-header"
                          style="--group-color: {groupInfo.color}"
                        >
                          <span
                            class="group-dot"
                            style="background: {groupInfo.color}"
                          ></span>
                          {groupInfo.label}
                        </h4>
                        <div class="patterns-list">
                          {#each groupTemplates as template}
                            {@const pattern = authState.user && sequence
                              ? templateToPattern(
                                  template,
                                  authState.user.uid,
                                  sequence.steps.length
                                )
                              : null}
                            {@const categoryInfo = getCategoryInfo(
                              template.category
                            )}
                            {#if pattern}
                              <PatternItemCard
                                name={pattern.name}
                                description={template.description}
                                glassColor={categoryInfo.color}
                                isTemplate={true}
                                variant={template.category}
                                onclick={() => handlePatternClick(pattern)}
                              />
                            {/if}
                          {/each}
                        </div>
                      </div>
                    {/if}
                  {/each}
                {:else}
                  <!-- Filtered display (mobile always uses this, desktop when filter selected) -->
                  <div class="patterns-list" class:mobile-compact={isMobile}>
                    {#each filteredTemplates as template}
                      {@const pattern = authState.user && sequence
                        ? templateToPattern(
                            template,
                            authState.user.uid,
                            sequence.steps.length
                          )
                        : null}
                      {@const categoryInfo = getCategoryInfo(template.category)}
                      {#if pattern}
                        <PatternItemCard
                          name={pattern.name}
                          description={template.description}
                          glassColor={categoryInfo.color}
                          isTemplate={true}
                          variant={template.category}
                          onclick={() => handlePatternClick(pattern)}
                        />
                      {/if}
                    {/each}

                    {#if filteredTemplates.length === 0}
                      <p class="empty-filter-message">
                        No {categoryFilter} patterns available
                      </p>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- User's saved patterns -->
            {#if durationPatternState.patterns.length === 0}
              <p class="empty-message">
                No saved patterns yet. Save a pattern from the current sequence
                or try a template above.
              </p>
            {:else}
              <div class="saved-patterns-section">
                <h3>Your Patterns</h3>
                <div class="patterns-list">
                  {#each durationPatternState.patterns as pattern}
                    {@const isDisabled =
                      applyingPattern ||
                      !sequence ||
                      sequence.steps.length !== pattern.stepCount}
                    <PatternItemCard
                      name={pattern.name}
                      stepCount={pattern.stepCount}
                      disabled={isDisabled}
                      disabledReason={sequence &&
                      sequence.steps.length !== pattern.stepCount
                        ? `Requires ${pattern.stepCount} steps`
                        : undefined}
                      onclick={() => handlePatternClick(pattern)}
                    >
                      {#snippet actions()}
                        <div class="pattern-actions">
                          <button
                            class="delete-btn"
                            onclick={(e) => {
                              e.stopPropagation();
                              handleDeletePattern(pattern);
                            }}
                            title="Delete pattern"
                            aria-label="Delete pattern"
                          >
                            <i class="fas fa-trash" aria-hidden="true"></i>
                          </button>
                        </div>
                      {/snippet}
                    </PatternItemCard>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </Drawer>
</div>

<style>
  /* Position duration pattern drawer to cover Sequence Actions panel on desktop */
  :global(.duration-pattern-drawer[data-placement="right"].side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important;
    max-width: 100% !important;
  }

  /* Backdrop transparent - we want to cover sequence actions, not dim everything */
  :global(.duration-pattern-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  .duration-pattern-drawer-content {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .action-btn.cancel {
    background: transparent;
    color: var(--theme-text-dim);
    border: 1px solid var(--theme-stroke);
  }

  .action-btn.cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text);
  }

  .action-btn.apply {
    background: #f97316;
    color: white;
  }

  .action-btn.apply:hover {
    background: #ea580c;
  }

  .mode-tabs {
    display: flex;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .tab {
    flex: 1;
    padding: 12px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .tab.active {
    color: var(--theme-text);
    border-bottom: 2px solid #f97316; /* Orange accent for duration */
  }

  .tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.05);
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error);
    font-size: 0.85rem;
    margin: 8px 16px;
    border-radius: 8px;
  }

  .save-section,
  .apply-section {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Container query context for responsive grid */
  .apply-section {
    container-type: inline-size;
    container-name: pattern-section;
  }

  .empty-message {
    text-align: center;
    color: var(--theme-text-dim);
    padding: 32px 16px;
  }

  .save-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .save-form input {
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: 0.9rem;
  }

  .save-form input::placeholder {
    color: var(--theme-text-dim);
  }

  .save-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .save-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px;
    color: var(--theme-text-dim);
  }

  .patterns-list {
    display: grid;
    grid-template-columns: 1fr; /* Mobile: single column */
    gap: 8px;
  }

  /* 2 columns for wider panels */
  @container pattern-section (min-width: 400px) {
    .patterns-list {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* 3 columns for desktop-width panels */
  @container pattern-section (min-width: 550px) {
    .patterns-list {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .pattern-actions {
    position: absolute;
    top: 6px;
    right: 6px;
  }

  .delete-btn {
    padding: 4px 6px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--duration-fast);
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error);
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.35);
    opacity: 1;
  }

  /* Templates section */
  .templates-section,
  .saved-patterns-section {
    margin-bottom: 24px;
  }

  .templates-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }

  .templates-section h3,
  .saved-patterns-section h3 {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0;
    color: var(--theme-text-dim);
  }

  /* Category filter */
  .category-filter {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 14px;
    min-height: 44px;
    font-size: 0.8rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .filter-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .filter-btn.active {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--filter-color, rgba(255, 255, 255, 0.3));
  }

  .category-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .empty-filter-message {
    text-align: center;
    color: var(--theme-text-dim);
    padding: 16px;
    font-size: 0.85rem;
    grid-column: 1 / -1;
  }

  /* ========== Desktop Grouped Display ========== */
  .category-group {
    margin-bottom: 20px;
  }

  .category-group:last-child {
    margin-bottom: 0;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--group-color, var(--theme-text-dim));
    text-transform: capitalize;
  }

  .group-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ========== Mobile Segmented Control ========== */
  .category-filter.mobile {
    display: flex;
    gap: 0;
    background: var(--theme-card-bg);
    border-radius: 8px;
    padding: 3px;
    border: 1px solid var(--theme-stroke);
  }

  .category-filter.mobile .filter-btn {
    flex: 1;
    border-radius: 6px;
    border: none;
    background: transparent;
    padding: 8px 6px;
    font-size: 0.8rem;
    justify-content: center;
  }

  .category-filter.mobile .filter-btn.active {
    background: var(--filter-color, rgba(255, 255, 255, 0.15));
    color: var(--theme-text);
  }

  .category-filter.mobile .category-dot {
    width: 6px;
    height: 6px;
  }

  /* ========== Mobile Compact Grid ========== */
  .patterns-list.mobile-compact {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  /* Mobile compact - templates section */
  @container pattern-section (max-width: 399px) {
    .templates-section {
      margin-bottom: 16px;
    }

    .templates-header h3 {
      font-size: 0.8rem;
    }
  }

  /* Fullscreen on mobile - browsing interface needs space */
  @media (max-width: 768px) {
    :global(.drawer-content:has(.duration-pattern-drawer)) {
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }
  }
</style>
