# Trail Point Assignments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users assign up to 2 trail endpoints per prop type, sourced from existing tip points or custom positions, fixing wrong trail positions on asymmetrical props like Big Hoop.

**Architecture:** Trail assignments are stored alongside tip point overrides in the same Firestore document and localStorage cache. A new override provider callback (same pattern as `setTipPointOverrideProvider`) injects trail assignments into `PropPositionCalculator` without circular dependencies. The UI is a new section in the existing Tip Points tab.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, Firebase Firestore, localStorage

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts` | `TrailPointConfig`, `TrailPointSource` types + override provider callback |
| Create | `src/lib/features/effects-lab/components/TrailPointAssignmentSection.svelte` | UI section with left/right dropdowns + custom dx/dy inputs |
| Modify | `src/lib/features/effects-lab/services/contracts/IEffectPointOverrideProvider.ts` | Add trail assignment get/save methods |
| Modify | `src/lib/features/effects-lab/services/implementations/TipPointOverrideProvider.ts` | Implement trail assignment storage |
| Modify | `src/lib/features/effects-lab/services/contracts/IEffectPointsPersister.ts` | Add trail assignment persistence methods |
| Modify | `src/lib/features/effects-lab/services/implementations/EffectPointsPersister.ts` | Persist trail assignments in Firestore alongside tip points |
| Modify | `src/lib/features/effects-lab/state/effect-point-editor-state.svelte.ts` | Expose trail assignment state for current prop |
| Modify | `src/lib/shared/di/containers/effects-lab-container.ts` | Wire trail assignment override provider |
| Modify | `src/lib/shared/animation-engine/services/contracts/IPropPositionCalculator.ts` | Add trail config to signatures |
| Modify | `src/lib/shared/animation-engine/services/implementations/PropPositionCalculator.ts` | Resolve trail assignments in endpoint calculations |
| Modify | `src/lib/features/effects-lab/components/EffectPointListPanel.svelte` | Add TrailPointAssignmentSection below Actions |

---

## Chunk 1: Types, Persistence, and Provider

### Task 1: Create TrailPointTypes.ts

**Files:**
- Create: `src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts

/**
 * Trail Point Assignment Types
 *
 * Each prop type can have up to 2 trail endpoints (left, right), each
 * sourced from an existing tip point, a custom position, or disabled.
 * This lets users fix wrong trail positions on asymmetrical props
 * (e.g. Big Hoop) by pointing trails at specific tip points.
 */

/**
 * Where a single trail endpoint gets its position from.
 * - "none": no trail from this end
 * - "tip": use the tip point at `index` from the unified getTipPoints() registry
 * - "custom": manual dx/dy offset from prop center (same coordinate space as tip points)
 */
export type TrailPointSource =
  | { type: "none" }
  | { type: "tip"; index: number }
  | { type: "custom"; dx: number; dy: number };

/**
 * Trail endpoint configuration for a prop type.
 * Left = endType 0 in PropPositionCalculator.
 * Right = endType 1 (tip end).
 */
