<!--
  PipelineEditorDock.svelte

  Selection-driven footer editor for the PictographInspectModal. Relocates the
  arrow-adjustment editor out of the per-color PipelineTraceSection so columns
  stay fixed height and the modal never resizes. Binds to the global selected
  arrow; idle until an arrow is selected.
-->
<script lang="ts">
  import { getArrowAdjustmentOrchestrator } from "$lib/features/create/shared/get-arrow-adjustment-orchestrator";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type {
    PipelineDiagnostics,
    PipelineTier,
  } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type {
    ArrowAdjustmentOrchestrator,
    SelectedArrowContext,
  } from "../../../services/arrow-adjustment-orchestrator";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import LayerTabBar from "../../arrow-adjustment/LayerTabBar.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
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
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";

  const logger = createComponentLogger("PipelineEditorDock");

  interface Props {
    stepData: StepData;
    blueDiagnostics: PipelineDiagnostics | null;
    redDiagnostics: PipelineDiagnostics | null;
    onDiagnosticsChanged?: () => void;
  }
  let { stepData, blueDiagnostics, redDiagnostics, onDiagnosticsChanged }: Props = $props();

  // Selection-driven binding (live re-bind on color switch)
  const activeColor = $derived<"blue" | "red" | null>(
    (selectedArrowState.selectedArrow?.color as "blue" | "red" | undefined) ?? null
  );
  const diagnostics = $derived(activeColor === "red" ? redDiagnostics : blueDiagnostics);

  let editTarget = $state<"global" | "special-json" | "prop-geometry">("global");
  let editX = $state(0);
  let editY = $state(0);
  let activeLayer = $state<1 | 2 | 3>(2);
  let hasLocalChanges = $state(false);
  let saveState = $state<"idle" | "saving" | "saved">("idle");
  let orchestrator: ArrowAdjustmentOrchestrator | null = null;

  // Head identity derived
  const colorName = $derived(activeColor === "red" ? "Red" : "Blue");
  const colorToken = $derived(
    activeColor === "red" ? "var(--prop-red, #f85149)" : "var(--prop-blue, #58a6ff)"
  );
  const segColor = $derived<"blue" | "red">(activeColor === "red" ? "red" : "blue");
  const tierOptions = [
    { value: "global" as const, label: "Global" },
    { value: "special-json" as const, label: "Special JSON" },
    { value: "prop-geometry" as const, label: "Prop Geometry" },
  ];

  const selectedArrowContext = $derived.by((): SelectedArrowContext | null => {
    if (!activeColor) return null;
    const motion = stepData.motions?.[activeColor];
    if (!motion) return null;
    const pictographData: PictographData = {
      id: stepData.id,
      letter: stepData.letter ?? null,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as PictographData["motions"],
    };
    return { motionData: motion, color: activeColor, pictographData };
  });

  const thisPropType = $derived.by(() => {
    const settings = getSettings();
    const c = activeColor ?? "blue";
    const settingsPropType = c === "blue" ? settings.bluePropType : settings.redPropType;
    const motion = stepData.motions?.[c];
    return (settingsPropType ?? motion?.propType)?.toLowerCase() || "staff";
  });

  const otherPropType = $derived.by(() => {
    const settings = getSettings();
    const c = activeColor ?? "blue";
    const otherColor = c === "blue" ? "red" : "blue";
    const settingsPropType = otherColor === "blue" ? settings.bluePropType : settings.redPropType;
    const otherMotion = stepData.motions?.[otherColor];
    return (settingsPropType ?? otherMotion?.propType)?.toLowerCase() || "staff";
  });

  const specialOverrideKey = $derived.by((): string | null => {
    if (!diagnostics || !stepData.letter) return null;
    const motion = stepData.motions?.[activeColor ?? "blue"];
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
    const c = activeColor ?? "blue";
    const motion = stepData.motions?.[c];
    if (!motion) return null;
    const pictographData: PictographData = {
      id: stepData.id,
      letter: stepData.letter ?? null,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as PictographData["motions"],
    };
    return derivePropGeometryKey(pictographData, motion, c);
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

  function defaultEditTargetForActiveTier(): "global" | "special-json" | "prop-geometry" {
    const active = diagnostics?.activeTier;
    if (active === "special-json") return "special-json";
    if (active === "prop-geometry") return "prop-geometry";
    return "global";
  }

  // Re-bind on color switch (replaces old enterEditMode/toggleEditing).
  let lastBoundColor: "blue" | "red" | null = null;
  $effect(() => {
    const c = activeColor;
    if (c === lastBoundColor) return;
    lastBoundColor = c;
    if (!c) { saveState = "idle"; hasLocalChanges = false; return; }
    if (!orchestrator) orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
    activeLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
    editTarget = defaultEditTargetForActiveTier();
    hasLocalChanges = false;
    saveState = "idle";
    syncNumericInputs();
  });

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

  function handleKeydown(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      return false;
    if (!activeColor) return false;
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

  // Ctrl/Cmd+S anywhere (while the dock is active), or Enter inside the X/Y
  // inputs, commits the save. Returns true when it handled the event.
  function handleSaveHotkey(event: KeyboardEvent): boolean {
    const isSaveCombo =
      event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey);
    const target = event.target as HTMLElement;
    const isEnterInInput =
      event.key === "Enter" && target?.tagName === "INPUT";
    if (!isSaveCombo && !isEnterInInput) return false;
    event.preventDefault();
    const canSave =
      hasLocalChanges || (editTarget === "global" && !!currentLayerValue);
    if (canSave) handleSave();
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
    const motion = stepData.motions?.[activeColor ?? "blue"];
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

<svelte:window onkeydown={(e) => { if (!activeColor) return; if (handleSaveHotkey(e)) return; handleKeydown(e); }} />

<footer class="editor-dock" class:idle={!activeColor} style="--c: {colorToken}">
  {#if !activeColor}
    <span class="dock-idle"><i class="fas fa-hand-pointer" aria-hidden="true"></i> Select an arrow to adjust its position →</span>
  {:else}
    <div class="dock-head">
      <span class="dock-dot" style="background: {colorToken}"></span>
      <span class="dock-title">{colorName} · {tierLabel(editTarget)}</span>
    </div>

    <div class="dock-tier">
      <SegmentedControl options={tierOptions} value={editTarget} onchange={selectEditTarget} color={segColor} size="sm" />
    </div>

    {#if editTarget === "global"}
      <LayerTabBar {activeLayer} onLayerChange={handleLayerChange} {layer1HasValue} {layer2HasValue} {layer3HasValue} {thisPropType} {otherPropType} />
    {/if}

    <div class="dock-vals">
      <label class="dock-input-label">X<input type="number" class="dock-input" bind:value={editX} onchange={handleNumericChange} /></label>
      <label class="dock-input-label">Y<input type="number" class="dock-input" bind:value={editY} onchange={handleNumericChange} /></label>
    </div>

    <span class="dock-hint"><kbd>W A S D</kbd> move · Shift ×4 · Ctrl+Shift ×40 · <kbd>Ctrl+S</kbd> save · live preview
      {#if hasLocalChanges}<span class="dock-unsaved"><i class="fas fa-circle" aria-hidden="true"></i> Unsaved</span>{/if}
    </span>

    <div class="dock-actions">
      {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
        <button class="btn btn-delete" onclick={handleDelete} title="Revert to original"><i class="fas fa-undo" aria-hidden="true"></i> Revert</button>
      {:else if editTarget === "prop-geometry" && propGeometryHasValue}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete prop geometry adjustment" title="Delete prop geometry adjustment"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete at this layer" title="Delete at this layer"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {/if}
      <button class="btn btn-save" onclick={handleSave} disabled={!hasLocalChanges && !(editTarget === "global" && currentLayerValue)}>
        {#if saveState === "saving"}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{:else if saveState === "saved"}<i class="fas fa-check" aria-hidden="true"></i>{:else}<i class="fas fa-save" aria-hidden="true"></i>{/if}
        Save
      </button>
    </div>
  {/if}
</footer>

<style>
  .editor-dock {
    flex: none;
    min-height: 76px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 12px 18px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--c, #58a6ff) 8%, var(--theme-panel-bg, rgba(13, 17, 23, 0.98)));
  }
  .editor-dock.idle { background: var(--theme-panel-bg, rgba(13, 17, 23, 0.98)); }
  .dock-idle { display: flex; align-items: center; gap: 8px; color: var(--theme-text-dim, rgba(255,255,255,0.5)); font-size: var(--font-size-min, 14px); }
  .dock-head { display: flex; align-items: center; gap: 8px; }
  .dock-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .dock-title { font-size: var(--font-size-min, 14px); font-weight: 700; white-space: nowrap; color: var(--theme-text, #fff); }
  .dock-tier { min-width: 340px; }
  .dock-vals { display: flex; gap: 12px; }
  .dock-input-label { display: flex; align-items: center; gap: 6px; color: var(--theme-text-dim, rgba(255,255,255,0.6)); font-size: var(--font-size-min, 14px); font-weight: 600; }
  .dock-input {
    width: 76px; min-height: var(--min-touch-target, 44px); padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15)); border-radius: 10px;
    background: rgba(0,0,0,0.25); color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 700; text-align: center;
  }
  .dock-input:focus { outline: none; border-color: var(--theme-accent, #58a6ff); }
  .dock-hint { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-compact, 12px); color: var(--theme-text-dim, rgba(255,255,255,0.55)); }
  .dock-hint kbd { background: var(--theme-card-bg, rgba(255,255,255,0.1)); border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15)); border-radius: 6px; padding: 3px 9px; font-size: var(--font-size-compact, 12px); font-weight: 700; }
  .dock-unsaved { display: flex; align-items: center; gap: 6px; color: var(--semantic-warning, #f59e0b); }
  .dock-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .btn {
    min-height: var(--min-touch-target, 44px); padding: 0 20px; border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.15)); font-size: var(--font-size-min, 14px);
    font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit;
  }
  .btn.icon-only { width: var(--min-touch-target, 44px); padding: 0; }
  .btn-delete { background: transparent; color: var(--semantic-error, #f85149); border-color: color-mix(in srgb, var(--semantic-error, #f85149) 40%, transparent); }
  .btn-save { background: var(--semantic-success, #238636); color: #fff; border-color: var(--semantic-success, #238636); }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
</style>
