# Effects Lab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fuse Flame Lab and LED Lab into a single Effects Lab module with a mode switcher (Trails/Fire/LED), sharing parameterized point editor components.

**Architecture:** Mode switcher at top selects effect type. Inner tabs (Tuning/Points) show mode-specific tuning or shared point editor. Shared components are parameterized by an EffectDescriptor that provides colors, labels, ranges, and point field accessors. Trails mode has no Points tab.

**Tech Stack:** Svelte 5 (runes), TypeScript, ITI dependency injection, CSS custom properties, sessionStorage persistence.

---

## Task 1: Create domain types

**Files:**
- Create: `src/lib/features/effects-lab/domain/EffectDescriptor.ts`

**Context:** The EffectDescriptor is the core abstraction. It tells shared components how to render for each effect type (colors, labels, intensity field access). Each effect registers a descriptor. Shared components receive descriptors via props.

**Step 1: Create the EffectDescriptor interface and registry**

```typescript
// src/lib/features/effects-lab/domain/EffectDescriptor.ts

import type { FirePoint } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { LedPoint } from "$lib/shared/animation-engine/domain/types/LedTypes";
import { getFirePoints } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { getLedPoints } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

/**
 * Describes how a visual effect behaves in the Effects Lab editor.
 * Shared components use this to adapt their UI (colors, labels, slider ranges)
 * without knowing the specific effect type.
 */
export interface EffectDescriptor {
  /** Unique ID for persistence and routing */
  id: string;
  /** Display label */
  label: string;
  /** FontAwesome icon class */
  icon: string;
  /** Primary accent color (hex) */
  accentColor: string;
  /** Mid-opacity accent for backgrounds (rgba) */
  accentColorMid: string;
  /** Border accent (rgba) */
  accentColorBorder: string;
  /** Whether this effect type has a point placement editor */
  hasPointEditor: boolean;

  // Point editor config (only used when hasPointEditor is true)
  /** Label for the intensity slider (e.g. "Flame Scale", "Brightness") */
  intensityLabel: string;
  /** Min/max range for the intensity slider */
  intensityRange: [number, number];
  /** Step increment for the intensity slider */
  intensityStep: number;
  /** Default intensity for new points */
  intensityDefault: number;
  /** Read intensity from a point object */
  getIntensity(point: any): number;
  /** Write intensity to a point object (mutates in place) */
  setIntensity(point: any, value: number): void;
  /** Create a new point at the given coordinates with default intensity */
  createPoint(dx: number, dy: number): any;
  /** Load default points for a prop type from the domain registry */
  getDefaultPoints(propType: string): any[];
}

export type EffectMode = "trails" | "fire" | "led";

export const FIRE_DESCRIPTOR: EffectDescriptor = {
  id: "fire",
  label: "Fire",
  icon: "fas fa-fire",
  accentColor: "#f97316",
  accentColorMid: "rgba(249, 115, 22, 0.15)",
  accentColorBorder: "rgba(249, 115, 22, 0.3)",
  hasPointEditor: true,
  intensityLabel: "Flame Scale",
  intensityRange: [0.1, 2.0],
  intensityStep: 0.1,
  intensityDefault: 0.8,
  getIntensity: (p: FirePoint) => p.flameScale,
  setIntensity: (p: FirePoint, v: number) => { p.flameScale = v; },
  createPoint: (dx: number, dy: number): FirePoint => ({ dx, dy, flameScale: 0.8 }),
  getDefaultPoints: (propType: string) => getFirePoints(propType),
};

export const LED_DESCRIPTOR: EffectDescriptor = {
  id: "led",
  label: "LED",
  icon: "fas fa-lightbulb",
  accentColor: "#00ff88",
  accentColorMid: "rgba(0, 255, 136, 0.15)",
  accentColorBorder: "rgba(0, 255, 136, 0.3)",
  hasPointEditor: true,
  intensityLabel: "Brightness",
  intensityRange: [0, 1],
  intensityStep: 0.05,
  intensityDefault: 0.8,
  getIntensity: (p: LedPoint) => p.brightness,
  setIntensity: (p: LedPoint, v: number) => { p.brightness = v; },
  createPoint: (dx: number, dy: number): LedPoint => ({ dx, dy, brightness: 0.8 }),
  getDefaultPoints: (propType: string) => getLedPoints(propType),
};

export const TRAILS_DESCRIPTOR: EffectDescriptor = {
  id: "trails",
  label: "Trails",
  icon: "fas fa-wind",
  accentColor: "#3b82f6",
  accentColorMid: "rgba(59, 130, 246, 0.15)",
  accentColorBorder: "rgba(59, 130, 246, 0.3)",
  hasPointEditor: false,
  // Point editor fields unused for trails, but interface requires them
  intensityLabel: "",
  intensityRange: [0, 1],
  intensityStep: 0.1,
  intensityDefault: 1,
  getIntensity: () => 1,
  setIntensity: () => {},
  createPoint: () => ({ dx: 0, dy: 0 }),
  getDefaultPoints: () => [],
};

/** All registered effect descriptors, in display order */
export const EFFECT_DESCRIPTORS: EffectDescriptor[] = [
  TRAILS_DESCRIPTOR,
  FIRE_DESCRIPTOR,
  LED_DESCRIPTOR,
];

/** Look up a descriptor by ID */
export function getEffectDescriptor(id: string): EffectDescriptor {
  return EFFECT_DESCRIPTORS.find((d) => d.id === id) ?? TRAILS_DESCRIPTOR;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -5`
