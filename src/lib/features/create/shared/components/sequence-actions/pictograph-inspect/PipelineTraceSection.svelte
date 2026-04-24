<!--
  PipelineTraceSection.svelte

  Shows the full arrow positioning pipeline trace for one motion.
  Displays all 4 tiers with their values, highlights the active tier.
  Optional inline WASD editor for Global Adjustment layers.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type {
    PipelineDiagnostics,
    PipelineTier,
  } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "../../../domain/models/StepData";
  import type { IArrowAdjustmentOrchestrator, SelectedArrowContext } from "../../../services/contracts/IArrowAdjustmentOrchestrator";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import LayerTabBar from "../../arrow-adjustment/LayerTabBar.svelte";
  import { container } from "$lib/shared/di";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  const logger = createComponentLogger("PipelineTraceSection");

  interface Props {
    diagnostics: PipelineDiagnostics | null;
    color: "blue" | "red";
    stepData: StepData;
    onDiagnosticsChanged?: () => void;
  }

  let { diagnostics, color, stepData, onDiagnosticsChanged }: Props = $props();

  // Editing state
  let isEditing = $state(false);
  let activeLayer = $state<1 | 2 | 3>(2);
  let hasLocalChanges = $state(false);
  let saveState = $state<"idle" | "saving" | "saved">("idle");

  // Services
  let orchestrator: IArrowAdjustmentOrchestrator | null = null;

  const selectedArrowContext = $derived.by((): SelectedArrowContext | null => {
    const motion = stepData.motions?.[color];
    if (!motion) return null;
    const pictographData: PictographData = {
      id: stepData.id,
      letter: stepData.letter ?? null,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as PictographData["motions"],
    };
    return { motionData: motion, color, pictographData };
  });

  const thisPropType = $derived.by(() => {
    const settings = getSettings();
    const settingsPropType = color === "blue" ? settings.bluePropType : settings.redPropType;
    const motion = stepData.motions?.[color];
    return (settingsPropType ?? motion?.propType)?.toLowerCase() || "staff";
  });

  const otherPropType = $derived.by(() => {
    const settings = getSettings();
    const otherColor = color === "blue" ? "red" : "blue";
    const settingsPropType = otherColor === "blue" ? settings.bluePropType : settings.redPropType;
    const otherMotion = stepData.motions?.[otherColor];
    return (settingsPropType ?? otherMotion?.propType)?.toLowerCase() || "staff";
  });

  // Layer value checks for the tab bar dots
  const layer1HasValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    if (!orchestrator || !selectedArrowContext) return false;
    const key = orchestrator.generateTargetKey(selectedArrowContext, 1, thisPropType, otherPropType);
    if (!key) return false;
    return getGlobalAdjustmentRepository()?.hasAdjustment(key) ?? false;
  });

  const layer2HasValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    if (!orchestrator || !selectedArrowContext) return false;
    const key = orchestrator.generateTargetKey(selectedArrowContext, 2, thisPropType, otherPropType);
    if (!key) return false;
    return getGlobalAdjustmentRepository()?.hasAdjustment(key) ?? false;
  });

  const layer3HasValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    if (!orchestrator || !selectedArrowContext) return false;
    const key = orchestrator.generateTargetKey(selectedArrowContext, 3, thisPropType, otherPropType);
    if (!key) return false;
    return getGlobalAdjustmentRepository()?.hasAdjustment(key) ?? false;
  });

  // Current value at the active editing layer
  const currentLayerValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    if (!orchestrator || !selectedArrowContext) return null;
    const key = orchestrator.generateTargetKey(selectedArrowContext, activeLayer, thisPropType, otherPropType);
    if (!key) return null;
    return getGlobalAdjustmentRepository()?.getAdjustment(key) ?? null;
  });

  function tierLabel(tier: PipelineTier): string {
    switch (tier) {
      case "global": return "Global Override";
      case "special-json": return "Special JSON";
      case "prop-geometry": return "Prop Geometry";
      case "default": return "Default";
    }
  }

  function tierColor(tier: PipelineTier): string {
    switch (tier) {
      case "global": return "#22c55e";
      case "special-json": return "#a78bfa";
      case "prop-geometry": return "#22d3d8";
      case "default": return "#8b949e";
    }
  }

  function formatValue(v: { x: number; y: number } | null): string {
    if (!v) return "none";
    return `[${v.x}, ${v.y}]`;
  }

  function toggleEditing() {
    if (!isEditing) {
      if (!orchestrator) {
        orchestrator = container.items.arrowAdjustmentOrchestrator as IArrowAdjustmentOrchestrator;
      }
      const defaultLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
      activeLayer = defaultLayer;
    }
    isEditing = !isEditing;
    hasLocalChanges = false;
    saveState = "idle";
  }

  function handleLayerChange(layer: 1 | 2 | 3) {
    activeLayer = layer;
  }

  export function handleKeydown(event: KeyboardEvent): boolean {
    if (!isEditing) return false;
    const key = event.key.toLowerCase();

    if (!["w", "a", "s", "d"].includes(key)) return false;

    event.preventDefault();
    event.stopPropagation();

    let increment = 5;
    if (event.shiftKey && event.ctrlKey) increment = 200;
    else if (event.shiftKey) increment = 20;

    handleWASDMovement(key as "w" | "a" | "s" | "d", increment);
    return true;
  }

  async function handleWASDMovement(key: "w" | "a" | "s" | "d", increment: number) {
    if (!selectedArrowContext || !orchestrator) return;

    const repo = getGlobalAdjustmentRepository();
    if (!repo) return;

    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;

    const current = repo.getAdjustment(targetKey);
    let currentX = current?.x ?? 0;
    let currentY = current?.y ?? 0;

    const directionMap: Record<string, { dx: number; dy: number }> = {
      w: { dx: 0, dy: -increment },
      s: { dx: 0, dy: increment },
      a: { dx: -increment, dy: 0 },
      d: { dx: increment, dy: 0 },
    };
    const dir = directionMap[key]!;

    repo.saveAdjustmentLocal({
      ...targetKey,
      adjustmentX: currentX + dir.dx,
      adjustmentY: currentY + dir.dy,
    });

    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;

    const haptic = getHapticFeedback();
    haptic?.trigger("selection");
  }

  async function handleSave() {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !orchestrator || !selectedArrowContext) return;

    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;

    const adj = repo.getAdjustment(targetKey);
    if (!adj) return;

    try {
      saveState = "saving";
      await repo.saveAdjustment({
        ...targetKey,
        adjustmentX: adj.x,
        adjustmentY: adj.y,
      });
      saveState = "saved";
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("success");

      // Refresh diagnostics
      onDiagnosticsChanged?.();

      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Save failed:", error);
      saveState = "idle";
    }
  }

  async function handleDelete() {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !orchestrator || !selectedArrowContext) return;

    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;

    try {
      repo.deleteAdjustmentLocal(targetKey);
      await repo.deleteAdjustment(targetKey);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Delete failed:", error);
    }
  }
