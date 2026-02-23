# Prop Button Aesthetics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create paired red+blue prop composition previews for the prop indicator button and selection drawer, with a Lab tab for visual tuning.

**Architecture:** A composition recipe data file maps each base prop family to transform parameters (x, y, rotation, scale) for the blue and red copies. A reusable Svelte component renders any prop type as a paired composition using those recipes. A Lab tab exposes sliders to tune recipes visually.

**Tech Stack:** Svelte 5, TypeScript, inline SVG `<image>` elements, CSS filters for red coloring, existing button SVGs from `/images/props/buttons/`.

---

### Task 1: Create Composition Recipe Data

**Files:**
- Create: `src/lib/shared/pictograph/prop/domain/prop-composition-recipes.ts`

**Step 1: Create the recipe interface and data**

```typescript
// src/lib/shared/pictograph/prop/domain/prop-composition-recipes.ts

import { PropType } from "./enums/PropType";
import { getBasePropType } from "./PropTypeDisplayRegistry";

/**
 * Transform parameters for one prop in a paired composition.
 * Coordinates are in a 0-100 viewBox space.
 */
export interface PropTransform {
  /** X position (0-100, center of viewBox) */
  x: number;
  /** Y position (0-100, center of viewBox) */
  y: number;
  /** Rotation in degrees */
  rotation: number;
  /** Scale factor (1 = natural size) */
  scale: number;
}

/**
 * A composition recipe defines how two props (blue + red) are arranged
 * to create an aesthetically pleasing paired preview.
 */
export interface CompositionRecipe {
  blue: PropTransform;
  red: PropTransform;
  /** Overall scale applied to both props (shrinks the pair to fit the viewBox) */
  pairScale: number;
}

/**
 * Default composition recipes per base prop family.
 * These are starting points - tune in the Prop Button Lab tab.
 *
 * Each recipe assumes a viewBox of "0 0 100 100".
 * x/y are the center point of each prop image within that viewBox.
 */
const FAMILY_RECIPES: Partial<Record<PropType, CompositionRecipe>> = {
  // Staves: crossed in an X
  [PropType.STAFF]: {
    blue: { x: 50, y: 50, rotation: -45, scale: 0.55 },
    red: { x: 50, y: 50, rotation: 45, scale: 0.55 },
    pairScale: 1,
  },
  // Fans: facing each other (beta-like)
  [PropType.FAN]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 180, scale: 0.45 },
    pairScale: 1,
  },
  // Clubs: angled V, handles meeting
  [PropType.CLUB]: {
    blue: { x: 35, y: 50, rotation: -20, scale: 0.5 },
    red: { x: 65, y: 50, rotation: 20, scale: 0.5 },
    pairScale: 1,
  },
  // Buugengs: interlocked S-curves
  [PropType.BUUGENG]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 180, scale: 0.45 },
    pairScale: 1,
  },
  // Hoops: overlapping circles (Venn)
  [PropType.MINIHOOP]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.5 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.5 },
    pairScale: 1,
  },
  // Triads: rotational offset
  [PropType.TRIAD]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 60, scale: 0.45 },
    pairScale: 1,
  },
  // Triquetras: interlocking geometry
  [PropType.TRIQUETRA]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 60, scale: 0.45 },
    pairScale: 1,
  },
  // Chickens: mirrored pair
  [PropType.CHICKEN]: {
    blue: { x: 35, y: 50, rotation: 10, scale: 0.45 },
    red: { x: 65, y: 50, rotation: -10, scale: 0.45 },
    pairScale: 1,
  },
  // Guitars: side by side, slight angle
  [PropType.GUITAR]: {
    blue: { x: 35, y: 50, rotation: -15, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 15, scale: 0.45 },
    pairScale: 1,
  },
  // Double Stars: overlapping offset
  [PropType.DOUBLESTAR]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 30, scale: 0.45 },
    pairScale: 1,
  },
  // Eight Rings: side by side
  [PropType.EIGHTRINGS]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Torches: crossed
  [PropType.TORCH]: {
    blue: { x: 50, y: 50, rotation: -30, scale: 0.5 },
    red: { x: 50, y: 50, rotation: 30, scale: 0.5 },
    pairScale: 1,
  },
  // Hand: mirrored pair (left/right hands)
  [PropType.HAND]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Sword: crossed swords
  [PropType.SWORD]: {
    blue: { x: 50, y: 50, rotation: -40, scale: 0.55 },
    red: { x: 50, y: 50, rotation: 40, scale: 0.55 },
    pairScale: 1,
  },
  // Quiad: side by side
  [PropType.QUIAD]: {
    blue: { x: 38, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 62, y: 50, rotation: 0, scale: 0.45 },
    pairScale: 1,
  },
  // Trigeng: facing each other
  [PropType.TRIGENG]: {
    blue: { x: 35, y: 50, rotation: 0, scale: 0.45 },
    red: { x: 65, y: 50, rotation: 180, scale: 0.45 },
    pairScale: 1,
  },
};

/** Fallback recipe for any prop type not explicitly mapped */
const DEFAULT_RECIPE: CompositionRecipe = {
  blue: { x: 35, y: 50, rotation: 10, scale: 0.45 },
  red: { x: 65, y: 50, rotation: -10, scale: 0.45 },
  pairScale: 1,
};

/**
 * Gets the composition recipe for a prop type.
 * Variants inherit from their base family.
 */
export function getCompositionRecipe(propType: PropType): CompositionRecipe {
  const base = getBasePropType(propType);
  return FAMILY_RECIPES[base] ?? FAMILY_RECIPES[propType] ?? DEFAULT_RECIPE;
}

/**
 * All base prop types that have explicit recipes.
 * Used by the lab tab to display all configurable families.
 */
export function getRecipeFamilies(): { propType: PropType; recipe: CompositionRecipe }[] {
  return Object.entries(FAMILY_RECIPES).map(([key, recipe]) => ({
    propType: key as PropType,
    recipe,
  }));
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "prop-composition-recipes" | head -10`
Expected: No errors mentioning this file.