Expected: No errors referencing `EffectDescriptor.ts`

**Step 3: Commit**

```bash
git add src/lib/features/effects-lab/domain/EffectDescriptor.ts
git commit -m "feat(effects-lab): add EffectDescriptor domain types"
```

---

## Task 2: Create unified override provider interface and move providers

**Files:**
- Create: `src/lib/features/effects-lab/services/contracts/IEffectPointOverrideProvider.ts`
- Create: `src/lib/features/effects-lab/services/implementations/FirePointOverrideProvider.ts` (copy from flame-lab, update interface)
- Create: `src/lib/features/effects-lab/services/implementations/LedPointOverrideProvider.ts` (copy from led-lab, update interface)

**Context:** Both existing providers (`IFirePointOverrideProvider` and `ILedPointOverrideProvider`) have identical method signatures. The only differences are the config type names (`PropFirePointConfig` vs `PropLedConfig`). Create a unified interface that both can implement.

**Step 1: Create unified interface**

```typescript
// src/lib/features/effects-lab/services/contracts/IEffectPointOverrideProvider.ts

/**
 * Unified interface for effect point override storage.
 * Used by both FirePointOverrideProvider and LedPointOverrideProvider.
 *
 * Two-layer storage model:
 * - Working state: auto-saved on every edit in the Effects Lab editor
 * - User defaults: baseline per prop type ("Set as Default" action)
 * Plus admin-published defaults loaded from Firestore (fire only, currently).
 */
export interface IEffectPointOverrideProvider {
  // Working state (auto-saved edits)
  getOverride(propType: string): any | null;
  saveOverride(propType: string, config: any): void;
  clearOverride(propType: string): void;
  hasOverride(propType: string): boolean;
  getOverriddenTypes(): string[];

  // Bulk operations
  exportAll(): Record<string, any>;
  importAll(overrides: Record<string, any>): void;

  // Published defaults (Firestore)
  loadPublishedDefaults(defaults: Record<string, any>): void;

  // User-defined defaults
  saveUserDefault(propType: string, config: any): void;
  getUserDefault(propType: string): any | null;
  hasUserDefault(propType: string): boolean;
  clearUserDefault(propType: string): void;
  getUserDefaultTypes(): string[];
}
```

**Step 2: Copy FirePointOverrideProvider to effects-lab**

Copy `src/lib/features/flame-lab/services/implementations/FirePointOverrideProvider.ts` to `src/lib/features/effects-lab/services/implementations/FirePointOverrideProvider.ts`.

Make these changes:
1. Change the interface import: `import type { IEffectPointOverrideProvider } from "../contracts/IEffectPointOverrideProvider";`
2. Change `implements IFirePointOverrideProvider` to `implements IEffectPointOverrideProvider`
3. Remove the old interface import

All other code stays identical (localStorage keys `"fire-point-overrides"`, `"fire-point-user-defaults"`, validation checking `flameScale` field).

**Step 3: Copy LedPointOverrideProvider to effects-lab**

Copy `src/lib/features/led-lab/services/implementations/LedPointOverrideProvider.ts` to `src/lib/features/effects-lab/services/implementations/LedPointOverrideProvider.ts`.

Same changes:
1. Change interface import to `IEffectPointOverrideProvider`
2. Change `implements` clause
3. Remove old interface import

All other code stays identical (localStorage keys `"led-point-overrides"`, `"led-point-user-defaults"`, validation checking `brightness` field).