export interface TrailPointConfig {
  left: TrailPointSource;
  right: TrailPointSource;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type TrailPointOverrideFn = (propType: string) => TrailPointConfig | null;
let trailPointOverrideProvider: TrailPointOverrideFn | null = null;

/**
 * Register a callback that can supply custom trail point assignments for a prop type.
 * Called by the effects-lab DI container at startup.
 * Pass null to remove the override provider.
 */
export function setTrailPointOverrideProvider(
  provider: TrailPointOverrideFn | null
): void {
  trailPointOverrideProvider = provider;
}

/**
 * Look up trail point assignment for a prop type.
 * Returns null if no assignment exists (caller should use geometric fallback).
 */
export function getTrailPointConfig(
  propType: string | null | undefined
): TrailPointConfig | null {
  if (!propType) return null;
  const key = propType.toLowerCase();
  return trailPointOverrideProvider?.(key) ?? null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts
git commit -m "feat(trails): add TrailPointConfig and TrailPointSource types"
```

---

### Task 2: Add trail assignment persistence to IEffectPointsPersister

**Files:**
- Modify: `src/lib/features/effects-lab/services/contracts/IEffectPointsPersister.ts`

- [ ] **Step 1: Add trail assignment methods to the interface**

Add these imports and methods to `IEffectPointsPersister`:

```typescript
// Add import at top:
import type { TrailPointConfig } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

// Add to interface, after dispose():

/** Save trail point assignments for a prop type. localStorage immediate, Firestore debounced. */
saveTrailAssignment(propType: string, config: TrailPointConfig): void;

/** Get cached trail assignment for a prop type, or null if none stored. */
getTrailAssignment(propType: string): TrailPointConfig | null;

/** Get all prop types that have trail assignments. */
getTrailAssignmentTypes(): string[];

/** Remove trail assignment for a prop type, reverting to geometric fallback. */
removeTrailAssignment(propType: string): void;
```

- [ ] **Step 2: Verify it compiles (expect errors in EffectPointsPersister.ts — not yet implemented)**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -c "EffectPointsPersister"`
Expected: Implementation errors in `EffectPointsPersister.ts` only

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/effects-lab/services/contracts/IEffectPointsPersister.ts
git commit -m "feat(trails): add trail assignment methods to IEffectPointsPersister"
```

---

### Task 3: Implement trail assignment persistence in EffectPointsPersister

**Files:**
- Modify: `src/lib/features/effects-lab/services/implementations/EffectPointsPersister.ts`

The trail assignments are stored in the same Firestore document (`config/effectPoints`) under a `trailAssignments` key, and the same localStorage cache (`tka-effect-points-cache`).

Firestore doc shape after this change:
```
config/effectPoints {
  staff: [{dx, dy}, ...],        // tip points (existing)
  fan: [{dx, dy}, ...],
  trailAssignments: {            // NEW
    bighoop: { left: { type: "tip", index: 3 }, right: { type: "tip", index: 1 } },
    ...
  },
  updatedAt: Timestamp,
  updatedBy: uid
}
```

- [ ] **Step 1: Add trail assignment storage field**

Add after `private points: Record<string, EffectPoint[]> = {};` on line 39:

```typescript
private trailAssignments: Record<string, TrailPointConfig> = {};
```

Add import at top:
```typescript
import type { TrailPointConfig, TrailPointSource } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";
```

- [ ] **Step 2: Implement saveTrailAssignment**

Add after the `getPoints()` method (after line 107):

```typescript
// ------------------------------------------------------------------
// saveTrailAssignment()
// ------------------------------------------------------------------

saveTrailAssignment(propType: string, config: TrailPointConfig): void {
  const key = propType.toLowerCase();
  this.trailAssignments[key] = { left: { ...config.left }, right: { ...config.right } };

  this.writeLocalStorage();

  this.pendingWrites.add("__trailAssignments__");
  this.scheduleDebouncedWrite();
}
```

- [ ] **Step 3: Implement getTrailAssignment and getTrailAssignmentTypes**

Add after `saveTrailAssignment`:

```typescript
// ------------------------------------------------------------------
// getTrailAssignment()
// ------------------------------------------------------------------

getTrailAssignment(propType: string): TrailPointConfig | null {
  const key = propType.toLowerCase();
  return this.trailAssignments[key] ?? null;
}

// ------------------------------------------------------------------
// getTrailAssignmentTypes()
// ------------------------------------------------------------------

getTrailAssignmentTypes(): string[] {
  return Object.keys(this.trailAssignments);
}
```

- [ ] **Step 3b: Implement removeTrailAssignment**

Add after `getTrailAssignmentTypes`:

```typescript
// ------------------------------------------------------------------
// removeTrailAssignment()
// ------------------------------------------------------------------

removeTrailAssignment(propType: string): void {
  const key = propType.toLowerCase();
  delete this.trailAssignments[key];

  this.writeLocalStorage();

  this.pendingWrites.add("__trailAssignments__");
  this.scheduleDebouncedWrite();
}
```

- [ ] **Step 4: Update flushToFirestore to include trail assignments**

In the `flushToFirestore` method, modify the for-loop to skip the sentinel key, and add trail assignment writing after it:

```typescript
for (const key of keysToWrite) {
  // Skip internal sentinel — trail assignments handled below
  if (key === "__trailAssignments__") continue;
  const pts = this.points[key];
  if (pts) {
    update[key] = pts;
  }
}

if (keysToWrite.has("__trailAssignments__")) {
  update["trailAssignments"] = { ...this.trailAssignments };
}
```

- [ ] **Step 5: Update applyFirestoreData to parse trail assignments**

In `applyFirestoreData`, after `this.points = newPoints;` (line 248), add:

```typescript
// Parse trail assignments
const rawAssignments = data["trailAssignments"];
if (rawAssignments && typeof rawAssignments === "object") {
  const parsed: Record<string, TrailPointConfig> = {};
  for (const [key, value] of Object.entries(rawAssignments as Record<string, unknown>)) {
    const config = this.parseTrailAssignment(value);
    if (config) {
      parsed[key.toLowerCase()] = config;
    }
  }
  this.trailAssignments = parsed;
}
```

And skip the `trailAssignments` key in the tip points loop by adding to the `continue` condition:

```typescript
if (key === "updatedAt" || key === "updatedBy" || key === "trailAssignments") continue;
```

- [ ] **Step 6: Add parseTrailAssignment helper**

Add as a private method after `parsePointsArray`:

```typescript
private parseTrailAssignment(raw: unknown): TrailPointConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const left = this.parseTrailSource(obj.left);
  const right = this.parseTrailSource(obj.right);
  if (!left || !right) return null;
  return { left, right };
}

private parseTrailSource(raw: unknown): TrailPointSource | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (type === "none") return { type: "none" };
  if (type === "tip" && typeof obj.index === "number") return { type: "tip", index: obj.index };
  if (type === "custom" && typeof obj.dx === "number" && typeof obj.dy === "number") {
    return { type: "custom", dx: obj.dx, dy: obj.dy };
  }
  return null;
}
```

- [ ] **Step 7: Update readLocalStorage and writeLocalStorage**

In `writeLocalStorage`, change the serialized object to include trail assignments:

```typescript
private writeLocalStorage(): void {
  try {
    localStorage.setItem(
      LOCAL_CACHE_KEY,
      JSON.stringify({
        ...this.points,
        __trailAssignments__: this.trailAssignments,
      })
    );
  } catch {
    // localStorage might be full or unavailable
  }
}
```

In `readLocalStorage`, after parsing tip points, add trail assignment parsing:

```typescript
// After the for loop that populates `result`
const rawAssignments = parsed["__trailAssignments__"];
if (rawAssignments && typeof rawAssignments === "object") {
  const assignments: Record<string, TrailPointConfig> = {};
  for (const [key, value] of Object.entries(rawAssignments as Record<string, unknown>)) {
    const config = this.parseTrailAssignment(value);
    if (config) {
      assignments[key] = config;
    }
  }
  this.trailAssignments = assignments;
}
```

And skip the `__trailAssignments__` key in the tip points loop:

```typescript
// In the for loop: skip internal keys
if (key === "__trailAssignments__") continue;
```

- [ ] **Step 8: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (or only unrelated errors)

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/effects-lab/services/implementations/EffectPointsPersister.ts
git commit -m "feat(trails): implement trail assignment persistence in EffectPointsPersister"
```