**Step 3: Commit**

```bash
git add src/lib/shared/pictograph/prop/domain/prop-composition-recipes.ts
git commit -m "feat: add paired prop composition recipes for button aesthetics"
```

---

### Task 2: Create PropCompositionPreview Component

**Files:**
- Create: `src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte`

**Step 1: Create the component**

```svelte
<!--
  PropCompositionPreview.svelte

  Renders a paired prop composition (blue + red) using SVG.
  Each prop is positioned according to the composition recipe for its family.

  Used in:
  - PropIndicatorButton (button panel in Create module)
  - PropTypeButton (prop selection drawer)
  - PropButtonLab (visual tuning lab tab)
-->
<script lang="ts">
  import { PropType } from "../domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "../domain/PropTypeDisplayRegistry";
  import {
    getCompositionRecipe,
    type CompositionRecipe,
  } from "../domain/prop-composition-recipes";

  let {
    propType,
    size = 64,
    recipeOverride = undefined,
  }: {
    propType: PropType;
    size?: number;
    /** Override the default recipe (used by lab tab for live tuning) */
    recipeOverride?: CompositionRecipe;
  } = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));
  const recipe = $derived(recipeOverride ?? getCompositionRecipe(propType));

  // Build transform strings for each prop
  const blueTransform = $derived(
    `translate(${recipe.blue.x}, ${recipe.blue.y}) ` +
    `rotate(${recipe.blue.rotation}) ` +
    `scale(${recipe.blue.scale * recipe.pairScale})`
  );

  const redTransform = $derived(
    `translate(${recipe.red.x}, ${recipe.red.y}) ` +
    `rotate(${recipe.red.rotation}) ` +
    `scale(${recipe.red.scale * recipe.pairScale})`
  );

  // Image dimensions in viewBox units - props are placed relative to their center
  // Using a square bounding box that gets scaled by the recipe
  const imgSize = 40;
  const imgOffset = -(imgSize / 2);
</script>

<svg
  class="prop-composition-preview"
  width={size}
  height={size}
  viewBox="0 0 100 100"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <!-- Blue prop (native color from SVG) -->
  <g transform={blueTransform}>
    <image
      href={displayInfo.image}
      x={imgOffset}
      y={imgOffset}
      width={imgSize}
      height={imgSize}
    />
  </g>

  <!-- Red prop (hue-rotated to match existing red prop coloring) -->
  <g transform={redTransform}>
    <image
      class="red-prop"
      href={displayInfo.image}
      x={imgOffset}
      y={imgOffset}
      width={imgSize}
      height={imgSize}
    />
  </g>
</svg>

<style>
  .prop-composition-preview {
    display: block;
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .red-prop {
    filter: hue-rotate(125deg) saturate(1.2);
  }
</style>
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "PropComposition" | head -10`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte
git commit -m "feat: add PropCompositionPreview component for paired prop display"
```

---

### Task 3: Create Prop Button Lab Tab

**Files:**
- Create: `src/lib/features/lab/tabs/PropButtonLab.svelte`
- Modify: `src/lib/features/lab/LabModule.svelte:17-48` (add tab import)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts:757-765` (add tab definition)

