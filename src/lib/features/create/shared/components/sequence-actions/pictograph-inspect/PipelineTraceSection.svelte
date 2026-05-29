<!--
  PipelineTraceSection.svelte

  Shows the full arrow positioning pipeline trace for one motion.
  Displays all 4 tiers with their values, highlights the active tier.
  Optional inline WASD editor for Global Adjustment layers.
-->
<script lang="ts">

import { getArrowAdjustmentOrchestrator } from "$lib/features/create/shared/getArrowAdjustmentOrchestrator";
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type {
    PipelineDiagnostics,
    PipelineTier,
  } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { ArrowAdjustmentOrchestrator } from "../../../services/implementations/ArrowAdjustmentOrchestrator";
import type { SelectedArrowContext } from "../../../services/implementations/ArrowAdjustmentOrchestrator";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import LayerTabBar from "../../arrow-adjustment/LayerTabBar.svelte";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { getSpecialOverrideRepository } from "$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton";
  import {
    generateSpecialOverrideKey,
    extractOriFolderFromPath,
    type SpecialArrowPlacementInput,
  } from "$lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement";
  import {
    generateOrientationKey,
    resolveEffectiveOriKey,
  } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/special-placement-ori-key-generator";
  import { generateTurnsTuple } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/turns-tuple-key-generator";
  import { deriveGridMode as _deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
  import { getPropGeometryRepository } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/services/prop-geometry-singleton";
  import { derivePropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver";
  import type { PropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/PropGeometryAdjustment";

  const logger = createComponentLogger("PipelineTraceSection");

  interface Props {
    diagnostics: PipelineDiagnostics | null;
    color: "blue" | "red";
    stepData: StepData;
    onDiagnosticsChanged?: () => void;
  }

  let { diagnostics, color, stepData, onDiagnosticsChanged }: Props = $props();

  const colorName = $derived(color === "blue" ? "Blue" : "Red");
  const colorToken = $derived(
    color === "blue" ? "var(--prop-blue, #58a6ff)" : "var(--prop-red, #f85149)"
  );

  // Editing state
  let isEditing = $state(false);
  let activeLayer = $state<1 | 2 | 3>(2);
  let hasLocalChanges = $state(false);
  let saveState = $state<"idle" | "saving" | "saved">("idle");
  let editTarget = $state<"global" | "special-json" | "prop-geometry">("global");
  let editX = $state(0);
  let editY = $state(0);

  // Services
  let orchestrator: ArrowAdjustmentOrchestrator | null = null;

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

  const specialOverrideKey = $derived.by((): string | null => {
    if (!diagnostics || !stepData.letter) return null;
    const motion = stepData.motions?.[color];
    if (!motion) return null;

    if (diagnostics.specialJson) {
      const oriFolder = extractOriFolderFromPath(diagnostics.specialJson.filePath);
      const gridMode = motion.gridMode || "diamond";
      return generateSpecialOverrideKey({
        gridMode,
        oriFolder,
        letter: stepData.letter,
        turnsTuple: diagnostics.specialJson.turnsTupleKey,
        motionType: motion.motionType?.toLowerCase() || "",
      });
    }

    const pictographData: PictographData = {
      id: stepData.id,
      letter: stepData.letter,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as PictographData["motions"],
    };
    const rawOriKey = generateOrientationKey(motion, pictographData);
    const oriKey = resolveEffectiveOriKey(rawOriKey, pictographData);
    const gridMode = motion.gridMode || (stepData.motions.blue && stepData.motions.red
      ? _deriveGridMode(stepData.motions.blue, stepData.motions.red) : "diamond");
    const turnsTupleArr = generateTurnsTuple(pictographData);
    return generateSpecialOverrideKey({
      gridMode,
      oriFolder: oriKey,
      letter: stepData.letter,
      turnsTuple: turnsTupleArr.join(","),
      motionType: motion.motionType?.toLowerCase() || "",
    });
  });

  const propGeometryKey = $derived.by((): PropGeometryKey | null => {
    const motion = stepData.motions?.[color];
    if (!motion) return null;
    const pictographData: PictographData = {
      id: stepData.id,
      letter: stepData.letter ?? null,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as PictographData["motions"],
    };
    return derivePropGeometryKey(pictographData, motion, color);
  });

  // Reactive to in-memory edits (mirrors the global-tier *HasValue pattern).
  const propGeometryHasValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    if (!propGeometryKey) return false;
    return getPropGeometryRepository()?.hasAdjustment(propGeometryKey) ?? false;
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
      case "global": return "var(--semantic-success, #22c55e)";
      case "special-json": return "var(--theme-accent, #a78bfa)";
      case "prop-geometry": return "var(--semantic-info, #22d3d8)";
      case "default": return "var(--theme-text-dim, #8b949e)";
    }
  }

  function formatValue(v: { x: number; y: number } | null): string {
    if (!v) return "none";
    return `[${v.x}, ${v.y}]`;
  }

  function defaultEditTargetForActiveTier(): "global" | "special-json" | "prop-geometry" {
    const active = diagnostics?.activeTier;
    if (active === "special-json") return "special-json";
    if (active === "prop-geometry") return "prop-geometry";
    return "global";
  }

  function toggleEditing() {
    if (!isEditing) {
      if (!orchestrator) {
        orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
      }
      const defaultLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
      activeLayer = defaultLayer;
      editTarget = defaultEditTargetForActiveTier();
      syncNumericInputs();
    }
    isEditing = !isEditing;
    hasLocalChanges = false;
    saveState = "idle";
  }

  /** Parent entry point: open the editor (called when its arrow is clicked). */
  export function enterEditMode() {
    if (isEditing) return;
    if (!orchestrator) {
      orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
    }
    activeLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
    editTarget = defaultEditTargetForActiveTier();
    syncNumericInputs();
    isEditing = true;
    hasLocalChanges = false;
    saveState = "idle";
  }

  function syncNumericInputs() {
    if (editTarget === "global") {
      const val = currentLayerValue;
      editX = val?.x ?? 0;
      editY = val?.y ?? 0;
    } else if (editTarget === "special-json") {
      const repo = getSpecialOverrideRepository();
      if (repo?.isInitialized && specialOverrideKey) {
        const override = repo.getOverride(specialOverrideKey);
        if (override) {
          editX = override.x;
          editY = override.y;
        } else if (diagnostics?.specialJson) {
          editX = diagnostics.specialJson.value.x;
          editY = diagnostics.specialJson.value.y;
        } else {
          editX = 0;
          editY = 0;
        }
      } else if (diagnostics?.specialJson) {
        editX = diagnostics.specialJson.value.x;
        editY = diagnostics.specialJson.value.y;
      }
    } else if (editTarget === "prop-geometry") {
      const repo = getPropGeometryRepository();
      const existing = repo && propGeometryKey ? repo.getAdjustment(propGeometryKey) : null;
      if (existing) {
        editX = existing.x;
        editY = existing.y;
      } else if (diagnostics?.propGeometry) {
        editX = diagnostics.propGeometry.value.x;
        editY = diagnostics.propGeometry.value.y;
      } else {
        editX = 0;
        editY = 0;
      }
    }
  }

  function selectEditTarget(tier: "global" | "special-json" | "prop-geometry") {
    editTarget = tier;
    hasLocalChanges = false;
    saveState = "idle";
    syncNumericInputs();
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
    const directionMap: Record<string, { dx: number; dy: number }> = {
      w: { dx: 0, dy: -increment },
      s: { dx: 0, dy: increment },
      a: { dx: -increment, dy: 0 },
      d: { dx: increment, dy: 0 },
    };
    const dir = directionMap[key]!;
    editX += dir.dx;
    editY += dir.dy;

    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else {
      handlePropGeometryNumericUpdate();
    }

    const haptic = getHapticFeedback();
    haptic?.trigger("selection");
  }

  async function handleSave() {
    if (editTarget === "special-json") {
      return handleSpecialJsonSave();
    }
    if (editTarget === "prop-geometry") {
      return handlePropGeometrySave();
    }
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
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Save failed:", error);
      saveState = "idle";
    }
  }

  async function handleDelete() {
    if (editTarget === "special-json") {
      return handleSpecialJsonDelete();
    }
    if (editTarget === "prop-geometry") {
      return handlePropGeometryDelete();
    }
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

  function handleNumericChange() {
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else {
      handlePropGeometryNumericUpdate();
    }
  }

  function handleGlobalNumericUpdate() {
    if (!orchestrator || !selectedArrowContext) return;
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return;
    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;
    repo.saveAdjustmentLocal({
      ...targetKey,
      adjustmentX: editX,
      adjustmentY: editY,
    });
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  function handleSpecialJsonNumericUpdate() {
    const repo = getSpecialOverrideRepository();
    if (!repo || !specialOverrideKey) return;
    const originalValue = diagnostics?.specialJson?.firestoreOverride?.original
      ?? (diagnostics?.specialJson ? diagnostics.specialJson.value : null);
    const input = buildSpecialJsonInput(editX, editY, originalValue);
    if (!input) return;
    repo.saveOverrideLocal(input);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  function buildSpecialJsonInput(
    x: number, y: number,
    original: { x: number; y: number } | null
  ): SpecialArrowPlacementInput | null {
    const motion = stepData.motions?.[color];
    if (!motion || !stepData.letter) return null;

    let oriFolder: string;
    let turnsTuple: string;
    let gridMode: string;

    if (diagnostics?.specialJson) {
      oriFolder = extractOriFolderFromPath(diagnostics.specialJson.filePath);
      turnsTuple = diagnostics.specialJson.turnsTupleKey;
      gridMode = motion.gridMode || "diamond";
    } else {
      const pictographData: PictographData = {
        id: stepData.id,
        letter: stepData.letter,
        startPosition: stepData.startPosition,
        endPosition: stepData.endPosition,
        motions: stepData.motions as PictographData["motions"],
      };
      const rawOriKey = generateOrientationKey(motion, pictographData);
      oriFolder = resolveEffectiveOriKey(rawOriKey, pictographData);
      const turnsTupleArr = generateTurnsTuple(pictographData);
      turnsTuple = turnsTupleArr.join(",");
      gridMode = motion.gridMode || (stepData.motions.blue && stepData.motions.red
        ? _deriveGridMode(stepData.motions.blue, stepData.motions.red) : "diamond");
    }

    return {
      gridMode,
      oriFolder,
      letter: stepData.letter,
      turnsTuple,
      motionType: motion.motionType?.toLowerCase() || "",
      adjustmentX: x,
      adjustmentY: y,
      originalX: original?.x ?? 0,
      originalY: original?.y ?? 0,
    };
  }

  async function handleSpecialJsonSave() {
    const repo = getSpecialOverrideRepository();
    if (!repo || !specialOverrideKey) return;
    const originalValue = diagnostics?.specialJson?.firestoreOverride?.original
      ?? (diagnostics?.specialJson && !diagnostics.specialJson.firestoreOverride
        ? diagnostics.specialJson.value : null);
    const input = buildSpecialJsonInput(editX, editY, originalValue);
    if (!input) return;
    try {
      saveState = "saving";
      await repo.saveOverride(input);
      saveState = "saved";
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Special JSON save failed:", error);
      saveState = "idle";
    }
  }

  async function handleSpecialJsonDelete() {
    const repo = getSpecialOverrideRepository();
    if (!repo || !specialOverrideKey) return;
    try {
      repo.deleteOverrideLocal(specialOverrideKey);
      await repo.deleteOverride(specialOverrideKey);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Special JSON delete failed:", error);
    }
  }

  function buildPropGeometryInput(x: number, y: number) {
    if (!propGeometryKey) return null;
    return { ...propGeometryKey, adjustmentX: x, adjustmentY: y };
  }

  function handlePropGeometryNumericUpdate() {
    const repo = getPropGeometryRepository();
    const input = buildPropGeometryInput(editX, editY);
    if (!repo || !input) return;
    repo.saveAdjustmentLocal(input);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  async function handlePropGeometrySave() {
    const repo = getPropGeometryRepository();
    const input = buildPropGeometryInput(editX, editY);
    if (!repo || !input) return;
    try {
      saveState = "saving";
      await repo.saveAdjustment(input);
      saveState = "saved";
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Prop geometry save failed:", error);
      saveState = "idle";
    }
  }

  async function handlePropGeometryDelete() {
    const repo = getPropGeometryRepository();
    if (!repo || !propGeometryKey) return;
    try {
      repo.deleteAdjustmentLocal(propGeometryKey);
      await repo.deleteAdjustment(propGeometryKey);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Prop geometry delete failed:", error);
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
      {@const isEditable = tier === "global" || tier === "special-json" || tier === "prop-geometry"}
      {@const isEditTarget = isEditing && editTarget === tier}
      <button
        class="tier-row"
        class:active={isActive}
        class:has-value={info != null}
        class:edit-target={isEditTarget}
        class:editable={isEditing && isEditable}
        style="--tier-color: {tierColor(tier)}"
        onclick={() => {
          if (isEditing && isEditable) {
            selectEditTarget(tier as "global" | "special-json" | "prop-geometry");
          }
        }}
        disabled={!isEditing || !isEditable}
      >
        <span class="tier-icon">
          {#if isActive}
            <i class="fas fa-star" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-circle" aria-hidden="true"></i>
          {/if}
        </span>
        <span class="tier-name">{tierLabel(tier)}</span>
        {#if tier === "special-json" && diagnostics.specialJson?.firestoreOverride}
          <span class="tier-badge">(override)</span>
        {/if}
        {#if detail}
          <span class="tier-detail">{detail}</span>
        {/if}
        <span class="tier-value" class:none={!info}>
          {info ? formatValue(info.value) : "none"}
        </span>
      </button>

      {#if tier === "special-json" && diagnostics.specialJson?.firestoreOverride?.original}
        <div class="original-row">
          <span class="original-icon">└</span>
          <span class="original-label">original</span>
          <span class="original-value">
            {formatValue(diagnostics.specialJson.firestoreOverride.original)}
          </span>
        </div>
      {/if}
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

  <!-- Inline WASD Editor — compact control bar, not a tall tower -->
  {#if isEditing}
    <div class="editor-section">
      <div class="editor-head">
        <span class="editor-dot" style="background: {colorToken}"></span>
        <span class="editor-title">{colorName} · {tierLabel(editTarget)}</span>
        <button class="editor-x" onclick={toggleEditing} aria-label="Close editor" title="Close editor">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      {#if editTarget === "global"}
        <LayerTabBar
          {activeLayer}
          onLayerChange={handleLayerChange}
          {layer1HasValue}
          {layer2HasValue}
          {layer3HasValue}
          {thisPropType}
          {otherPropType}
        />
      {/if}

      <div class="editor-row">
        <div class="editor-values">
          <label class="editor-input-label">
            X
            <input
              type="number"
              class="editor-input"
              bind:value={editX}
              onchange={handleNumericChange}
            />
          </label>
          <label class="editor-input-label">
            Y
            <input
              type="number"
              class="editor-input"
              bind:value={editY}
              onchange={handleNumericChange}
            />
          </label>
        </div>

        <div class="editor-actions">
          {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
            <button class="btn btn-delete" onclick={handleDelete} title="Revert to original">
              <i class="fas fa-undo" aria-hidden="true"></i> Revert
            </button>
          {:else if editTarget === "prop-geometry" && propGeometryHasValue}
            <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete prop geometry adjustment" title="Delete prop geometry adjustment">
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
            </button>
          {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
            <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete at this layer" title="Delete at this layer">
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
            </button>
          {/if}
          <button
            class="btn btn-save"
            onclick={handleSave}
            disabled={!hasLocalChanges && !(editTarget === "global" && currentLayerValue)}
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

      <div class="editor-foot">
        <span class="editor-hint">
          <kbd>W A S D</kbd> move · Shift ×4 · Ctrl+Shift ×40 · live preview
        </span>
        {#if hasLocalChanges}
          <span class="editor-unsaved"><i class="fas fa-circle" aria-hidden="true"></i> Unsaved</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .pipeline-trace {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .trace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .trace-header h4 {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .edit-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 36px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    font-family: inherit;
    transition: border-color var(--duration-fast, 0.15s) ease;
  }
  .edit-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }
  .edit-toggle.active {
    background: color-mix(in srgb, var(--theme-accent, #58a6ff) 14%, transparent);
    border-color: var(--theme-accent, #58a6ff);
    color: var(--theme-accent, #58a6ff);
  }
  .tier-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    min-height: 44px;
    border-radius: 14px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
    width: 100%;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    cursor: default;
    text-align: left;
    font-family: inherit;
    margin-bottom: 10px;
    transition: border-color var(--duration-fast, 0.15s) ease;
  }
  .tier-row.editable { cursor: pointer; }
  .tier-row.editable:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)); }
  .tier-row.edit-target {
    border: 2px solid var(--theme-accent, #58a6ff);
    background: color-mix(in srgb, var(--theme-accent, #58a6ff) 12%, transparent);
  }
  .tier-row:disabled {
    border-style: dashed;
    opacity: 0.6;
    cursor: default;
  }
  .tier-icon {
    width: 14px;
    text-align: center;
    font-size: 11px;
    color: var(--tier-color);
    flex: none;
  }
  .tier-name {
    font-weight: 600;
    min-width: 110px;
    font-size: var(--font-size-min, 14px);
  }
  .tier-detail {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }
  .tier-value {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #fff);
  }
  .tier-value.none {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-style: italic;
  }
  .tier-badge {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-accent, #a78bfa);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .original-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 16px 8px 30px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .original-value {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    text-decoration: line-through;
  }
  .summary-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 0;
    margin-top: 4px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
  .summary-value {
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #fff);
    font-weight: 600;
  }
  .summary-arrow { color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); }
  .loading {
    padding: 12px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
  }
  .editor-section {
    margin-top: 12px;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--theme-accent, #58a6ff) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #58a6ff) 35%, transparent);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .editor-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .editor-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
  }
  .editor-title {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .editor-x {
    flex: none;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
  }
  .editor-x:hover {
    color: var(--theme-text, #fff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }
  /* Values + actions share one row so the editor stays a short control bar. */
  .editor-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }
  .editor-values {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  .editor-input-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }
  .editor-input {
    width: 72px;
    padding: 6px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    font-size: 18px;
    font-weight: 700;
    text-align: center;
  }
  .editor-input:focus {
    outline: none;
    border-color: var(--theme-accent, #58a6ff);
  }
  .editor-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .editor-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }
  .editor-hint kbd {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    padding: 3px 9px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }
  .editor-unsaved {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
  }
  .editor-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .btn {
    padding: 10px 18px;
    min-height: 40px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
  }
  .btn.icon-only {
    padding: 10px 12px;
  }
  .btn-delete {
    background: transparent;
    color: var(--semantic-error, #f85149);
    border-color: color-mix(in srgb, var(--semantic-error, #f85149) 40%, transparent);
  }
  .btn-save {
    background: var(--semantic-success, #238636);
    color: #fff;
    border-color: var(--semantic-success, #238636);
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (prefers-reduced-motion: reduce) {
    .tier-row, .edit-toggle, .btn { transition: none; }
  }
</style>
