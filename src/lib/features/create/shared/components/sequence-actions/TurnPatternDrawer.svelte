<!--
  TurnPatternDrawer.svelte

  Drawer for saving and applying turn patterns.
  - Save: Extract turns from current sequence and save
  - Apply: Browse and apply saved patterns
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import { turnPatternState } from "../../state/turn-pattern-state.svelte.ts";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { TurnPattern } from "../../domain/models/TurnPatternData";
  import { formatTurnValue } from "../../domain/models/TurnPatternData";
  import {
    getTemplatesForStepCount,
    getComplexityInfo,
    templateToPattern,
    createUniformPattern,
    type PatternComplexity,
    type TurnValue,
  } from "../../domain/templates/turn-pattern-templates";
  import { turnPatternManager } from "../../services/implementations/TurnPatternManager";
  import type { TargetHand } from "../../state/panel-coordination-state.svelte";
  import PatternItemCard from "./PatternItemCard.svelte";

  // Mobile detection - use layout state
  const isMobile = $derived(!layoutState.isSideBySideLayout);

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Which hand(s) to apply patterns to - controlled by parent panel */
    targetHand: TargetHand;
    /** Measured tool panel width for desktop sizing (to match parent panel) */
    toolPanelWidth?: number;
    onClose: () => void;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
  }

  let {
    isOpen = $bindable(),
    sequence,
    targetHand,
    toolPanelWidth = 0,
    onClose,
    onApply,
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
  let complexityFilter = $state<PatternComplexity | "all">("simple"); // Default to "simple" for mobile-first


  // Load patterns when drawer opens and set appropriate default filter
  $effect(() => {
    if (isOpen && authState.user?.uid && !turnPatternState.initialized) {
      turnPatternState.loadPatterns(authState.user.uid);
    }
    // Reset filter based on device when drawer opens
    if (isOpen) {
      complexityFilter = isMobile ? "simple" : "all";
    }
  });

  function handleSavePattern() {
    if (!sequence || !authState.user?.uid) return;

    savingPattern = true;
    errorMessage = null;

    // Auto-generate name if empty
    const finalName =
      patternName.trim() || `Pattern ${new Date().toLocaleTimeString()}`;

    turnPatternState
      .savePattern(finalName, authState.user.uid, sequence)
      .then((saved) => {
        if (saved) {
          patternName = "";
          mode = "apply";
        } else {
          errorMessage = turnPatternState.error ?? "Failed to save pattern";
        }
      })
      .finally(() => {
        savingPattern = false;
      });
  }

  function handleApplyPattern(pattern: TurnPattern) {
    if (!sequence) return;

    applyingPattern = true;
    errorMessage = null;

    const result = turnPatternManager.applyPattern(pattern, sequence, targetHand);

    if (result.success && result.sequence) {
      onApply({
        sequence: result.sequence,
        warnings: result.warnings,
      });
      // Keep drawer open to allow applying multiple patterns
    } else {
      errorMessage = result.error ?? "Failed to apply pattern";
    }

    applyingPattern = false;
  }

  function handleDeletePattern(pattern: TurnPattern) {
    if (!authState.user?.uid) return;
    turnPatternState.deletePattern(pattern.id, authState.user.uid);
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
    class="turn-pattern-drawer"
    backdropClass="turn-pattern-backdrop"
  >
    <div class="turn-pattern-drawer-content">
      <DrawerHeader title="Turn Patterns" onClose={handleClose} />

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

      <!-- Hand indicator (read-only - controlled by parent panel) -->
      {#if mode === "apply"}
        <div class="hand-indicator">
          <span class="indicator-label">Applying to:</span>
          <span class="indicator-value" class:both={targetHand === "both"}>
            {#if targetHand === "blue"}
              <span class="hand-dot blue"></span>Blue hand
            {:else if targetHand === "red"}
              <span class="hand-dot red"></span>Red hand
            {:else}
              Both hands
            {/if}
          </span>
        </div>
      {/if}

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
            <div class="pattern-preview">
              <h3>Current Pattern ({sequence.steps.length} steps)</h3>
              <div class="preview-grid">
                {#each sequence.steps as beat, i}
                  <div class="preview-beat">
                    <span class="beat-num">{i + 1}</span>
                    <div class="turn-pair">
                      <span class="turn-value blue">
                        {formatTurnValue(beat.motions?.blue?.turns ?? null)}
                      </span>
                      <span class="separator">|</span>
                      <span class="turn-value red">
                        {formatTurnValue(beat.motions?.red?.turns ?? null)}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

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
          {#if turnPatternState.isLoading}
            <div class="loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Loading patterns...
            </div>
          {:else}
            <!-- Uniform Pattern Section -->
            {#if sequence && sequence.steps.length > 0}
              <div class="uniform-section">
                <h3>Uniform</h3>
                <p class="section-desc">Apply same turn value to all steps</p>
                <div class="uniform-buttons">
                  {#each [0, 1, 2, 3] as turnValue}
                    {@const uniformTemplate = createUniformPattern(
                      sequence.steps.length,
                      turnValue
                    )}
                    {@const uniformPattern = authState.user
                      ? templateToPattern(uniformTemplate, authState.user.uid)
                      : null}
                    {@const complexityInfo = getComplexityInfo(
                      uniformTemplate.complexity
                    )}
                    {#if uniformPattern}
                      <button
                        class="uniform-btn"
                        style="--glass-color: {complexityInfo.color}"
                        onclick={() => handleApplyPattern(uniformPattern)}
                      >
                        {turnValue}
                      </button>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Templates section -->
            {@const allTemplates = sequence
              ? getTemplatesForStepCount(sequence.steps.length)
              : []}
            {@const filteredTemplates =
              complexityFilter === "all"
                ? allTemplates
                : allTemplates.filter((t) => t.complexity === complexityFilter)}
            {#if allTemplates.length > 0}
              <div class="templates-section">
                <div class="templates-header">
                  <h3>Patterns</h3>
                  <!-- Complexity filter - mobile shows as segmented control without "All" -->
                  <div class="complexity-filter" class:mobile={isMobile}>
                    {#if !isMobile}
                      <button
                        class="filter-btn"
                        class:active={complexityFilter === "all"}
                        onclick={() => (complexityFilter = "all")}>All</button
                      >
                    {/if}
                    {#each ["simple", "medium", "complex"] as level}
                      {@const info = getComplexityInfo(
                        level as PatternComplexity
                      )}
                      <button
                        class="filter-btn"
                        class:active={complexityFilter === level}
                        onclick={() =>
                          (complexityFilter = level as PatternComplexity)}
                        style="--filter-color: {info.color}"
                      >
                        <span
                          class="complexity-dot"
                          style="background: {info.color}"
                        ></span>
                        {info.label}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Desktop grouped display when "All" selected -->
                {#if !isMobile && complexityFilter === "all"}
                  {#each ["simple", "medium", "complex"] as complexity}
                    {@const groupTemplates = allTemplates.filter(
                      (t) => t.complexity === complexity
                    )}
                    {@const groupInfo = getComplexityInfo(
                      complexity as PatternComplexity
                    )}
                    {#if groupTemplates.length > 0}
                      <div class="complexity-group">
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
                            {@const pattern = authState.user
                              ? templateToPattern(template, authState.user.uid)
                              : null}
                            {@const complexityInfo = getComplexityInfo(
                              template.complexity
                            )}
                            {#if pattern}
                              <PatternItemCard
                                name={pattern.name}
                                description={template.description}
                                glassColor={complexityInfo.color}
                                isTemplate={true}
                                variant={template.complexity}
                                onclick={() => handleApplyPattern(pattern)}
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
                      {@const pattern = authState.user
                        ? templateToPattern(template, authState.user.uid)
                        : null}
                      {@const complexityInfo = getComplexityInfo(
                        template.complexity
                      )}
                      {#if pattern}
                        <PatternItemCard
                          name={pattern.name}
                          description={template.description}
                          glassColor={complexityInfo.color}
                          isTemplate={true}
                          variant={template.complexity}
                          onclick={() => handleApplyPattern(pattern)}
                        />
                      {/if}
                    {/each}

                    {#if filteredTemplates.length === 0}
                      <p class="empty-filter-message">
                        No {complexityFilter} patterns available
                      </p>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- User's saved patterns -->
            {#if turnPatternState.patterns.length === 0}
              <p class="empty-message">
                No saved patterns yet. Save a pattern from the current sequence
                or try a template above.
              </p>
            {:else}
              <div class="saved-patterns-section">
                <h3>Your Patterns</h3>
                <div class="patterns-list">
                  {#each turnPatternState.patterns as pattern}
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
                      onclick={() => handleApplyPattern(pattern)}
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
  /* Position turn pattern drawer to cover Sequence Actions panel on desktop */
  /* Must include [data-placement] for specificity to override Drawer.css */
  :global(.turn-pattern-drawer[data-placement="right"].side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important;
    max-width: 100% !important;
  }

  /* Backdrop transparent - we want to cover sequence actions, not dim everything */
  :global(.turn-pattern-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }
  .turn-pattern-drawer-content {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  .mode-tabs {
    display: flex;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .tab {
    flex: 1;
    padding: 12px;
    background: transparent;
    border: none;
    color: var(--theme-text-muted, var(--theme-text-dim));
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .tab.active {
    color: var(--theme-text);
    border-bottom: 2px solid #14b8a6;
  }

  .tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.05);
  }

  /* Hand indicator (read-only display) */
  .hand-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    font-size: 0.8rem;
  }

  .indicator-label {
    color: var(--theme-text-muted);
    white-space: nowrap;
  }

  .indicator-value {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--theme-text);
    font-weight: 500;
  }

  .indicator-value.both {
    color: var(--theme-text-muted);
  }

  .hand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .hand-dot.blue {
    background: var(--semantic-info);
  }

  .hand-dot.red {
    background: var(--semantic-error);
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
    color: var(--theme-text-muted, var(--theme-text-dim));
    padding: 32px 16px;
  }

  .pattern-preview {
    margin-bottom: 16px;
  }

  .pattern-preview h3 {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0 0 12px;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 6px;
  }

  .preview-beat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px;
    background: var(--theme-card-bg);
    border-radius: 6px;
    font-size: 0.75rem;
    gap: 4px;
  }

  .beat-num {
    font-weight: 600;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .turn-pair {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .separator {
    color: var(--theme-text-dim);
    font-size: 0.7rem;
  }

  .turn-value {
    font-family: monospace;
    display: inline-block;
    min-width: 20px;
    text-align: center;
  }

  .turn-value.blue {
    color: var(--semantic-info);
  }

  .turn-value.red {
    color: var(--semantic-error);
  }

  .save-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .save-form input {
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
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
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
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
    color: var(--theme-text-muted, var(--theme-text-dim));
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

  /* Uniform section */
  .uniform-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .uniform-section h3 {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0 0 4px;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .section-desc {
    font-size: 0.75rem;
    color: var(--theme-text-muted, var(--theme-text-dim));
    margin: 0 0 12px;
  }

  .uniform-buttons {
    display: flex;
    gap: 8px;
  }

  .uniform-btn {
    flex: 1;
    padding: 12px 8px;
    font-size: 1.1rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--glass-color) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--glass-color) 30%, transparent);
    border-radius: 8px;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .uniform-btn:hover {
    background: color-mix(in srgb, var(--glass-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--glass-color) 50%, transparent);
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
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  /* Complexity filter */
  .complexity-filter {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 16px;
    color: var(--theme-text-muted, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .filter-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .filter-btn.active {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--filter-color, rgba(255, 255, 255, 0.3));
  }

  .complexity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .empty-filter-message {
    text-align: center;
    color: var(--theme-text-dim);
    padding: 16px;
    font-size: 0.85rem;
    grid-column: 1 / -1; /* Span all columns */
  }

  /* ========== Desktop Grouped Display ========== */
  .complexity-group {
    margin-bottom: 20px;
  }

  .complexity-group:last-child {
    margin-bottom: 0;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--group-color, var(--theme-text-muted));
    text-transform: capitalize;
  }

  .group-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ========== Mobile Segmented Control ========== */
  .complexity-filter.mobile {
    display: flex;
    gap: 0;
    background: var(--theme-card-bg);
    border-radius: 8px;
    padding: 3px;
    border: 1px solid var(--theme-stroke);
  }

  .complexity-filter.mobile .filter-btn {
    flex: 1;
    border-radius: 6px;
    border: none;
    background: transparent;
    padding: 8px 6px;
    font-size: 0.8rem;
    justify-content: center;
  }

  .complexity-filter.mobile .filter-btn.active {
    background: var(--filter-color, rgba(255, 255, 255, 0.15));
    color: var(--theme-text);
  }

  .complexity-filter.mobile .complexity-dot {
    width: 6px;
    height: 6px;
  }

  /* ========== Mobile Compact Grid ========== */
  .patterns-list.mobile-compact {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  /* Mobile uniform section - more compact */
  @container pattern-section (max-width: 399px) {
    .uniform-section {
      margin-bottom: 12px;
      padding-bottom: 12px;
    }

    .uniform-section h3 {
      font-size: 0.8rem;
      margin-bottom: 2px;
    }

    .section-desc {
      font-size: 0.7rem;
      margin-bottom: 8px;
    }

    .uniform-buttons {
      gap: 6px;
    }

    .uniform-btn {
      padding: 10px 6px;
      font-size: 1rem;
    }

    .templates-section {
      margin-bottom: 16px;
    }

    .templates-header h3 {
      font-size: 0.8rem;
    }
  }

  /* Fullscreen on mobile - browsing interface needs space */
  @media (max-width: 768px) {
    :global(.drawer-content:has(.turn-pattern-drawer)) {
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }
  }
</style>
