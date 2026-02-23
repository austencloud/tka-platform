<!--
  PropButtonLab.svelte - Visual tuning lab for paired prop compositions

  Shows all base prop families. Click to expand with large preview + compact controls.
  Number inputs for direct value entry, sliders for scrubbing, group rotation.
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

  let expandedFamily = $state<PropType | null>(null);
  let overrides = $state<Record<string, CompositionRecipe>>({});

  function getRecipe(propType: PropType): CompositionRecipe {
    return overrides[propType] ?? getCompositionRecipe(propType);
  }

  function ensureOverride(propType: PropType) {
    if (!overrides[propType]) {
      overrides[propType] = structuredClone(getCompositionRecipe(propType));
    }
  }

  function toggleFamily(propType: PropType) {
    if (expandedFamily === propType) {
      expandedFamily = null;
    } else {
      expandedFamily = propType;
      ensureOverride(propType);
    }
  }

  function updateTransform(
    propType: PropType,
    color: "blue" | "red",
    field: keyof PropTransform,
    value: number
  ) {
    ensureOverride(propType);
    (overrides[propType]![color] as PropTransform)[field] = value;
    overrides = { ...overrides };
  }

  function updatePairScale(propType: PropType, value: number) {
    ensureOverride(propType);
    overrides[propType]!.pairScale = value;
    overrides = { ...overrides };
  }

  /** Rotate both props as a group by adding degrees to both rotations */
  function rotateGroup(propType: PropType, degrees: number) {
    ensureOverride(propType);
    const recipe = overrides[propType]!;
    recipe.blue.rotation = ((recipe.blue.rotation + degrees + 180) % 360) - 180;
    recipe.red.rotation = ((recipe.red.rotation + degrees + 180) % 360) - 180;
    overrides = { ...overrides };
  }

  function resetFamily(propType: PropType) {
    delete overrides[propType];
    overrides = { ...overrides };
  }

  function copyRecipe(propType: PropType) {
    const recipe = getRecipe(propType);
    navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
  }

  function copyAllRecipes() {
    const all: Record<string, CompositionRecipe> = {};
    for (const family of families) {
      all[family.propType] = getRecipe(family.propType);
    }
    navigator.clipboard.writeText(JSON.stringify(all, null, 2));
  }

  /** Clamp a value and handle NaN from empty inputs */
  function clamp(val: number, min: number, max: number): number {
    if (Number.isNaN(val)) return min;
    return Math.min(max, Math.max(min, val));
  }
</script>