---

### Task 4: Add trail assignment methods to IEffectPointOverrideProvider and TipPointOverrideProvider

**Files:**
- Modify: `src/lib/features/effects-lab/services/contracts/IEffectPointOverrideProvider.ts`
- Modify: `src/lib/features/effects-lab/services/implementations/TipPointOverrideProvider.ts`

- [ ] **Step 1: Add trail assignment methods to IEffectPointOverrideProvider**

Add import:
```typescript
import type { TrailPointConfig } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";
```

Add to interface after the user default methods:

```typescript
// --- Trail assignments ---

/** Get trail point assignment for a prop type, or null if using geometric fallback. */
getTrailAssignment(propType: string): TrailPointConfig | null;

/** Save trail point assignment for a prop type. */
saveTrailAssignment(propType: string, config: TrailPointConfig): void;

/** Get all prop types that have trail assignments. */
getTrailAssignmentTypes(): string[];

/** Remove trail point assignment for a prop type, reverting to geometric fallback. */
removeTrailAssignment(propType: string): void;
```

- [ ] **Step 2: Implement trail assignment methods in TipPointOverrideProvider**

Add import:
```typescript
import type { TrailPointConfig } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";
```

Add after `getUserDefaultTypes()` (before the `private isValidConfig` method):

```typescript
getTrailAssignment(propType: string): TrailPointConfig | null {
  const key = propType.toLowerCase();
  return this.persister.getTrailAssignment(key);
}

saveTrailAssignment(propType: string, config: TrailPointConfig): void {
  const key = propType.toLowerCase();
  this.persister.saveTrailAssignment(key, config);
}

getTrailAssignmentTypes(): string[] {
  return this.persister.getTrailAssignmentTypes();
}

removeTrailAssignment(propType: string): void {
  const key = propType.toLowerCase();
  this.persister.removeTrailAssignment(key);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/effects-lab/services/contracts/IEffectPointOverrideProvider.ts src/lib/features/effects-lab/services/implementations/TipPointOverrideProvider.ts
git commit -m "feat(trails): add trail assignment methods to override provider"
```