**Step 1: Create the lab tab component**

```svelte
<!--
  PropButtonLab.svelte - Visual tuning lab for paired prop compositions

  Shows all base prop families with their current composition at ~120px.
  Click a family to expand sliders for tuning blue/red transforms.
  Live preview updates as sliders change.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import {
    getCompositionRecipe,
    getRecipeFamilies,
    type CompositionRecipe,
    type PropTransform,
  } from "$lib/shared/pictograph/prop/domain/prop-composition-recipes";

  const families = getRecipeFamilies();

  // Track which family is expanded for tuning
  let expandedFamily = $state<PropType | null>(null);

  // Live-edited recipe overrides (keyed by prop type)
  let overrides = $state<Record<string, CompositionRecipe>>({});

  function getRecipe(propType: PropType): CompositionRecipe {
    return overrides[propType] ?? getCompositionRecipe(propType);
  }

  function toggleFamily(propType: PropType) {
    if (expandedFamily === propType) {
      expandedFamily = null;
    } else {
      expandedFamily = propType;
      // Initialize override from current recipe if not already overridden
      if (!overrides[propType]) {
        const current = getCompositionRecipe(propType);
        overrides[propType] = structuredClone(current);
      }
    }
  }

  function updateTransform(
    propType: PropType,
    color: "blue" | "red",
    field: keyof PropTransform,
    value: number
  ) {
    if (!overrides[propType]) {
      overrides[propType] = structuredClone(getCompositionRecipe(propType));
    }
    (overrides[propType]![color] as PropTransform)[field] = value;
    // Force reactivity
    overrides = { ...overrides };
  }

  function updatePairScale(propType: PropType, value: number) {
    if (!overrides[propType]) {
      overrides[propType] = structuredClone(getCompositionRecipe(propType));
    }
    overrides[propType]!.pairScale = value;
    overrides = { ...overrides };
  }

  function resetFamily(propType: PropType) {
    delete overrides[propType];
    overrides = { ...overrides };
  }

  function copyRecipe(propType: PropType) {
    const recipe = getRecipe(propType);
    const json = JSON.stringify(recipe, null, 2);
    navigator.clipboard.writeText(json);
  }

  function copyAllRecipes() {
    const all: Record<string, CompositionRecipe> = {};
    for (const family of families) {
      all[family.propType] = getRecipe(family.propType);
    }
    navigator.clipboard.writeText(JSON.stringify(all, null, 2));
  }
</script>

<div class="prop-button-lab">
  <header class="lab-header">
    <h1>Prop Button Lab</h1>
    <p class="subtitle">Tune paired prop compositions for buttons and drawers</p>
    <button class="copy-all-btn" onclick={copyAllRecipes}>
      <i class="fas fa-copy"></i> Copy All Recipes
    </button>
  </header>

  <div class="families-grid">
    {#each families as { propType }}
      {@const info = getPropTypeDisplayInfo(propType)}
      {@const recipe = getRecipe(propType)}
      {@const isExpanded = expandedFamily === propType}

      <div class="family-card" class:expanded={isExpanded}>
        <button class="family-header" onclick={() => toggleFamily(propType)}>
          <div class="preview-container">
            <PropCompositionPreview
              {propType}
              size={isExpanded ? 160 : 120}
              recipeOverride={overrides[propType]}
            />
          </div>
          <span class="family-label">{info.label}</span>
        </button>

        {#if isExpanded}
          <div class="tuning-panel">
            {#each ["blue", "red"] as color}
              <div class="color-section">
                <h3 class="color-label {color}">{color === "blue" ? "Blue" : "Red"}</h3>
                <div class="slider-group">
                  <label>
                    X: <span class="value">{recipe[color as "blue" | "red"].x.toFixed(0)}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={recipe[color as "blue" | "red"].x}
                      oninput={(e) => updateTransform(propType, color as "blue" | "red", "x", +e.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Y: <span class="value">{recipe[color as "blue" | "red"].y.toFixed(0)}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={recipe[color as "blue" | "red"].y}
                      oninput={(e) => updateTransform(propType, color as "blue" | "red", "y", +e.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Rotation: <span class="value">{recipe[color as "blue" | "red"].rotation.toFixed(0)}&deg;</span>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="5"
                      value={recipe[color as "blue" | "red"].rotation}
                      oninput={(e) => updateTransform(propType, color as "blue" | "red", "rotation", +e.currentTarget.value)}
                    />
                  </label>
                  <label>
                    Scale: <span class="value">{recipe[color as "blue" | "red"].scale.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={recipe[color as "blue" | "red"].scale}
                      oninput={(e) => updateTransform(propType, color as "blue" | "red", "scale", +e.currentTarget.value)}
                    />
                  </label>
                </div>
              </div>
            {/each}

            <div class="pair-scale-section">
              <label>
                Pair Scale: <span class="value">{recipe.pairScale.toFixed(2)}</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={recipe.pairScale}
                  oninput={(e) => updatePairScale(propType, +e.currentTarget.value)}
                />
              </label>
            </div>

            <div class="action-buttons">
              <button class="lab-btn" onclick={() => copyRecipe(propType)}>
                <i class="fas fa-copy"></i> Copy Recipe
              </button>
              <button class="lab-btn danger" onclick={() => resetFamily(propType)}>
                <i class="fas fa-undo"></i> Reset
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .prop-button-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    overflow-y: auto;
  }

  .lab-header {
    margin-bottom: 24px;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 12px;
  }

  .lab-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--theme-text, white);
    margin: 0;
  }

  .subtitle {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    margin: 0;
    flex: 1;
  }

  .copy-all-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-accent-strong, #8b5cf6);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    min-height: 44px;
  }

  .copy-all-btn:hover {
    opacity: 0.9;
  }

  .families-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .family-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .family-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .family-card.expanded {
    grid-column: 1 / -1;
    border-color: var(--theme-accent, #818cf8);
  }

  .family-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theme-text, white);
    min-height: 44px;
  }

  .expanded .family-header {
    flex-direction: row;
    justify-content: center;
    gap: 16px;
  }

  .preview-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 8px;
  }

  .family-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .tuning-panel {
    padding: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .color-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .color-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    margin: 0;
  }

  .color-label.blue {
    color: #4f46e5;
  }

  .color-label.red {
    color: #dc2626;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .slider-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    min-height: 32px;
  }

  .slider-group input[type="range"] {
    flex: 1;
    min-width: 80px;
    accent-color: var(--theme-accent, #818cf8);
  }

  .value {
    font-family: monospace;
    font-weight: 600;
    color: var(--theme-text, white);
    min-width: 40px;
    text-align: right;
  }

  .pair-scale-section {
    grid-column: 1 / -1;
  }

  .pair-scale-section label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    min-height: 44px;
  }

  .pair-scale-section input[type="range"] {
    flex: 1;
    accent-color: var(--theme-accent, #818cf8);
  }

  .action-buttons {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .lab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    min-height: 44px;
  }

  .lab-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .lab-btn.danger {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  @media (max-width: 600px) {
    .prop-button-lab {
      padding: 16px;
    }

    .families-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
    }

    .tuning-panel {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .family-card {
      transition: none;
    }
  }
</style>
```