**Step 4: Verify and commit**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -5`

```bash
git add src/lib/features/effects-lab/services/
git commit -m "feat(effects-lab): add unified IEffectPointOverrideProvider and move providers"
```

---

## Task 3: Create parameterized editor state

**Files:**
- Create: `src/lib/features/effects-lab/state/effect-point-editor-state.svelte.ts`

**Context:** This is a merge of `fire-point-editor-state.svelte.ts` (244 lines) and `led-point-editor-state.svelte.ts` (244 lines). They're identical except for type names. The unified version accepts an `EffectDescriptor` and an `IEffectPointOverrideProvider`.

**Step 1: Create the parameterized editor state**

Start from `fire-point-editor-state.svelte.ts` and make these changes:

1. Replace `import type { IFirePointOverrideProvider }` with `import type { IEffectPointOverrideProvider } from "../services/contracts/IEffectPointOverrideProvider";`
2. Replace `import type { FirePoint }` and `import { getFirePoints }` with `import type { EffectDescriptor } from "../domain/EffectDescriptor";`
3. Change constructor signature: `constructor(private provider: IEffectPointOverrideProvider, private descriptor: EffectDescriptor)`
4. Change class name to `EffectPointEditorState`
5. Replace `points = $state<FirePoint[]>([])` with `points = $state<any[]>([])`
6. Replace `addPoint(dx: number, dy: number, flameScale = 0.8)` with `addPoint(dx: number, dy: number)`. Body: `const newPoint = this.descriptor.createPoint(dx, dy);`
7. In `loadPointsForCurrentProp()`: replace `getFirePoints(this.selectedPropType)` with `this.descriptor.getDefaultPoints(this.selectedPropType)`
8. In `importJSON()`: replace `flameScale` validation with intensity field validation using `this.descriptor.getIntensity(point)` — check it returns a number
9. Remove unused `FirePoint` / `getFirePoints` imports

The file structure and all methods (undo, drag, save, export, etc.) remain identical.

**Step 2: Verify and commit**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -5`

```bash
git add src/lib/features/effects-lab/state/
git commit -m "feat(effects-lab): add parameterized EffectPointEditorState"
```

---

## Task 4: Create shared EffectPropTypeSelector

**Files:**
- Create: `src/lib/features/effects-lab/components/EffectPropTypeSelector.svelte`

**Context:** Based on `flame-lab/components/PropTypeSelector.svelte` (165 lines) and `led-lab/components/LedPropTypeSelector.svelte` (166 lines). Identical except accent color (orange vs green). Parameterize by accepting `descriptor` prop.

**Step 1: Create the component**

Copy `flame-lab/components/PropTypeSelector.svelte` to `effects-lab/components/EffectPropTypeSelector.svelte`.

Make these changes:

1. Add `descriptor` prop alongside `editorState`:
   ```typescript
   import type { EffectDescriptor } from "../domain/EffectDescriptor";

   interface Props {
     editorState: EffectPointEditorState;
     descriptor: EffectDescriptor;
   }
   let { editorState, descriptor }: Props = $props();
   ```

2. Replace `import { FirePointEditorState }` with `import { EffectPointEditorState }` from the new path

3. Replace all hardcoded orange colors with CSS variable references. In the `<style>` block, change:
   - `color-mix(in srgb, #f97316 15%, transparent)` → `color-mix(in srgb, var(--effect-accent) 15%, transparent)`
   - `color-mix(in srgb, #f97316 30%, transparent)` → `color-mix(in srgb, var(--effect-accent) 30%, transparent)`
   - `#f97316` → `var(--effect-accent)`

4. At the root element, set the CSS variable:
   ```svelte
   <div class="prop-type-selector" style="--effect-accent: {descriptor.accentColor}">
   ```

5. The success/default colors (green bookmark) stay hardcoded — they indicate "has user default" regardless of effect type.

**Step 2: Verify and commit**

```bash
git add src/lib/features/effects-lab/components/EffectPropTypeSelector.svelte
git commit -m "feat(effects-lab): add shared EffectPropTypeSelector"
```

---

## Task 5: Create shared EffectPointSvgCanvas

**Files:**
- Create: `src/lib/features/effects-lab/components/EffectPointSvgCanvas.svelte`

**Context:** Based on `flame-lab/components/FirePointSvgCanvas.svelte` (559 lines). The LED version (566 lines) is identical except colors and field names. Parameterize with `descriptor` prop.

**Step 1: Create the component**

Copy `FirePointSvgCanvas.svelte` to `effects-lab/components/EffectPointSvgCanvas.svelte`.

Make these changes:

1. **Props:** Add `descriptor` prop:
   ```typescript
   import type { EffectDescriptor } from "../domain/EffectDescriptor";
   import type { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";

   interface Props {
     editorState: EffectPointEditorState;
     descriptor: EffectDescriptor;
   }
   let { editorState, descriptor }: Props = $props();
   ```

2. **Replace type imports:** Remove `FirePointEditorState` import, use `EffectPointEditorState`

3. **Intensity field access:** Replace all `point.flameScale` with `descriptor.getIntensity(point)`:
   - In the circle radius calculation: `const radius = 8 + (descriptor.getIntensity(point)) * 12;` (was `8 + point.flameScale * 12`)
   - In tooltips/aria: `descriptor.intensityLabel: ${descriptor.getIntensity(point).toFixed(1)}`