---

### Task 5: Wire trail assignment override provider in DI container

**Files:**
- Modify: `src/lib/shared/di/containers/effects-lab-container.ts`

- [ ] **Step 1: Import setTrailPointOverrideProvider**

Add import:
```typescript
import { setTrailPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";
```

- [ ] **Step 2: Register the trail override provider**

Inside the `tipPointOverrideProvider` factory function (around line 32, after the `setTipPointOverrideProvider` call), add:

```typescript
// Hook trail point assignments into the domain-level lookup
// so PropPositionCalculator can resolve trail configs without
// depending on the effects-lab feature layer
setTrailPointOverrideProvider((propType) => provider.getTrailAssignment(propType));
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/effects-lab-container.ts
git commit -m "feat(trails): wire trail assignment override provider in DI container"
```

---

## Chunk 2: PropPositionCalculator Integration

### Task 6: Update IPropPositionCalculator with trail config parameter

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IPropPositionCalculator.ts`

The approach: `calculateEndpoint` and `calculateEndpoints` already accept an optional `propType` parameter. Rather than changing their signatures, the calculator will internally call `getTrailPointConfig(propType)` to check for trail assignments. This means **zero changes to callers** — they already pass `propType`.

- [ ] **Step 1: No interface changes needed**

The calculator will use `getTrailPointConfig()` internally. The existing `propType` parameter is sufficient. No signature changes.

- [ ] **Step 2: Commit (skip — no changes)**

---

### Task 7: Update PropPositionCalculator to resolve trail assignments

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/PropPositionCalculator.ts`

- [ ] **Step 1: Add imports**

Add at top:
```typescript
import { getTrailPointConfig, type TrailPointSource } from "../../domain/types/TrailPointTypes";
import { getTipPoints } from "../../domain/types/PropTipPoints";
```

- [ ] **Step 2: Update calculateEndpoint to check trail assignments**

Replace the `calculateEndpoint` method with:

```typescript
calculateEndpoint(
  prop: PropState,
  config: PropEndpointConfig,
  endType: 0 | 1,
  propType?: string | null
): PropEndpointResult {
  const center = this.calculateCenter(prop, config);

  // Hand props return center as the endpoint (no staff to track)
  if (propType?.toLowerCase() === "hand") {
    return center;
  }

  // Check for trail point assignment override
  const trailConfig = getTrailPointConfig(propType);
  if (trailConfig) {
    const source = endType === 0 ? trailConfig.left : trailConfig.right;
    const resolved = this.resolveTrailSource(source, propType, config);
    if (resolved) {
      return {
        x: center.x + resolved.offsetX,
        y: center.y + resolved.offsetY,
      };
    }
    // source is "none" — return center (trail renderer should skip,
    // but returning center is a safe fallback)
    if (source.type === "none") {
      return center;
    }
  }

  // Geometric fallback: offset from center along rotation axis
  const gridScaleFactor = config.canvasSize / VIEWBOX_SIZE;
  const staffHalfWidth = (config.propDimensions.width / 2) * gridScaleFactor;
  const staffEndOffset = endType === 1 ? staffHalfWidth : -staffHalfWidth;

  return {
    x: center.x + Math.cos(prop.staffRotationAngle) * staffEndOffset,
    y: center.y + Math.sin(prop.staffRotationAngle) * staffEndOffset,
  };
}
```

- [ ] **Step 3: Update calculateEndpoints similarly**

