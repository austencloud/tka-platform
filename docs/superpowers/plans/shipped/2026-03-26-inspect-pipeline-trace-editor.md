# Inspect Tab Pipeline Trace + WASD Editor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Inspect modal show which pipeline tier is active for each arrow, what values each tier has, and let you WASD-edit at any Global Adjustment layer directly from the modal.

**Architecture:** Add a diagnostics method to `ArrowAdjustmentCalculator` that probes all 4 tiers without short-circuiting. Surface this in a new `PipelineTraceSection` component inside each `MotionColumn`. Embed the existing `LayerTabBar` + WASD editing logic (from `ArrowLayerModal`) inline so the modal becomes the single power-user tool for understanding and fixing arrow positions.

**Tech Stack:** Svelte 5 (runes), TypeScript, existing ArrowAdjustmentOrchestrator + GlobalArrowAdjustmentRepository

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts` | Create | Type definitions for diagnostics data |
| `src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts` | Modify | Add `getDiagnostics()` method |
| `src/lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowAdjustmentCalculator.ts` | Modify | Add `getDiagnostics()` to interface |
| `src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer.ts` | Modify | Add `getSpecialJsonAdjustmentOnly()` (skips global overrides) |
| `src/lib/shared/pictograph/arrow/positioning/placement/services/contracts/ISpecialPlacer.ts` | Modify | Add new method to interface |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte` | Create | Pipeline trace display + inline WASD editor |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte` | Modify | Add PipelineTraceSection below arrow placement data |
| `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte` | Modify | Calculate diagnostics, pass to MotionColumns, handle editing state |

---

## Task 1: Define PipelineDiagnostics Types

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts

/**
 * PipelineDiagnostics
 *
 * Rich metadata about which tier of the arrow positioning pipeline
 * produced the final adjustment, and what values each tier has.
 *
 * Tier priority (first match wins):
 * 1. Global Override (Firestore) - cascading Layer 3 -> 2 -> 1
 * 2. Special Placement JSON (static per-letter files)
 * 3. Prop Geometry (letter-free, prop-aware)
 * 4. Default Placement (motion-type only)
 */

export type PipelineTier = "global" | "special-json" | "prop-geometry" | "default";

export interface TierValue {
  x: number;
  y: number;
}

export interface GlobalTierInfo {
  value: TierValue;
  layer: 1 | 2 | 3;
}

export interface SpecialJsonTierInfo {
  value: TierValue;
  /** e.g. "diamond/special/from_layer1/H_placements.json" */
  filePath: string;
  /** e.g. "(2.5, 2.5)" */
  turnsTupleKey: string;
}

export interface PropGeometryTierInfo {
  value: TierValue;
}

export interface DefaultTierInfo {
  value: TierValue;
}

export interface PipelineDiagnostics {
  /** Which tier produced the final base adjustment */
  activeTier: PipelineTier;

  /** Values at each tier (null = no value found at that tier) */
  global: GlobalTierInfo | null;
  specialJson: SpecialJsonTierInfo | null;
  propGeometry: PropGeometryTierInfo | null;
  default: DefaultTierInfo | null;

  /** The raw base adjustment from the winning tier (before directional rotation) */
  baseAdjustment: TierValue;

  /** The final adjustment after directional tuple rotation */
  finalAdjustment: TierValue;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts
git commit -m "feat(inspect): add PipelineDiagnostics type definitions"
```

---

## Task 2: Add Raw JSON Lookup to SpecialPlacer

