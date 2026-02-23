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
