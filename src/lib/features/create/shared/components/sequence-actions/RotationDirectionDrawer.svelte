<!--
  RotationDirectionDrawer.svelte

  Drawer for saving and applying rotation direction patterns.
  - Save: Extract rotation directions from current sequence and save
  - Apply: Browse and apply saved patterns or templates

  This is a thin orchestrator that composes child components.
-->
<script lang="ts">

import * as rotationDirectionPatternManagerModule from "$lib/features/create/shared/services/rotation-direction-pattern-manager";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import { rotationDirectionPatternState } from "../../state/rotation-direction-pattern-state.svelte.ts";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { RotationDirectionPattern } from "../../domain/models/rotation-direction-pattern-data";
  import {
    templateToPattern,
    createUniformPattern,
    type RotationDirectionTemplateDefinition,
  } from "../../domain/templates/rotation-direction-templates";
  import type { TargetHand } from "../../state/panel-coordination-state.svelte";

  // Child components
  import SaveModePanel from "./rotation-direction/SaveModePanel.svelte";
  import UniformPatternButtons from "./rotation-direction/UniformPatternButtons.svelte";
  import TemplatePatternGrid from "./rotation-direction/TemplatePatternGrid.svelte";
  import SavedPatternList from "./rotation-direction/SavedPatternList.svelte";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Which hand(s) to apply patterns to - controlled by parent panel */
    targetHand: TargetHand;
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

  // Local state
  let mode: "save" | "apply" = $state("apply");
  let patternName = $state("");
  let savingPattern = $state(false);
  let applyingPattern = $state(false);
  let errorMessage = $state<string | null>(null);

  // Derived state
  const isMobile = $derived(!layoutState.isSideBySideLayout);
  const drawerStyle = $derived(
    toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : ""
  );

  // Load patterns when drawer opens
  $effect(() => {
    if (
      isOpen &&
      authState.user?.uid &&
      !rotationDirectionPatternState.initialized
    ) {
      rotationDirectionPatternState.loadPatterns(authState.user.uid);
    }
  });

  // === Handlers ===

  function handleSavePattern() {
    if (!sequence || !authState.user?.uid) return;

    savingPattern = true;
    errorMessage = null;

    const finalName =
      patternName.trim() || `Rotation ${new Date().toLocaleTimeString()}`;

    rotationDirectionPatternState
      .savePattern(finalName, authState.user.uid, sequence)
      .then((saved) => {
        if (saved) {
          patternName = "";
          mode = "apply";
        } else {
          errorMessage =
            rotationDirectionPatternState.error ?? "Failed to save pattern";
        }
      })
      .finally(() => {
        savingPattern = false;
      });
  }

  async function handleApplyPattern(pattern: RotationDirectionPattern) {
    if (!sequence) return;

    applyingPattern = true;
    errorMessage = null;

    try {
      const result = await rotationDirectionPatternManagerModule.applyPattern(
        pattern,
        sequence,
        targetHand
      );

      if (result.success && result.sequence) {
        onApply({
          sequence: result.sequence,
          warnings: result.warnings,
        });
      } else {
        errorMessage = result.error ?? "Failed to apply pattern";
      }
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to apply pattern";
    } finally {
      applyingPattern = false;
    }
  }

  function handleApplyUniform(direction: "cw" | "ccw") {
    if (!sequence || !authState.user?.uid) return;

    const pattern = createUniformPattern(
      sequence.steps.length,
      direction,
      authState.user.uid
    );
    handleApplyPattern(pattern);
  }

  function handleApplyTemplate(template: RotationDirectionTemplateDefinition) {
    if (!sequence || !authState.user?.uid) return;

    const pattern = templateToPattern(
      template,
      authState.user.uid,
      sequence.steps.length
    );
    handleApplyPattern(pattern);
  }

  function handleDeletePattern(pattern: RotationDirectionPattern) {
    if (!authState.user?.uid) return;
    rotationDirectionPatternState.deletePattern(pattern.id, authState.user.uid);
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
    class="rotation-direction-drawer"
    backdropClass="rotation-direction-backdrop"
  >
    <div class="drawer-content">
      <DrawerHeader title="Rotation Direction" onClose={handleClose} />

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
        <SaveModePanel
          {sequence}
          {patternName}
          saving={savingPattern}
          onSave={handleSavePattern}
          onNameChange={(name) => (patternName = name)}
        />
      {:else}
        <div class="apply-section">
          {#if rotationDirectionPatternState.isLoading}
            <div class="loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Loading patterns...
            </div>
          {:else}
            {#if sequence && sequence.steps.length > 0}
              <UniformPatternButtons
                disabled={applyingPattern}
                onApplyUniform={handleApplyUniform}
              />

              <TemplatePatternGrid
                stepCount={sequence.steps.length}
                {isMobile}
                onApplyTemplate={handleApplyTemplate}
              />
            {/if}

            <SavedPatternList
              patterns={rotationDirectionPatternState.patterns}
              currentStepCount={sequence?.steps.length ?? 0}
              applying={applyingPattern}
              onApply={handleApplyPattern}
              onDelete={handleDeletePattern}
            />
          {/if}
        </div>
      {/if}
    </div>
  </Drawer>
</div>

<style>
  /* Drawer positioning for desktop - must include [data-placement] for specificity */
  :global(
    .rotation-direction-drawer[data-placement="right"].side-by-side-layout
  ) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important;
    max-width: 100% !important;
  }

  :global(.rotation-direction-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  .drawer-content {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
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
    color: var(--theme-text-muted);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .tab.active {
    color: var(--theme-text);
    border-bottom: 2px solid var(--semantic-warning);
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

  .apply-section {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    container-type: inline-size;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px;
    color: var(--theme-text-muted);
  }

  /* Hand indicator (read-only display) */
  .hand-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    font-size: 0.85rem;
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
    background: var(--prop-blue);
  }

  .hand-dot.red {
    background: var(--prop-red);
  }

  /* Fullscreen on mobile - browsing interface needs space */
  @media (max-width: 768px) {
    :global(.drawer-content:has(.rotation-direction-drawer)) {
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }
  }
</style>