Replace the `calculateEndpoints` method with:

```typescript
calculateEndpoints(
  prop: PropState,
  config: PropEndpointConfig,
  propType?: string | null
): PropEndpointPair {
  const center = this.calculateCenter(prop, config);

  // Hand props return center for both endpoints
  if (propType?.toLowerCase() === "hand") {
    return {
      left: { ...center },
      right: { ...center },
    };
  }

  // Check for trail point assignment override
  const trailConfig = getTrailPointConfig(propType);
  if (trailConfig) {
    const leftResolved = this.resolveTrailEndpoint(trailConfig.left, propType, config, center);
    const rightResolved = this.resolveTrailEndpoint(trailConfig.right, propType, config, center);
    return { left: leftResolved, right: rightResolved };
  }

  // Geometric fallback
  const gridScaleFactor = config.canvasSize / VIEWBOX_SIZE;
  const staffHalfWidth = (config.propDimensions.width / 2) * gridScaleFactor;

  const offsetX = Math.cos(prop.staffRotationAngle) * staffHalfWidth;
  const offsetY = Math.sin(prop.staffRotationAngle) * staffHalfWidth;

  return {
    left: {
      x: center.x - offsetX,
      y: center.y - offsetY,
    },
    right: {
      x: center.x + offsetX,
      y: center.y + offsetY,
    },
  };
}
```

- [ ] **Step 4: Add resolveTrailSource and resolveTrailEndpoint helpers**

Add as private methods at the end of the class:

```typescript
/**
 * Resolve a trail point source to an offset from center.
 * Returns null for "none" sources.
 */
private resolveTrailSource(
  source: TrailPointSource,
  propType: string | null | undefined,
  config: PropEndpointConfig
): { offsetX: number; offsetY: number } | null {
  if (source.type === "none") return null;

  const gridScaleFactor = config.canvasSize / VIEWBOX_SIZE;

  if (source.type === "tip") {
    // Look up the tip point's dx/dy from the unified registry
    const tipConfig = getTipPoints(propType);
    const tipPoint = tipConfig.points[source.index];
    if (!tipPoint) return null;
    return {
      offsetX: tipPoint.dx * gridScaleFactor,
      offsetY: tipPoint.dy * gridScaleFactor,
    };
  }

  if (source.type === "custom") {
    return {
      offsetX: source.dx * gridScaleFactor,
      offsetY: source.dy * gridScaleFactor,
    };
  }

  return null;
}

/**
 * Resolve a trail endpoint to a pixel position.
 * For "none" sources, returns center (trail renderer should skip).
 */
private resolveTrailEndpoint(
  source: TrailPointSource,
  propType: string | null | undefined,
  config: PropEndpointConfig,
  center: PropEndpointResult
): PropEndpointResult {
  const resolved = this.resolveTrailSource(source, propType, config);
  if (!resolved) return { ...center };
  return {
    x: center.x + resolved.offsetX,
    y: center.y + resolved.offsetY,
  };
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/PropPositionCalculator.ts
git commit -m "feat(trails): resolve trail point assignments in PropPositionCalculator"
```

---

## Chunk 3: Editor State and UI

### Task 8: Add trail assignment state to EffectPointEditorState

**Files:**
- Modify: `src/lib/features/effects-lab/state/effect-point-editor-state.svelte.ts`

- [ ] **Step 1: Add imports and state fields**

Add import:
```typescript
import type { TrailPointConfig, TrailPointSource } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";
```

Add state fields after `actionFeedback`:
```typescript
trailConfig = $state<TrailPointConfig | null>(null);
```

- [ ] **Step 2: Load trail config when prop changes**

In `loadPointsForCurrentProp()`, after loading points, add:

```typescript
// Load trail assignment for this prop
this.trailConfig = this.provider.getTrailAssignment(this.selectedPropType) ?? null;
```

- [ ] **Step 3: Add trail assignment save method**

Add after `importJSON`:

```typescript
saveTrailConfig(config: TrailPointConfig): void {
  this.trailConfig = config;
  this.provider.saveTrailAssignment(this.selectedPropType, config);
  this.showSaveIndicator();
}

clearTrailConfig(): void {
  this.trailConfig = null;
  this.provider.removeTrailAssignment(this.selectedPropType);
  this.showSaveIndicator();
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/effects-lab/state/effect-point-editor-state.svelte.ts
git commit -m "feat(trails): expose trail assignment state in editor"
```

