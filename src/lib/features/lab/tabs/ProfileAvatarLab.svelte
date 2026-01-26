<!--
  ProfileAvatarLab.svelte - Experiment with generated avatar designs

  Visualize combinations of:
  - Avatar shapes (circle, rounded square, hexagon, squircle)
  - Theme-derived gradient backgrounds
  - Prop silhouettes as center elements
  - Size variations
-->
<script lang="ts">
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { BACKGROUND_THEME_COLORS } from "$lib/shared/settings/utils/background-theme-calculator";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    PROP_TYPE_DISPLAY_REGISTRY,
    VARIANT_PROP_TYPES,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  // ============ TYPES ============

  type AvatarShape = "circle" | "rounded-square" | "hexagon" | "squircle";

  interface ShapeOption {
    id: AvatarShape;
    label: string;
    icon: string;
  }

  interface ThemeOption {
    id: BackgroundType;
    label: string;
    colors: string[];
  }

  interface PropOption {
    id: PropType;
    label: string;
    image: string;
  }

  // ============ CONFIGURATION ============

  const SHAPES: ShapeOption[] = [
    { id: "circle", label: "Circle", icon: "fa-circle" },
    { id: "rounded-square", label: "Rounded Square", icon: "fa-square" },
    { id: "hexagon", label: "Hexagon", icon: "fa-hexagon" },
    { id: "squircle", label: "Squircle", icon: "fa-stop" },
  ];

  // Build theme options from background types (excluding solid/gradient which need user colors)
  const THEMES: ThemeOption[] = [
    {
      id: BackgroundType.NIGHT_SKY,
      label: "Night Sky",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.NIGHT_SKY],
    },
    {
      id: BackgroundType.DEEP_OCEAN,
      label: "Deep Ocean",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.DEEP_OCEAN],
    },
    {
      id: BackgroundType.EMBER_GLOW,
      label: "Ember Glow",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.EMBER_GLOW],
    },
    {
      id: BackgroundType.SAKURA_DRIFT,
      label: "Sakura",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.SAKURA_DRIFT],
    },
    {
      id: BackgroundType.FIREFLY_FOREST,
      label: "Forest",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.FIREFLY_FOREST],
    },
    {
      id: BackgroundType.AUTUMN_DRIFT,
      label: "Autumn",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.AUTUMN_DRIFT],
    },
    {
      id: BackgroundType.SNOWFALL,
      label: "Snowfall",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.SNOWFALL],
    },
    {
      id: BackgroundType.PRIDE,
      label: "Pride",
      colors: BACKGROUND_THEME_COLORS[BackgroundType.PRIDE],
    },
  ];

  // Build prop options - exclude variants, just show base props
  const PROPS: PropOption[] = Object.entries(PROP_TYPE_DISPLAY_REGISTRY)
    .filter(([propType]) => !VARIANT_PROP_TYPES.includes(propType as PropType))
    .map(([propType, info]) => ({
      id: propType as PropType,
      label: info.label,
      image: info.image,
    }));

  // ============ STATE ============

  let selectedShape = $state<AvatarShape>("circle");
  let selectedTheme = $state<BackgroundType>(BackgroundType.NIGHT_SKY);
  let selectedProp = $state<PropType>(PropType.STAFF);
  let previewSize = $state<number>(96);

  // ============ DERIVED ============

  const currentThemeColors = $derived(
    THEMES.find((t) => t.id === selectedTheme)?.colors ?? ["#1e1b4b", "#4338ca"]
  );

  const currentPropImage = $derived(
    PROPS.find((p) => p.id === selectedProp)?.image ?? ""
  );

  // Generate gradient CSS from theme colors
  function buildGradient(colors: string[]): string {
    if (colors.length === 1) return colors[0]!;
    if (colors.length === 2) {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    }
    // For 3+ colors, distribute evenly
    const stops = colors
      .map((c, i) => `${c} ${Math.round((i / (colors.length - 1)) * 100)}%`)
      .join(", ");
    return `linear-gradient(135deg, ${stops})`;
  }

  // Get clip-path for shape
  function getClipPath(shape: AvatarShape): string {
    switch (shape) {
      case "circle":
        return "circle(50% at 50% 50%)";
      case "rounded-square":
        return "inset(0 round 16%)";
      case "hexagon":
        return "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
      case "squircle":
        // Superellipse approximation
        return "inset(0 round 30%)";
      default:
        return "circle(50% at 50% 50%)";
    }
  }

  // Get border-radius for shape (used alongside clip-path for better anti-aliasing)
  function getBorderRadius(shape: AvatarShape): string {
    switch (shape) {
      case "circle":
        return "50%";
      case "rounded-square":
        return "16%";
      case "hexagon":
        return "0";
      case "squircle":
        return "30%";
      default:
        return "50%";
    }
  }
</script>