**Step 2: Register the lab tab in LabModule.svelte**

In `src/lib/features/lab/LabModule.svelte`, add to the `tabComponents` record (line ~47, before the closing `};`):

```typescript
    "prop-buttons": () => import("./tabs/PropButtonLab.svelte"),
```

**Step 3: Add tab definition in tab-definitions.ts**

In `src/lib/shared/navigation/config/tab-definitions.ts`, add before the closing `];` of `LAB_TABS` (after the museum entry at line ~764):

```typescript
  {
    id: "prop-buttons",
    label: "Prop Buttons",
    icon: '<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>',
    description: "Paired prop composition tuning for buttons",
    color: "#f97316",
    gradient: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
  },
```

**Step 4: Verify build compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/PropButtonLab.svelte src/lib/features/lab/LabModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat: add Prop Button Lab tab for composition tuning"
```

---

### Task 4: Integrate into PropIndicatorButton

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/shared/components/buttons/PropIndicatorButton.svelte`

**Step 1: Replace single img with PropCompositionPreview**

Replace the entire `<img>` element (lines 36-41) and update the script to also read redPropType:

In the `<script>` section, replace:
```typescript
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const displayInfo = $derived(getPropTypeDisplayInfo(bluePropType));
```

With:
```typescript
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const displayInfo = $derived(getPropTypeDisplayInfo(bluePropType));
```