---

### Task 9: Create TrailPointAssignmentSection.svelte

**Files:**
- Create: `src/lib/features/effects-lab/components/TrailPointAssignmentSection.svelte`

This is a card section that shows:
- Left trail dropdown: `Geometric (default) | Tip 1 | Tip 2 | ... | Custom | None`
- Right trail dropdown: same options
- When "Custom" is selected, dx/dy inputs appear

- [ ] **Step 1: Create the component**

```svelte
<!--
  TrailPointAssignmentSection.svelte

  Lets users assign trail endpoints to existing tip points or custom
  positions. Appears below the Actions section in the Tip Points tab.
  Each prop type can have up to 2 trail endpoints (left, right).
-->
<script lang="ts">
  import type { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
  import type { TrailPointConfig, TrailPointSource } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

  interface Props {
    editorState: EffectPointEditorState;
  }

  const { editorState }: Props = $props();

  // Derive dropdown options from current tip points
  let tipOptions = $derived(
    editorState.points.map((p, i) => ({
      label: `Tip ${i + 1} (${p.dx}, ${p.dy})`,
      value: i,
    }))
  );

  // Current config, or defaults
  let leftSource = $derived(editorState.trailConfig?.left ?? null);
  let rightSource = $derived(editorState.trailConfig?.right ?? null);

  // Convert source to dropdown value for display
  function sourceToDropdownValue(source: TrailPointSource | null): string {
    if (!source) return "default";
    if (source.type === "none") return "none";
    if (source.type === "tip") return `tip-${source.index}`;
    if (source.type === "custom") return "custom";
    return "default";
  }

  // Convert dropdown value back to source.
  // "default" is handled by callers before this is called — should never reach here.
  function dropdownValueToSource(value: string, currentSource: TrailPointSource | null): TrailPointSource {
    if (value === "none") return { type: "none" };
    if (value === "custom") {
      // Preserve existing custom values if switching back to custom
      if (currentSource?.type === "custom") return currentSource;
      return { type: "custom", dx: 0, dy: 0 };
    }
    if (value.startsWith("tip-")) {
      const index = parseInt(value.replace("tip-", ""), 10);
      return { type: "tip", index };
    }
    // Should not reach here — "default" is handled by callers
    return { type: "none" };
  }

  let leftDropdownValue = $derived(sourceToDropdownValue(leftSource));
  let rightDropdownValue = $derived(sourceToDropdownValue(rightSource));

  function handleLeftChange(value: string) {
    const newLeft = value === "default" ? null : dropdownValueToSource(value, leftSource);
    if (value === "default" && rightDropdownValue === "default") {
      // Both default = clear trail config entirely
      editorState.trailConfig = null;
      editorState.clearTrailConfig();
      return;
    }
    const config: TrailPointConfig = {
      left: newLeft ?? { type: "none" },
      right: rightSource ?? { type: "none" },
    };
    editorState.saveTrailConfig(config);
  }

  function handleRightChange(value: string) {
    const newRight = value === "default" ? null : dropdownValueToSource(value, rightSource);
    if (value === "default" && leftDropdownValue === "default") {
      editorState.trailConfig = null;
      editorState.clearTrailConfig();
      return;
    }
    const config: TrailPointConfig = {
      left: leftSource ?? { type: "none" },
      right: newRight ?? { type: "none" },
    };
    editorState.saveTrailConfig(config);
  }

  function handleCustomDxDy(side: "left" | "right", field: "dx" | "dy", raw: string) {
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return;
    const rounded = Math.round(value * 10) / 10;

    const currentSource = side === "left" ? leftSource : rightSource;
    if (currentSource?.type !== "custom") return;

    const updated: TrailPointSource = {
      type: "custom",
      dx: field === "dx" ? rounded : currentSource.dx,
      dy: field === "dy" ? rounded : currentSource.dy,
    };

    const config: TrailPointConfig = {
      left: side === "left" ? updated : (leftSource ?? { type: "none" }),
      right: side === "right" ? updated : (rightSource ?? { type: "none" }),
    };
    editorState.saveTrailConfig(config);
  }
</script>

<div class="section">
  <h3>
    <i class="fas fa-route" aria-hidden="true"></i>
    Trail Points
  </h3>
  <p class="section-desc">
    Pick where trail lines emit from. Defaults use prop geometry.
  </p>

  <div class="trail-assignments">
    <!-- Left trail -->
    <div class="trail-row">
      <label class="trail-label" for="trail-left">Left</label>
      <select
        id="trail-left"
        class="trail-select"
        value={leftDropdownValue}
        onchange={(e) => handleLeftChange((e.target as HTMLSelectElement).value)}
      >
        <option value="default">Geometric (default)</option>
        <option value="none">None (disabled)</option>
        {#each tipOptions as opt}
          <option value="tip-{opt.value}">{opt.label}</option>
        {/each}
        <option value="custom">Custom position</option>
      </select>
      {#if leftSource?.type === "custom"}
        <div class="custom-coords">
          <label class="coord-field">
            <span class="coord-label">dx</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={leftSource.dx}
              onchange={(e) => handleCustomDxDy("left", "dx", (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="coord-field">
            <span class="coord-label">dy</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={leftSource.dy}
              onchange={(e) => handleCustomDxDy("left", "dy", (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      {/if}
    </div>

    <!-- Right trail -->
    <div class="trail-row">
      <label class="trail-label" for="trail-right">Right</label>
      <select
        id="trail-right"
        class="trail-select"
        value={rightDropdownValue}
        onchange={(e) => handleRightChange((e.target as HTMLSelectElement).value)}
      >
        <option value="default">Geometric (default)</option>
        <option value="none">None (disabled)</option>
        {#each tipOptions as opt}
          <option value="tip-{opt.value}">{opt.label}</option>
        {/each}
        <option value="custom">Custom position</option>
      </select>
      {#if rightSource?.type === "custom"}
        <div class="custom-coords">
          <label class="coord-field">
            <span class="coord-label">dx</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={rightSource.dx}
              onchange={(e) => handleCustomDxDy("right", "dx", (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="coord-field">
            <span class="coord-label">dy</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={rightSource.dy}
              onchange={(e) => handleCustomDxDy("right", "dy", (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .section {
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
  }

  .section h3 {
    margin: 0 0 var(--spacing-xs, 4px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .section-desc {
    margin: 0 0 var(--spacing-sm, 8px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .trail-assignments {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .trail-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trail-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
  }

  .trail-select {
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-overlay-dark, rgba(0, 0, 0, 0.3));
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .trail-select:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  .custom-coords {
    display: flex;
    gap: 6px;
    padding-left: 4px;
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
    border-color: var(--theme-accent, #8b5cf6);
  }

  @media (prefers-reduced-motion: reduce) {
    .trail-select {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/effects-lab/components/TrailPointAssignmentSection.svelte
git commit -m "feat(trails): create TrailPointAssignmentSection UI component"
```