4. **Colors:** Replace hardcoded orange with descriptor accent:
   - Point circle fill: `descriptor.accentColor` instead of `"#f97316"`
   - Glow ring stroke: `descriptor.accentColor`
   - In CSS: use `var(--effect-accent)` and set it on root element

5. **Root element:** `<svg ... style="--effect-accent: {descriptor.accentColor}">`

**Step 2: Verify and commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointSvgCanvas.svelte
git commit -m "feat(effects-lab): add shared EffectPointSvgCanvas"
```

---

## Task 6: Create shared EffectPointListPanel

**Files:**
- Create: `src/lib/features/effects-lab/components/EffectPointListPanel.svelte`

**Context:** Based on `flame-lab/components/FirePointListPanel.svelte` (686 lines). The LED version is identical except labels and colors. Parameterize with `descriptor` prop.

**Step 1: Create the component**

Copy `FirePointListPanel.svelte` to `effects-lab/components/EffectPointListPanel.svelte`.

Make these changes:

1. **Props:** Add `descriptor`:
   ```typescript
   import type { EffectDescriptor } from "../domain/EffectDescriptor";
   import type { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";

   interface Props {
     editorState: EffectPointEditorState;
     descriptor: EffectDescriptor;
   }
   let { editorState, descriptor }: Props = $props();
   ```

2. **Slider label:** Replace `"Scale"` or `"Flame Scale"` with `{descriptor.intensityLabel}`

3. **Slider range attributes:**
   - `min={descriptor.intensityRange[0]}`
   - `max={descriptor.intensityRange[1]}`
   - `step={descriptor.intensityStep}`

4. **Slider value access:** Replace `point.flameScale` reads with `descriptor.getIntensity(point)` and writes with `descriptor.setIntensity(point, newValue)`

5. **Slider oninput handler:** Instead of `editorState.updatePoint(i, { flameScale: parseFloat(e.currentTarget.value) })`, call:
   ```typescript
   const val = parseFloat(e.currentTarget.value);
   descriptor.setIntensity(editorState.points[i], val);
   editorState.updatePoint(i, editorState.points[i]);
   ```

6. **Color references:** Replace hardcoded `#f97316` / orange references with `var(--effect-accent)`. Set `--effect-accent` on root element.

7. **Slider accent-color:** `accent-color: var(--effect-accent)` instead of hardcoded color.

8. **Flame icon:** Replace `<i class="fas fa-fire">` with `<i class="{descriptor.icon}">` for the slider row icon.

**Step 2: Verify and commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointListPanel.svelte
git commit -m "feat(effects-lab): add shared EffectPointListPanel"
```

---

## Task 7: Create EffectPointEditorTab orchestrator

**Files:**
- Create: `src/lib/features/effects-lab/components/EffectPointEditorTab.svelte`

**Context:** Based on `flame-lab/components/FirePointEditorTab.svelte` (88 lines). Small orchestrator that creates editor state, wires keyboard shortcuts, and composes the three shared sub-components. Accepts a descriptor prop.

**Step 1: Create the component**

```svelte
<!--
  EffectPointEditorTab.svelte

  Orchestrator: composes EffectPropTypeSelector + EffectPointSvgCanvas + EffectPointListPanel.
  Creates and manages the editor state, wires keyboard shortcuts.
  Accepts an EffectDescriptor to parameterize for fire/LED/future effects.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
  import type { IEffectPointOverrideProvider } from "../services/contracts/IEffectPointOverrideProvider";
  import type { EffectDescriptor } from "../domain/EffectDescriptor";
  import EffectPropTypeSelector from "./EffectPropTypeSelector.svelte";
  import EffectPointSvgCanvas from "./EffectPointSvgCanvas.svelte";
  import EffectPointListPanel from "./EffectPointListPanel.svelte";

  interface Props {
    descriptor: EffectDescriptor;
  }
  let { descriptor }: Props = $props();

  // Resolve the correct override provider based on effect type
  const providerKey = descriptor.id === "fire"
    ? "firePointOverrideProvider"
    : "ledPointOverrideProvider";
  const provider = container.items[providerKey] as IEffectPointOverrideProvider;
  const editorState = new EffectPointEditorState(provider, descriptor);

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      editorState.undo();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && editorState.selectedPointIndex >= 0) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      editorState.deletePoint(editorState.selectedPointIndex);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div class="editor-tab">
  <EffectPropTypeSelector {editorState} {descriptor} />

  <div class="editor-content">
    <EffectPointSvgCanvas {editorState} {descriptor} />
    <div class="list-panel-wrapper">
      <EffectPointListPanel {editorState} {descriptor} />
    </div>
  </div>