(No change to the script variables — we still need `displayInfo` for the aria-label. We just add the import.)

Add import at line 9 (after the existing imports):
```typescript
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
```

Replace the `<img>` element (lines 36-41):
```svelte
  <img
    src={displayInfo.image}
    alt=""
    class="prop-icon"
    draggable="false"
  />
```

With:
```svelte
  <PropCompositionPreview propType={bluePropType} size={32} />
```

In the `<style>` section, remove the `.prop-icon` rule (lines 77-85) since it's no longer used.

**Step 2: Verify build compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/shared/components/buttons/PropIndicatorButton.svelte
git commit -m "feat: use paired prop composition in indicator button"
```

---

### Task 5: Verify in browser and iterate

This is the user-driven iteration step. No code to write — the user navigates to:

1. **Lab tab** — Lab module > "Prop Buttons" tab. Verify all 16 families render. Click a family and tune sliders. Copy recipes.
2. **Indicator button** — Create module > check the button panel's prop indicator. Verify paired composition renders at 32px.

**What to check:**
- SVG images load correctly (no broken images)
- Red prop is visually distinguishable from blue (hue-rotate working)
- Slider tuning in lab produces real-time visual changes
- Copy Recipe button copies valid JSON to clipboard
- Reset button restores default values
- Indicator button is still tappable and opens the prop drawer

**If compositions need tuning:**
- Use the lab tab to dial in values
- Copy the finalized recipes
- Update `prop-composition-recipes.ts` with the new values
- Commit the tuned recipes

---

### Task 6 (optional): Integrate into PropTypeButton in drawer

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/prop-type/PropTypeButton.svelte`

**Deferred:** This task is optional and should only be done after Austen has used the lab tab to finalize compositions. The PropTypeButton in the settings drawer is a larger surface (120px+) so compositions may need different sizing. The `size` prop on PropCompositionPreview handles this — just pass a larger size.

The integration follows the same pattern as Task 4: import PropCompositionPreview, replace the `<img>` with the component, pass the prop type and size.

---

## File Summary

| File | Action | Task |
|------|--------|------|
| `src/lib/shared/pictograph/prop/domain/prop-composition-recipes.ts` | Create | 1 |
| `src/lib/shared/pictograph/prop/components/PropCompositionPreview.svelte` | Create | 2 |
| `src/lib/features/lab/tabs/PropButtonLab.svelte` | Create | 3 |
| `src/lib/features/lab/LabModule.svelte` | Modify (add import) | 3 |
| `src/lib/shared/navigation/config/tab-definitions.ts` | Modify (add tab def) | 3 |
| `src/lib/features/create/shared/workspace-panel/shared/components/buttons/PropIndicatorButton.svelte` | Modify | 4 |