---

### Task 10: Add TrailPointAssignmentSection to EffectPointListPanel

**Files:**
- Modify: `src/lib/features/effects-lab/components/EffectPointListPanel.svelte`

- [ ] **Step 1: Import the component**

Add import in the script block:
```typescript
import TrailPointAssignmentSection from "./TrailPointAssignmentSection.svelte";
```

- [ ] **Step 2: Add the section after the Actions section**

After the closing `</div>` of the `.section.actions-section` block (around line 374), add:

```svelte
<!-- Trail Points -->
<TrailPointAssignmentSection {editorState} />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointListPanel.svelte
git commit -m "feat(trails): add TrailPointAssignmentSection to list panel"
```

---

### Task 11: Build verification

- [ ] **Step 1: Run full build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 3: Run tests**

Run: `npm test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 4: Manual verification checklist**

Tell the user to verify:
1. Open Effects Lab → Tip Points tab
2. Select "bighoop" from prop selector
3. "Trail Points" section should appear below Actions
4. Both dropdowns should default to "Geometric (default)"
5. Change Left to "Tip 3" — should save (indicator appears)
6. Change Right to "Custom" — dx/dy inputs should appear
7. Switch prop type and back — trail config should persist
8. Run an animation with trails on bighoop — trail endpoints should use the assigned tip point positions instead of geometric offset