</script>

<div class="pipeline-trace">
  <div class="trace-header">
    <h4>
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      Pipeline
    </h4>
    <button
      class="edit-toggle"
      class:active={isEditing}
      onclick={toggleEditing}
      title={isEditing ? "Close editor" : "Edit global adjustment"}
    >
      <i class="fas {isEditing ? 'fa-times' : 'fa-pen'}" aria-hidden="true"></i>
      {isEditing ? "Close" : "Edit"}
    </button>
  </div>

  {#if diagnostics}
    <!-- Tier rows -->
    {@const tiers = [
      { tier: "global" as const, info: diagnostics.global, detail: diagnostics.global ? `L${diagnostics.global.layer}` : null },
      { tier: "special-json" as const, info: diagnostics.specialJson, detail: diagnostics.specialJson?.filePath ?? null },
      { tier: "prop-geometry" as const, info: diagnostics.propGeometry, detail: null },
      { tier: "default" as const, info: diagnostics.default, detail: null },
    ]}

    {#each tiers as { tier, info, detail }}
      {@const isActive = diagnostics.activeTier === tier}
      <div
        class="tier-row"
        class:active={isActive}
        class:has-value={info != null}
        style="--tier-color: {tierColor(tier)}"
      >
        <span class="tier-icon">
          {#if isActive}
            <i class="fas fa-star" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-circle" aria-hidden="true"></i>
          {/if}
        </span>
        <span class="tier-name">{tierLabel(tier)}</span>
        {#if detail}
          <span class="tier-detail">{detail}</span>
        {/if}
        <span class="tier-value" class:none={!info}>
          {info ? formatValue(info.value) : "none"}
        </span>
      </div>
    {/each}

    <!-- Summary row -->
    <div class="summary-row">
      <span class="summary-label">base</span>
      <span class="summary-value">{formatValue(diagnostics.baseAdjustment)}</span>
      <span class="summary-arrow">→</span>
      <span class="summary-label">rotated</span>
      <span class="summary-value">{formatValue(diagnostics.finalAdjustment)}</span>
    </div>
  {:else}
    <div class="loading">calculating...</div>
  {/if}

  <!-- Inline WASD Editor -->
  {#if isEditing}
    <div class="editor-section">
      <LayerTabBar
        {activeLayer}
        onLayerChange={handleLayerChange}
        {layer1HasValue}
        {layer2HasValue}
        {layer3HasValue}
        {thisPropType}
        {otherPropType}
      />

      <div class="editor-values">
        {#if currentLayerValue}
          <span class="editor-coord">X: <strong>{currentLayerValue.x}</strong></span>
          <span class="editor-coord">Y: <strong>{currentLayerValue.y}</strong></span>
        {:else}
          <span class="editor-empty">No value at Layer {activeLayer}</span>
        {/if}
      </div>

      <div class="editor-hint">
        WASD to move · Shift = 20px · Ctrl+Shift = 200px
      </div>

      {#if hasLocalChanges}
        <div class="editor-unsaved">
          <i class="fas fa-circle" aria-hidden="true"></i> Unsaved
        </div>
      {/if}

      <div class="editor-actions">
        {#if currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue}
          <button class="btn btn-delete" onclick={handleDelete} title="Delete at this layer">
            <i class="fas fa-trash-alt" aria-hidden="true"></i> Delete
          </button>
        {/if}
        <button
          class="btn btn-save"
          onclick={handleSave}
          disabled={!hasLocalChanges && !currentLayerValue}
        >
          {#if saveState === "saving"}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else if saveState === "saved"}
            <i class="fas fa-check" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-save" aria-hidden="true"></i>
          {/if}
          Save
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .pipeline-trace {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #21262d;
  }

  .trace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .trace-header h4 {
    margin: 0;
    font-size: 0.65rem;
    font-weight: 600;
    color: #58a6ff;
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .trace-header h4 i {
    font-size: 0.6rem;
  }

  .edit-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #30363d;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    font-size: 0.65rem;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .edit-toggle:hover {
    background: #21262d;
    color: #e6edf3;
  }

  .edit-toggle.active {
    background: rgba(56, 139, 253, 0.15);
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .tier-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 0.7rem;
    color: #484f58;
    transition: background 0.15s ease;
  }

  .tier-row.active {
    background: rgba(34, 197, 94, 0.08);
    color: #e6edf3;
  }

  .tier-row.has-value:not(.active) {
    color: #7d8590;
  }

  .tier-icon {
    width: 12px;
    text-align: center;
    font-size: 0.5rem;
    color: var(--tier-color);
  }

  .tier-row.active .tier-icon {
    font-size: 0.55rem;
    color: var(--tier-color);
  }

  .tier-name {
    font-weight: 500;
    min-width: 90px;
  }

  .tier-detail {
    font-size: 0.6rem;
    color: #484f58;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .tier-value {
    margin-left: auto;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.7rem;
    color: #79c0ff;
  }

  .tier-value.none {
    color: #484f58;
    font-style: italic;
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    margin-top: 4px;
    border-top: 1px solid #161b22;
    font-size: 0.65rem;
  }

  .summary-label {
    color: #7d8590;
    font-weight: 500;
  }

  .summary-value {
    font-family: "SF Mono", Monaco, monospace;
    color: #e6edf3;
    font-size: 0.7rem;
  }

  .summary-arrow {
    color: #484f58;
  }

  .loading {
    padding: 8px;
    text-align: center;
    color: #484f58;
    font-size: 0.7rem;
    font-style: italic;
  }

  /* Editor section */
  .editor-section {
    margin-top: 8px;
    padding: 8px;
    background: rgba(56, 139, 253, 0.06);
    border: 1px solid #1f3a5f;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .editor-values {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 8px;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.85rem;
  }

  .editor-coord {
    color: #8b949e;
  }

  .editor-coord strong {
    color: #e6edf3;
    font-weight: 700;
  }

  .editor-empty {
    color: #484f58;
    font-size: 0.75rem;
    font-style: italic;
  }

  .editor-hint {
    text-align: center;
    font-size: 0.6rem;
    color: #484f58;
  }

  .editor-unsaved {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.65rem;
    color: #f59e0b;
  }

  .editor-unsaved i {
    font-size: 5px;
  }

  .editor-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .btn {
    padding: 4px 12px;
    border: 1px solid #30363d;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
  }

  .btn-delete {
    background: transparent;
    color: #f85149;
    border-color: rgba(248, 81, 73, 0.3);
  }

  .btn-delete:hover {
    background: rgba(248, 81, 73, 0.1);
  }

  .btn-save {
    background: #238636;
    color: #ffffff;
    border-color: #238636;
  }

  .btn-save:hover:not(:disabled) {
    background: #2ea043;
  }

  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .tier-row,
    .edit-toggle,
    .btn {
      transition: none;
    }
  }
</style>