</div>

<style>
  .editor-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .editor-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    min-height: 0;
    overflow: hidden;
  }

  .list-panel-wrapper {
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 900px) {
    .editor-content {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
  }
</style>
```

**Step 2: Verify and commit**

```bash
git add src/lib/features/effects-lab/components/EffectPointEditorTab.svelte
git commit -m "feat(effects-lab): add EffectPointEditorTab orchestrator"
```

---

## Task 8: Move tuning tabs

**Files:**
- Create: `src/lib/features/effects-lab/components/FireTuningTab.svelte` (from `flame-lab/components/FlameLabTuningTab.svelte`)
- Create: `src/lib/features/effects-lab/components/LedTuningTab.svelte` (from `led-lab/components/LedLabTuningTab.svelte`)

**Context:** The tuning tabs are large, self-contained components (1554 and 1295 lines). They mostly import from `$lib/shared/...` which doesn't change. Only internal imports (from the old flame-lab/led-lab paths) need updating.

**Step 1: Copy FireTuningTab**

Copy `src/lib/features/flame-lab/components/FlameLabTuningTab.svelte` to `src/lib/features/effects-lab/components/FireTuningTab.svelte`.

Update these imports:
- `"../services/implementations/FirePointOverrideProvider"` → same-level: `"../services/implementations/FirePointOverrideProvider"` (no change needed since the provider was copied to effects-lab in Task 2)
- `"../services/contracts/IFirePointOverrideProvider"` → `"../services/contracts/IEffectPointOverrideProvider"` and update the type cast

Check for any other relative imports pointing to `flame-lab/` and update them.

**Step 2: Copy LedTuningTab**

Copy `src/lib/features/led-lab/components/LedLabTuningTab.svelte` to `src/lib/features/effects-lab/components/LedTuningTab.svelte`.

Update imports similarly:
- Any relative imports pointing to `led-lab/` paths → equivalent `effects-lab/` paths

**Step 3: Verify and commit**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -20`

```bash
git add src/lib/features/effects-lab/components/FireTuningTab.svelte
git add src/lib/features/effects-lab/components/LedTuningTab.svelte
git commit -m "feat(effects-lab): move Fire and LED tuning tabs"
```

---

## Task 9: Create TrailsTuningTab

**Files:**
- Create: `src/lib/features/effects-lab/components/TrailsTuningTab.svelte`

**Context:** Trails currently have minimal UI (on/off toggle + bilateral tracking in AnimationPanel). This tab consolidates trail tuning: fade duration, line width, opacity, tracking mode, and a preview. Uses `animationSettings` from `animation-settings-state.svelte.ts`.

**Important:** Refer to `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts` for available trail setters: `setTrailEnabled`, `setTrailMode`, `setFadeDuration`, `setTrailAppearance`, `setTrackingMode`, `setHideProps`.

Also refer to `src/lib/shared/animation-engine/domain/types/TrailTypes.ts` for `TrailMode`, `TrackingMode`, `TrailEffect`, and `DEFAULT_TRAIL_SETTINGS`.

**Step 1: Create the component**

Build a tuning tab that exposes:

1. **Enable toggle** — `animationSettings.setTrailEnabled(bool)`, reads `animationSettings.settings.trail.enabled`
2. **Fade duration slider** — range 500ms–5000ms, step 100ms, `setFadeDuration(ms)`
3. **Line width slider** — range 1–10, step 0.5, `setTrailAppearance({lineWidth})`
4. **Opacity range** — min opacity (0.0–0.5) and max opacity (0.5–1.0), `setTrailAppearance({minOpacity, maxOpacity})`
5. **Glow blur slider** — range 0–10, step 1, `setTrailAppearance({glowBlur})`
6. **Tracking mode** — 3-button toggle (Left / Right / Both), `setTrackingMode(mode)`
7. **Hide props toggle** — `setHideProps(bool)` — shows trails-only mode

Structure it like the Fire/LED tuning tabs: scrollable controls panel. No AnimatorCanvas preview for now (trails don't have a separate renderer to preview).

Style with `--effect-accent: #3b82f6` (trails blue).

**Step 2: Verify and commit**

```bash
git add src/lib/features/effects-lab/components/TrailsTuningTab.svelte
git commit -m "feat(effects-lab): add TrailsTuningTab"
```

---

## Task 10: Create EffectModeBar component

**Files:**
- Create: `src/lib/features/effects-lab/components/EffectModeBar.svelte`

**Context:** Horizontal mode switcher (Trails / Fire / LED). Similar to the tab bars in FlameLabModule and LedLabModule, but for effect mode selection. Each mode button shows icon + label, active mode is highlighted with the mode's accent color.

**Step 1: Create the component**

```svelte
<!--
  EffectModeBar.svelte

  Horizontal mode switcher for the Effects Lab.
  Displays Trails / Fire / LED buttons with effect-specific accent colors.
-->
<script lang="ts">
  import { EFFECT_DESCRIPTORS, type EffectMode } from "../domain/EffectDescriptor";

  interface Props {
    activeMode: EffectMode;
    onModeChange: (mode: EffectMode) => void;
  }
  let { activeMode, onModeChange }: Props = $props();
</script>

<div class="mode-bar" role="tablist" aria-label="Effect type">
  {#each EFFECT_DESCRIPTORS as desc}
    {@const isActive = activeMode === desc.id}
    <button
      role="tab"
      class="mode-btn"
      class:active={isActive}
      aria-selected={isActive}
      style="--mode-color: {desc.accentColor}; --mode-color-mid: {desc.accentColorMid}; --mode-color-border: {desc.accentColorBorder}"
      onclick={() => onModeChange(desc.id as EffectMode)}
    >
      <i class={desc.icon} aria-hidden="true"></i>
      {desc.label}
    </button>
  {/each}
</div>

<style>
  .mode-bar {
    display: flex;
    gap: var(--spacing-xs, 4px);
    padding: 0 var(--spacing-lg, 24px);
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 16px;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
    background: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
  }

  .mode-btn:hover {
    color: var(--theme-text, white);
    background: var(--mode-color-mid);
  }

  .mode-btn.active {
    color: var(--mode-color);
    background: var(--mode-color-mid);
    border-color: var(--mode-color-border);
    border-bottom-color: transparent;
  }

  .mode-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-btn {
      transition: none;
    }
  }
</style>
```

**Step 2: Verify and commit**

```bash
git add src/lib/features/effects-lab/components/EffectModeBar.svelte
git commit -m "feat(effects-lab): add EffectModeBar"
```

---

## Task 11: Create EffectsLabModule shell

**Files:**
- Create: `src/lib/features/effects-lab/EffectsLabModule.svelte`

**Context:** Root module component. Two navigation layers: mode bar (Trails/Fire/LED) and inner tabs (Tuning/Points). Mode and tab persisted to sessionStorage. Points tab only available when the active mode has `hasPointEditor: true`.

**Step 1: Create the module**

```svelte
<!--
  EffectsLabModule.svelte

  Unified lab for all animation visual effects (Trails, Fire, LED).
  Mode switcher at top, inner tabs (Tuning / Points) below.
-->
<script lang="ts">
  import EffectModeBar from "./components/EffectModeBar.svelte";
  import {
    getEffectDescriptor,
    type EffectMode,
  } from "./domain/EffectDescriptor";

  const MODE_KEY = "effects-lab-active-mode";
  const TAB_KEY = "effects-lab-active-tab";
  type InnerTab = "tuning" | "points";

  function loadMode(): EffectMode {
    try {
      const raw = sessionStorage.getItem(MODE_KEY);
      if (raw === "trails" || raw === "fire" || raw === "led") return raw;
    } catch { /* ignore */ }
    return "trails";
  }

  function loadTab(): InnerTab {
    try {
      const raw = sessionStorage.getItem(TAB_KEY);
      if (raw === "tuning" || raw === "points") return raw;
    } catch { /* ignore */ }
    return "tuning";
  }

  let activeMode = $state<EffectMode>(loadMode());
  let activeTab = $state<InnerTab>(loadTab());

  let descriptor = $derived(getEffectDescriptor(activeMode));

  function setMode(mode: EffectMode) {
    activeMode = mode;
    try { sessionStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    // If switching to a mode without point editor, fall back to tuning
    const desc = getEffectDescriptor(mode);
    if (!desc.hasPointEditor && activeTab === "points") {
      setTab("tuning");
    }
  }

  function setTab(tab: InnerTab) {
    activeTab = tab;
    try { sessionStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  }

  // Lazy-load tuning tabs per mode
  const tuningComponents: Record<EffectMode, () => Promise<{ default: any }>> = {
    trails: () => import("./components/TrailsTuningTab.svelte"),
    fire: () => import("./components/FireTuningTab.svelte"),
    led: () => import("./components/LedTuningTab.svelte"),
  };

  let TuningComponent = $state<any>(null);
  let PointEditorComponent = $state<any>(null);

  // Load tuning component when mode changes
  $effect(() => {
    const loader = tuningComponents[activeMode];
    TuningComponent = null;
    loader().then((mod) => {
      TuningComponent = mod.default;
    });
  });

  // Lazy-load point editor (shared across fire/LED)
  $effect(() => {
    if (descriptor.hasPointEditor && activeTab === "points" && !PointEditorComponent) {
      import("./components/EffectPointEditorTab.svelte").then((mod) => {
        PointEditorComponent = mod.default;
      });
    }
  });
</script>

<div class="effects-lab">
  <header class="header">
    <div class="title-row">
      <h1>
        <i class="fas fa-sparkles" aria-hidden="true"></i>
        Effects Lab
      </h1>
      <span class="badge">Experimental</span>
    </div>

    <EffectModeBar {activeMode} onModeChange={setMode} />

    <div class="tab-bar" role="tablist">
      <button
        role="tab"
        class="tab"
        class:active={activeTab === "tuning"}
        aria-selected={activeTab === "tuning"}
        style="--tab-color: {descriptor.accentColor}"
        onclick={() => setTab("tuning")}
      >
        <i class="fas fa-sliders-h" aria-hidden="true"></i>
        Tuning
      </button>
      {#if descriptor.hasPointEditor}
        <button
          role="tab"
          class="tab"
          class:active={activeTab === "points"}
          aria-selected={activeTab === "points"}
          style="--tab-color: {descriptor.accentColor}"
          onclick={() => setTab("points")}
        >
          <i class="fas fa-crosshairs" aria-hidden="true"></i>
          {descriptor.label} Points
        </button>
      {/if}
    </div>
  </header>

  <div class="tab-content" role="tabpanel">
    {#if activeTab === "tuning"}
      {#if TuningComponent}
        <TuningComponent />
      {:else}
        <div class="loading">Loading...</div>
      {/if}
    {:else if activeTab === "points" && descriptor.hasPointEditor}
      {#if PointEditorComponent}
        <PointEditorComponent {descriptor} />
      {:else}
        <div class="loading">Loading...</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .effects-lab {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .header {
    flex-shrink: 0;
    padding: var(--spacing-md, 16px) var(--spacing-lg, 24px) 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    margin-bottom: var(--spacing-sm, 8px);
  }

  .title-row h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .title-row h1 i {
    color: var(--theme-accent, #8b5cf6);
  }

  .badge {
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    background: rgba(139, 92, 246, 0.15);
    color: var(--theme-accent, #8b5cf6);
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .tab-bar {
    display: flex;
    gap: var(--spacing-xs, 4px);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 20px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease;
  }

  .tab:hover {
    color: var(--theme-text, white);
  }

  .tab.active {
    color: var(--tab-color, var(--theme-accent));
    border-bottom-color: var(--tab-color, var(--theme-accent));
  }

  .tab:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .tab-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  @media (prefers-reduced-motion: reduce) {
    .tab {
      transition: none;
    }
  }
</style>
```

**Step 2: Verify and commit**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -20`

```bash
git add src/lib/features/effects-lab/EffectsLabModule.svelte
git commit -m "feat(effects-lab): add EffectsLabModule with mode switcher"
```

---

## Task 12: Create effects-lab DI container and wire into composition root

**Files:**
- Create: `src/lib/shared/di/containers/effects-lab-container.ts`
- Modify: `src/lib/shared/di/index.ts`

**Context:** Merge `flame-lab-container.ts` and `led-lab-container.ts` into one container. Both providers keep their existing registration keys for backward compatibility. The domain-level override callbacks (`setFirePointOverrideProvider`, `setLedPointOverrideProvider`) must still be wired.

**Step 1: Create effects-lab-container.ts**

```typescript
// src/lib/shared/di/containers/effects-lab-container.ts

import { createContainer } from "iti";
import { FirePointOverrideProvider } from "$lib/features/effects-lab/services/implementations/FirePointOverrideProvider";
import { LedPointOverrideProvider } from "$lib/features/effects-lab/services/implementations/LedPointOverrideProvider";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";
import { setFirePointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { setLedPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

export const effectsLabContainer = createContainer()
  .add({
    fireDefaultsLoader: () => new FireDefaultsLoader(),
    fireDefaultsPublisher: () => new FireDefaultsPublisher(),
  })
  .add(({ fireDefaultsLoader }) => ({
    firePointOverrideProvider: () => {
      const provider = new FirePointOverrideProvider();
      setFirePointOverrideProvider((propType) => provider.getOverride(propType));
      fireDefaultsLoader.load().then(() => {
        const firePoints = fireDefaultsLoader.getAllFirePoints();
        if (Object.keys(firePoints).length > 0) {
          provider.loadPublishedDefaults(firePoints);
        }
      });
      fireDefaultsLoader.subscribe(() => {
        const firePoints = fireDefaultsLoader.getAllFirePoints();
        if (Object.keys(firePoints).length > 0) {
          provider.loadPublishedDefaults(firePoints);
        }
      });
      return provider;
    },
  }))
  .add({
    ledPointOverrideProvider: () => {
      const provider = new LedPointOverrideProvider();
      setLedPointOverrideProvider((propType) => provider.getOverride(propType));
      return provider;
    },
  });
```

**Step 2: Update di/index.ts**

In `src/lib/shared/di/index.ts`:

1. Replace the two import lines:
   ```typescript
   // Remove:
   import { flameLabContainer } from "./containers/flame-lab-container";
   import { ledLabContainer } from "./containers/led-lab-container";

   // Add:
   import { effectsLabContainer } from "./containers/effects-lab-container";
   ```

2. Replace the two registration lines:
   ```typescript
   // Remove:
   c = c.add(flameLabContainer.items);
   c = c.add(ledLabContainer.items);

   // Add:
   c = c.add(effectsLabContainer.items);
   ```

**Step 3: Verify and commit**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -10`

```bash
git add src/lib/shared/di/containers/effects-lab-container.ts
git add src/lib/shared/di/index.ts
git commit -m "feat(effects-lab): create unified DI container"
```

---

## Task 13: Update navigation (tab definitions + LabModule)

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

**Context:** Replace the separate `flame` and `led` tab entries with a single `effects` entry.

**Step 1: Update tab-definitions.ts**

In `LAB_TABS` array, find the `flame` and `led` entries (near end of array, around lines 748-763). Replace both with a single entry:

```typescript
  {
    id: "effects",
    label: "Effects",
    icon: '<i class="fas fa-sparkles" aria-hidden="true"></i>',
    description: "Visual effects: trails, fire, LED overlays",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
  },
```

Remove the `flame` and `led` entries entirely.

**Step 2: Update LabModule.svelte**

In `tabComponents` record, replace:
```typescript
flame: () => import("$lib/features/flame-lab/FlameLabModule.svelte"),
led: () => import("$lib/features/led-lab/LedLabModule.svelte"),
```

With:
```typescript
effects: () => import("$lib/features/effects-lab/EffectsLabModule.svelte"),
```

**Step 3: Verify and commit**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -10`

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts
git add src/lib/features/lab/LabModule.svelte
git commit -m "feat(effects-lab): wire Effects tab into Lab navigation"
```

---

## Task 14: Delete old modules and verify

**Files:**
- Delete: `src/lib/features/flame-lab/` (entire directory)
- Delete: `src/lib/features/led-lab/` (entire directory)
- Delete: `src/lib/shared/di/containers/flame-lab-container.ts`
- Delete: `src/lib/shared/di/containers/led-lab-container.ts`

**Context:** All code has been migrated to `effects-lab/`. The old modules and containers are no longer imported anywhere.

**Step 1: Verify no remaining imports reference old paths**

Search for any imports still referencing `flame-lab` or `led-lab`:

```bash
grep -r "flame-lab" src/lib/ --include="*.ts" --include="*.svelte" -l
grep -r "led-lab" src/lib/ --include="*.ts" --include="*.svelte" -l
```

Expected: no results (all references have been updated in previous tasks).

If any results appear, update those imports to point to `effects-lab/` equivalents.

**Step 2: Delete old directories**

```bash
rm -rf src/lib/features/flame-lab/
rm -rf src/lib/features/led-lab/
rm -f src/lib/shared/di/containers/flame-lab-container.ts
rm -f src/lib/shared/di/containers/led-lab-container.ts
```

**Step 3: Full verification**

```bash
npx svelte-check --tsconfig tsconfig.json
npm run build
```

Expected: 0 errors, 0 warnings, build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(effects-lab): remove old flame-lab and led-lab modules"
```

---

## Reference: Final directory structure

After all tasks complete:

```
src/lib/features/effects-lab/
├── EffectsLabModule.svelte
├── domain/
│   └── EffectDescriptor.ts
├── components/
│   ├── EffectModeBar.svelte
│   ├── EffectPointEditorTab.svelte
│   ├── EffectPointSvgCanvas.svelte
│   ├── EffectPointListPanel.svelte
│   ├── EffectPropTypeSelector.svelte
│   ├── FireTuningTab.svelte
│   ├── LedTuningTab.svelte
│   └── TrailsTuningTab.svelte
├── services/
│   ├── contracts/
│   │   └── IEffectPointOverrideProvider.ts
│   └── implementations/
│       ├── FirePointOverrideProvider.ts
│       └── LedPointOverrideProvider.ts
└── state/
    └── effect-point-editor-state.svelte.ts
```

Total: 14 files (down from 14 across two modules + 2 containers = 16)

## Reference: Files deleted

```
src/lib/features/flame-lab/  (9 files)
src/lib/features/led-lab/    (9 files)
src/lib/shared/di/containers/flame-lab-container.ts
src/lib/shared/di/containers/led-lab-container.ts
```