<div class="prop-button-lab">
  <header class="lab-header">
    <h1>Prop Button Lab</h1>
    <p class="subtitle">Tune paired prop compositions for buttons and drawers</p>
    <button class="copy-all-btn" onclick={copyAllRecipes}>
      <i class="fas fa-copy"></i> Copy All
    </button>
  </header>

  <div class="families-grid">
    {#each families as { propType }}
      {@const info = getPropTypeDisplayInfo(propType)}
      {@const recipe = getRecipe(propType)}
      {@const isExpanded = expandedFamily === propType}

      <div class="family-card" class:expanded={isExpanded}>
        <button class="family-header" onclick={() => toggleFamily(propType)}>
          <div class="preview-container" class:preview-large={isExpanded}>
            <PropCompositionPreview
              {propType}
              size={isExpanded ? 280 : 100}
              recipeOverride={overrides[propType]}
            />
          </div>
          {#if !isExpanded}
            <span class="family-label">{info.label}</span>
          {/if}
        </button>

        {#if isExpanded}
          <div class="expanded-layout">
            <!-- Left: large preview already rendered above in family-header -->
            <!-- Right: compact controls -->
            <div class="controls-panel">
              <div class="controls-header">
                <span class="family-name">{info.label}</span>
                <div class="header-actions">
                  <button class="icon-btn" onclick={() => copyRecipe(propType)} title="Copy recipe">
                    <i class="fas fa-copy"></i>
                  </button>
                  <button class="icon-btn danger" onclick={() => resetFamily(propType)} title="Reset">
                    <i class="fas fa-undo"></i>
                  </button>
                </div>
              </div>

              <!-- Group rotation -->
              <div class="group-rotation">
                <span class="section-label">Group Rotate</span>
                <div class="rotation-buttons">
                  <button class="rot-btn" onclick={() => rotateGroup(propType, -45)}>-45</button>
                  <button class="rot-btn" onclick={() => rotateGroup(propType, -15)}>-15</button>
                  <button class="rot-btn" onclick={() => rotateGroup(propType, -5)}>-5</button>
                  <button class="rot-btn" onclick={() => rotateGroup(propType, 5)}>+5</button>
                  <button class="rot-btn" onclick={() => rotateGroup(propType, 15)}>+15</button>
                  <button class="rot-btn" onclick={() => rotateGroup(propType, 45)}>+45</button>
                </div>
              </div>

              <!-- Blue / Red columns -->
              <div class="color-columns">
                {#each [["blue", "#4f46e5"], ["red", "#dc2626"]] as [color, accent]}
                  {@const t = recipe[color as "blue" | "red"]}
                  <div class="color-col">
                    <span class="color-dot" style="background: {accent}"></span>
                    <span class="color-label">{color === "blue" ? "Blue" : "Red"}</span>

                    <div class="field-row">
                      <span class="field-name">X</span>
                      <input
                        type="range" min="0" max="100" step="1" value={t.x}
                        oninput={(e) => updateTransform(propType, color as "blue" | "red", "x", +e.currentTarget.value)}
                      />
                      <input
                        type="number" min="0" max="100" step="1" value={t.x}
                        onchange={(e) => updateTransform(propType, color as "blue" | "red", "x", clamp(+e.currentTarget.value, 0, 100))}
                      />
                    </div>

                    <div class="field-row">
                      <span class="field-name">Y</span>
                      <input
                        type="range" min="0" max="100" step="1" value={t.y}
                        oninput={(e) => updateTransform(propType, color as "blue" | "red", "y", +e.currentTarget.value)}
                      />
                      <input
                        type="number" min="0" max="100" step="1" value={t.y}
                        onchange={(e) => updateTransform(propType, color as "blue" | "red", "y", clamp(+e.currentTarget.value, 0, 100))}
                      />
                    </div>

                    <div class="field-row">
                      <span class="field-name">Rot</span>
                      <input
                        type="range" min="-180" max="180" step="5" value={t.rotation}
                        oninput={(e) => updateTransform(propType, color as "blue" | "red", "rotation", +e.currentTarget.value)}
                      />
                      <input
                        type="number" min="-180" max="180" step="1" value={t.rotation}
                        onchange={(e) => updateTransform(propType, color as "blue" | "red", "rotation", clamp(+e.currentTarget.value, -180, 180))}
                      />
                    </div>

                    <div class="field-row">
                      <span class="field-name">Scale</span>
                      <input
                        type="range" min="0.1" max="1" step="0.05" value={t.scale}
                        oninput={(e) => updateTransform(propType, color as "blue" | "red", "scale", +e.currentTarget.value)}
                      />
                      <input
                        type="number" min="0.1" max="1" step="0.01" value={t.scale}
                        onchange={(e) => updateTransform(propType, color as "blue" | "red", "scale", clamp(+e.currentTarget.value, 0.1, 1))}
                      />
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Pair scale -->
              <div class="field-row pair-scale-row">
                <span class="field-name">Pair Scale</span>
                <input
                  type="range" min="0.5" max="1.5" step="0.05" value={recipe.pairScale}
                  oninput={(e) => updatePairScale(propType, +e.currentTarget.value)}
                />
                <input
                  type="number" min="0.5" max="1.5" step="0.01" value={recipe.pairScale}
                  onchange={(e) => updatePairScale(propType, clamp(+e.currentTarget.value, 0.5, 1.5))}
                />
              </div>
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
    margin-bottom: 20px;
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

  /* === Grid of families === */
  .families-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }

  .family-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
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
    gap: 6px;
    padding: 10px;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theme-text, white);
    min-height: 44px;
  }

  .preview-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 6px;
  }

  .preview-large {
    padding: 16px;
    border-radius: 12px;
  }

  .family-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* === Expanded layout: preview left, controls right === */
  .expanded .family-header {
    padding: 16px;
  }

  .expanded-layout {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .controls-panel {
    padding: 12px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .controls-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .family-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .header-actions {
    display: flex;
    gap: 6px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 12px;
    cursor: pointer;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  .icon-btn.danger {
    color: #ef4444;
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* === Group rotation === */
  .group-rotation {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
    min-width: 70px;
  }

  .rotation-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .rot-btn {
    padding: 4px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 11px;
    font-family: monospace;
    cursor: pointer;
    min-height: 28px;
  }

  .rot-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
  }

  /* === Blue / Red columns === */
  .color-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .color-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .color-col .color-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    margin: 0;
    display: inline;
  }

  .color-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }

  /* === Field row: label + slider + number input === */
  .field-row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 26px;
  }

  .field-name {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    min-width: 32px;
    font-family: monospace;
  }

  .field-row input[type="range"] {
    flex: 1;
    min-width: 60px;
    max-width: 160px;
    height: 4px;
    accent-color: var(--theme-accent, #818cf8);
  }

  .field-row input[type="number"] {
    width: 54px;
    padding: 2px 4px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    color: var(--theme-text, white);
    font-size: 11px;
    font-family: monospace;
    text-align: right;
  }

  .field-row input[type="number"]:focus {
    outline: 1px solid var(--theme-accent, #818cf8);
    border-color: var(--theme-accent, #818cf8);
  }

  /* Remove number input spinner arrows for cleaner look */
  .field-row input[type="number"]::-webkit-inner-spin-button,
  .field-row input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .field-row input[type="number"] {
    -moz-appearance: textfield;
  }

  .pair-scale-row {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .pair-scale-row input[type="range"] {
    max-width: 200px;
  }

  @media (max-width: 600px) {
    .prop-button-lab {
      padding: 16px;
    }

    .families-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
    }

    .color-columns {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .family-card {
      transition: none;
    }
  }
</style>