The existing `getSpecialAdjustment()` checks global overrides first and short-circuits. We need a method that only checks the static JSON files, so diagnostics can show the JSON value independently.

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/placement/services/contracts/ISpecialPlacer.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer.ts`

- [ ] **Step 1: Add method to ISpecialPlacer interface**

In `ISpecialPlacer.ts`, add after `hasRotationAngleOverride`:

```typescript
  /**
   * Get the special adjustment from static JSON only (no global overrides).
   * Used by diagnostics to show what the JSON file contains independently.
   * Returns the raw value plus the file path and turns tuple key for display.
   */
  getSpecialJsonAdjustmentOnly(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<{ adjustment: Point; filePath: string; turnsTupleKey: string } | null>;
```

- [ ] **Step 2: Implement in SpecialPlacer.ts**

Add this method to the `SpecialPlacer` class (after `hasRotationAngleOverride`):

```typescript
  async getSpecialJsonAdjustmentOnly(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<{ adjustment: FabricPoint; filePath: string; turnsTupleKey: string } | null> {
    if (!motionData || !pictographData.letter) {
      return null;
    }

    const letter = pictographData.letter;
    const oriKey = this.oriKeyGenerator.generateOrientationKey(motionData, pictographData);
    const gridMode = this.getGridMode(pictographData);
    const turnsTuple = this.tupleGenerator.generateTurnsTuple(pictographData);

    // Load letter data from static JSON (skip global overrides entirely)
    const letterData = await this.dataService.getLetterData(gridMode, oriKey, letter);
    if (!letterData || Object.keys(letterData).length === 0) {
      return null;
    }

    const adjustment = this.lookupService.lookupAdjustment(
      letterData,
      turnsTuple,
      motionData,
      pictographData,
      arrowColor,
      attributeKey
    );

    if (!adjustment) return null;

    const filePath = `${gridMode}/special/${oriKey}/${letter}_placements.json`;
    const turnsTupleKey = turnsTuple;

    return { adjustment, filePath, turnsTupleKey };
  }
```

- [ ] **Step 3: Verify build**

```bash
npm run check
```

Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/placement/services/contracts/ISpecialPlacer.ts
git add src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacer.ts
git commit -m "feat(inspect): add getSpecialJsonAdjustmentOnly to SpecialPlacer"
```

---

## Task 3: Add getDiagnostics() to ArrowAdjustmentCalculator

This probes all 4 tiers without short-circuiting, so we know what each tier has regardless of which one wins.

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowAdjustmentCalculator.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts`

- [ ] **Step 1: Add to interface**

In `IArrowAdjustmentCalculator.ts`, add the import and method:

```typescript
import type { PipelineDiagnostics } from "../../domain/PipelineDiagnostics";

// Add to interface:
  /**
   * Get full pipeline diagnostics showing which tier is active
   * and what values each tier has (probes all tiers, no short-circuit).
   */
  getDiagnostics(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<PipelineDiagnostics>;
```

- [ ] **Step 2: Implement getDiagnostics on ArrowAdjustmentCalculator**

Add this method to the class:

```typescript
  async getDiagnostics(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<PipelineDiagnostics> {
    const diagnostics: PipelineDiagnostics = {
      activeTier: "default",
      global: null,
      specialJson: null,
      propGeometry: null,
      default: null,
      baseAdjustment: { x: 0, y: 0 },
      finalAdjustment: { x: 0, y: 0 },
    };

    // Probe Tier 1: Global Adjustment (Firestore overrides)
    const globalResult = this.probeGlobalAdjustment(pictographData, motionData, arrowColor);
    if (globalResult) {
      diagnostics.global = globalResult;
    }

    // Probe Tier 2: Special Placement JSON (static files)
    if (letter) {
      const specialResult = await this.probeSpecialJsonAdjustment(
        motionData, pictographData, arrowColor
      );
      if (specialResult) {
        diagnostics.specialJson = specialResult;
      }
    }

    // Probe Tier 3: Prop Geometry
    const propGeoResult = this.lookupPropGeometryAdjustment(pictographData, motionData, arrowColor);
    if (propGeoResult) {
      diagnostics.propGeometry = { value: { x: propGeoResult.x, y: propGeoResult.y } };
    }

    // Probe Tier 4: Default (always has a value)
    try {
      const defaultResult = await this.calculateDefaultAdjustment(motionData, pictographData);
      diagnostics.default = { value: { x: defaultResult.x, y: defaultResult.y } };
    } catch {
      // Default can fail for exotic motion types; leave null
    }

    // Determine active tier (same priority as getBaseAdjustment)
    let baseAdj: { x: number; y: number } = { x: 0, y: 0 };

    if (diagnostics.global) {
      diagnostics.activeTier = "global";
      baseAdj = diagnostics.global.value;
    } else if (diagnostics.specialJson) {
      diagnostics.activeTier = "special-json";
      baseAdj = diagnostics.specialJson.value;
    } else if (diagnostics.propGeometry) {
      diagnostics.activeTier = "prop-geometry";
      baseAdj = diagnostics.propGeometry.value;
    } else if (diagnostics.default) {
      diagnostics.activeTier = "default";
      baseAdj = diagnostics.default.value;
    }

    diagnostics.baseAdjustment = baseAdj;

    // Calculate final adjustment via directional tuple rotation
    const basePoint = new Point(baseAdj.x, baseAdj.y);
    const finalPoint = this.tupleProcessor.processDirectionalTuples(
      basePoint, motionData, location
    );
    diagnostics.finalAdjustment = { x: finalPoint.x, y: finalPoint.y };

    return diagnostics;
  }

  /**
   * Probe global adjustment tier without affecting the main pipeline.
   */
  private probeGlobalAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    arrowColor?: string
  ): GlobalTierInfo | null {
    const repo = getGlobalAdjustmentRepository();
    if (!repo?.isInitialized) return null;

    const oriKey = this.orientationKeyService.generateOrientationKey(motionData, pictographData);
    const gridMode = motionData.gridMode ||
      (pictographData.motions.blue && pictographData.motions.red
        ? this.gridModeService.deriveGridMode(pictographData.motions.blue, pictographData.motions.red)
        : "diamond");
    const turnsTuple = this.turnsTupleService.generateTurnsTuple(pictographData);
    const arrowKey = arrowColor || motionData.color || "blue";

    const thisPropType = motionData.propType?.toLowerCase() || "staff";
    const otherColor = arrowKey === "blue" ? "red" : "blue";
    const otherMotion = pictographData.motions?.[otherColor];
    const otherPropType = otherMotion?.propType?.toLowerCase() || "staff";

    const baseKey = { gridMode, oriKey, letter: pictographData.letter || "", turnsTuple, arrowKey };
    const cascadingResult = repo.getAdjustmentCascading(baseKey, thisPropType, otherPropType);

    if (cascadingResult) {
      return {
        value: { x: cascadingResult.adjustment.x, y: cascadingResult.adjustment.y },
        layer: cascadingResult.layer as 1 | 2 | 3,
      };
    }

    return null;
  }

  /**
   * Probe special JSON tier (skips global overrides).
   */
  private async probeSpecialJsonAdjustment(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string
  ): Promise<SpecialJsonTierInfo | null> {
    const [, , attrKey] = this.generateLookupKeys(pictographData, motionData);

    const result = await this.SpecialPlacer.getSpecialJsonAdjustmentOnly(
      motionData, pictographData, arrowColor, attrKey
    );

    if (result) {
      return {
        value: { x: result.adjustment.x, y: result.adjustment.y },
        filePath: result.filePath,
        turnsTupleKey: result.turnsTupleKey,
      };
    }

    return null;
  }
```

Add these imports at top of file:

```typescript
import type {
  PipelineDiagnostics,
  GlobalTierInfo,
  SpecialJsonTierInfo,
} from "../../domain/PipelineDiagnostics";
import { getGlobalAdjustmentRepository } from "../../../global/services/global-adjustment-singleton";
```

**IMPORTANT:** The `probeGlobalAdjustment()` method uses this static import, NOT `require()`. This is an ESM codebase.

- [ ] **Step 3: Verify build**

```bash
npm run check
```

Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowAdjustmentCalculator.ts
git add src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts
git commit -m "feat(inspect): add getDiagnostics() to ArrowAdjustmentCalculator"
```

---

## Task 4: Create PipelineTraceSection Component

The main UI component. Shows all 4 tiers with values, highlights the active one. Has an "Edit" toggle that activates the layer tab bar + WASD controls.

**Files:**
- Create: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  PipelineTraceSection.svelte

  Shows the full arrow positioning pipeline trace for one motion.
  Displays all 4 tiers with their values, highlights the active tier.
  Optional inline WASD editor for Global Adjustment layers.
-->
<script lang="ts">
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

    const haptic = container.items.hapticFeedback;
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
      const haptic = container.items.hapticFeedback;
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
      const haptic = container.items.hapticFeedback;
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
    max-width: 100px;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte
git commit -m "feat(inspect): create PipelineTraceSection component with WASD editor"
```

---

## Task 5: Integrate Into MotionColumn

Pass diagnostics to MotionColumn and render the PipelineTraceSection.

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte`

- [ ] **Step 1: Update MotionColumn props and template**

Add to the `<script>` section — new imports and props:

```typescript
  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import type { StepData } from "../../../domain/models/StepData";
  import PipelineTraceSection from "./PipelineTraceSection.svelte";
```

Update the Props interface to add:

```typescript
    diagnostics: PipelineDiagnostics | null;
    stepData: StepData;
    onDiagnosticsChanged?: () => void;
```

Update the destructuring to include the new props.

In the template, after the closing `</div>` of the `subsection` (arrow placement), add:

```svelte
    <PipelineTraceSection
      {diagnostics}
      {color}
      {stepData}
      {onDiagnosticsChanged}
      bind:this={pipelineTraceRef}
    />
```

Add a component reference:

```typescript
  let pipelineTraceRef: PipelineTraceSection | undefined = $state();
```

Export the keydown handler so the parent can delegate:

```typescript
  export function handleWASDKeydown(event: KeyboardEvent): boolean {
    return pipelineTraceRef?.handleKeydown(event) ?? false;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/MotionColumn.svelte
git commit -m "feat(inspect): integrate PipelineTraceSection into MotionColumn"
```

---

## Task 6: Wire Up Diagnostics and Keyboard in PictographInspectModal

Calculate diagnostics for both motions when the modal opens, and route WASD keydowns to the active editor.

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte`

- [ ] **Step 1: Add diagnostics calculation**

Add imports:

```typescript
  import type { PipelineDiagnostics } from "$lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics";
  import { arrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator";
  import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowLocationCalculator";
```

Add state:

```typescript
  let blueDiagnostics = $state<PipelineDiagnostics | null>(null);
  let redDiagnostics = $state<PipelineDiagnostics | null>(null);
  let blueMotionColumnRef: MotionColumn | undefined = $state();
  let redMotionColumnRef: MotionColumn | undefined = $state();
```

Add diagnostics calculation function (called after `calculateArrowPositions` succeeds):

```typescript
  async function calculateDiagnostics(pictographData: PictographData) {
    const blueMotionData = pictographData.motions?.[MotionColor.BLUE];
    const redMotionData = pictographData.motions?.[MotionColor.RED];

    if (blueMotionData) {
      try {
        const location = arrowLocationCalculator.calculateLocation(blueMotionData, pictographData);
        blueDiagnostics = await arrowAdjustmentCalculator.getDiagnostics(
          pictographData, blueMotionData, pictographData.letter || "", location, "blue"
        );
      } catch (err) {
        console.error("Blue diagnostics failed:", err);
        blueDiagnostics = null;
      }
    }

    if (redMotionData) {
      try {
        const location = arrowLocationCalculator.calculateLocation(redMotionData, pictographData);
        redDiagnostics = await arrowAdjustmentCalculator.getDiagnostics(
          pictographData, redMotionData, pictographData.letter || "", location, "red"
        );
      } catch (err) {
        console.error("Red diagnostics failed:", err);
        redDiagnostics = null;
      }
    }
  }
```

Call it at the end of the `try` block in `calculateArrowPositions()`, after `calculateLookupKeys`:

```typescript
      await calculateDiagnostics(pictographData);
```

Add a refresh function for when edits are saved:

```typescript
  async function refreshDiagnostics() {
    if (pictographDataState) {
      await calculateDiagnostics(pictographDataState);
    }
  }
```

Reset diagnostics when modal closes (in the `else if (!show)` block):

```typescript
      blueDiagnostics = null;
      redDiagnostics = null;
```

- [ ] **Step 2: Update keyboard handler to delegate WASD**

Update the `handleKeydown` function:

```typescript
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    // Delegate WASD to the active pipeline editor
    if (["w", "a", "s", "d"].includes(e.key.toLowerCase())) {
      const blueHandled = blueMotionColumnRef?.handleWASDKeydown(e);
      if (blueHandled) return;
      const redHandled = redMotionColumnRef?.handleWASDKeydown(e);
      if (redHandled) return;
    }
  }
```

- [ ] **Step 3: Update template to pass new props**

Note: The MotionColumn instances render inside the `{#if show && stepData}` guard, so `stepData` is guaranteed non-null at this point. Pass `stepData` directly (the `displayData` fallback already ensures it).

Update the MotionColumn usages:

```svelte
          <MotionColumn
            color="blue"
            motion={blueMotion}
            rotationOverride={blueRotationOverride}
            diagnostics={blueDiagnostics}
            {stepData}
            onDiagnosticsChanged={refreshDiagnostics}
            {copiedSection}
            onCopy={copyToClipboard}
            bind:this={blueMotionColumnRef}
          />

          <MotionColumn
            color="red"
            motion={redMotion}
            rotationOverride={redRotationOverride}
            diagnostics={redDiagnostics}
            {stepData}
            onDiagnosticsChanged={refreshDiagnostics}
            {copiedSection}
            onCopy={copyToClipboard}
            bind:this={redMotionColumnRef}
          />
```

- [ ] **Step 4: Verify build**

```bash
npm run check
```

Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/PictographInspectModal.svelte
git commit -m "feat(inspect): wire diagnostics + WASD keyboard routing in inspect modal"
```

---

## Task 7: Manual Verification

- [ ] **Step 1: Open the app, navigate to a sequence with arrows**

Use the user's dev server at localhost:5173. Go to the Create module, load a sequence.

- [ ] **Step 2: Open the Inspect modal**

Click the inspect icon on a beat. Verify:
- Pipeline trace section appears under each motion's arrow placement data
- Each tier shows its value or "none"
- The active tier has a green star icon
- The summary row shows base → rotated values

- [ ] **Step 3: Test the inline editor**

Click "Edit" on one motion's pipeline trace. Verify:
- Layer tab bar appears with L1/L2/L3
- WASD keys move the value (shown in the editor)
- The pictograph re-renders live as you nudge
- Save persists to Firestore
- Delete removes the override
- Closing the editor deactivates WASD capture

- [ ] **Step 4: Verify the specific H case from the original report**

Open the inspect modal on a beat with letter H (diamond, anti/anti, 2.5 turns). Verify:
- Pipeline trace shows Special JSON tier is active with `[-180, 65]` for blue
- No global override present (unless one was created)
- The file path shows `diamond/special/from_layer1/H_placements.json`

- [ ] **Step 5: Commit final verification**

If any fixes were needed during verification, commit them.