<div class="avatar-lab">
  <header class="lab-header">
    <h1>Profile Avatar Lab</h1>
    <p>Experiment with generated avatar designs for users without photos</p>
  </header>

  <div class="lab-content">
    <!-- Large Preview -->
    <section class="preview-section">
      <div
        class="avatar-preview"
        style="
          width: {previewSize}px;
          height: {previewSize}px;
          background: {buildGradient(currentThemeColors)};
          clip-path: {getClipPath(selectedShape)};
          border-radius: {getBorderRadius(selectedShape)};
        "
      >
        {#if currentPropImage}
          <img
            src={currentPropImage}
            alt="Prop silhouette"
            class="prop-silhouette"
          />
        {/if}
      </div>

      <!-- Size slider -->
      <div class="size-control">
        <label>
          <span>Size: {previewSize}px</span>
          <input
            type="range"
            min="48"
            max="200"
            step="8"
            bind:value={previewSize}
          />
        </label>
      </div>
    </section>

    <!-- Controls -->
    <section class="controls-section">
      <!-- Shape Selection -->
      <div class="control-group">
        <h3>Shape</h3>
        <div class="shape-options">
          {#each SHAPES as shape}
            <button
              class="shape-option"
              class:selected={selectedShape === shape.id}
              onclick={() => (selectedShape = shape.id)}
            >
              <i class="fas {shape.icon}"></i>
              <span>{shape.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Theme Selection -->
      <div class="control-group">
        <h3>Theme (Background)</h3>
        <div class="theme-options">
          {#each THEMES as theme}
            <button
              class="theme-option"
              class:selected={selectedTheme === theme.id}
              onclick={() => (selectedTheme = theme.id)}
              style="background: {buildGradient(theme.colors)};"
              title={theme.label}
            >
              {#if selectedTheme === theme.id}
                <i class="fas fa-check"></i>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Prop Selection -->
      <div class="control-group">
        <h3>Favorite Prop</h3>
        <div class="prop-options">
          {#each PROPS as prop}
            <button
              class="prop-option"
              class:selected={selectedProp === prop.id}
              onclick={() => (selectedProp = prop.id)}
              title={prop.label}
            >
              <img src={prop.image} alt={prop.label} />
            </button>
          {/each}
        </div>
      </div>
    </section>

    <!-- Grid Preview: Show all themes with selected shape and prop -->
    <section class="grid-section">
      <h3>All Themes Preview</h3>
      <div class="avatar-grid">
        {#each THEMES as theme}
          <div class="grid-item">
            <div
              class="avatar-preview small"
              style="
                width: 64px;
                height: 64px;
                background: {buildGradient(theme.colors)};
                clip-path: {getClipPath(selectedShape)};
                border-radius: {getBorderRadius(selectedShape)};
              "
            >
              {#if currentPropImage}
                <img
                  src={currentPropImage}
                  alt="Prop silhouette"
                  class="prop-silhouette"
                />
              {/if}
            </div>
            <span class="theme-label">{theme.label}</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- Shape Comparison: Show all shapes with selected theme and prop -->
    <section class="grid-section">
      <h3>All Shapes Preview</h3>
      <div class="avatar-grid">
        {#each SHAPES as shape}
          <div class="grid-item">
            <div
              class="avatar-preview small"
              style="
                width: 64px;
                height: 64px;
                background: {buildGradient(currentThemeColors)};
                clip-path: {getClipPath(shape.id)};
                border-radius: {getBorderRadius(shape.id)};
              "
            >
              {#if currentPropImage}
                <img
                  src={currentPropImage}
                  alt="Prop silhouette"
                  class="prop-silhouette"
                />
              {/if}
            </div>
            <span class="theme-label">{shape.label}</span>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .avatar-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .lab-header {
    margin-bottom: 24px;
  }

  .lab-header h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .lab-header p {
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .lab-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* Preview Section */
  .preview-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .avatar-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .avatar-preview.small {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .prop-silhouette {
    width: 60%;
    height: 60%;
    object-fit: contain;
    filter: brightness(0) invert(1) opacity(0.85);
  }

  .size-control {
    width: 100%;
    max-width: 300px;
  }

  .size-control label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .size-control input[type="range"] {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    appearance: none;
  }

  .size-control input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    cursor: pointer;
  }

  /* Controls Section */
  .controls-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .control-group h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Shape Options */
  .shape-options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .shape-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 12px;
  }

  .shape-option:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .shape-option.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .shape-option i {
    font-size: 20px;
  }

  /* Theme Options */
  .theme-options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .theme-option {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
  }

  .theme-option:hover {
    transform: scale(1.05);
  }

  .theme-option.selected {
    border-color: white;
    box-shadow: 0 0 0 2px var(--theme-accent, #6366f1);
  }

  /* Prop Options */
  .prop-options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .prop-option {
    width: 48px;
    height: 48px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .prop-option:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .prop-option.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .prop-option img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  /* Grid Section */
  .grid-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .grid-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .avatar-grid {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .theme-label {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
</style>
