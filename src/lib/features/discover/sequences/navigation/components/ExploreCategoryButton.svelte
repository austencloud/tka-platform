<script module lang="ts">
  // ✅ PURE RUNES: Type definitions
  export interface CategoryButtonProps {
    value?: string;
    label?: string;
    color?: string;
    image?: string;
    type?: string;
    difficulty?: string;
  }
</script>

<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    option,
    visualType = "",
    onSelected = () => {},
  } = $props<{
    option: CategoryButtonProps;
    visualType?: string;
    onSelected?: (value: string) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  function handleClick() {
    // Trigger selection haptic feedback for category selection
    hapticService?.trigger("selection");

    onSelected(option.value || option.label || "");
  }

  // Get button styling based on option type
  function getButtonStyle(option: CategoryButtonProps, visualType: string) {
    let style = "";

    if (option.color) {
      style += `--button-accent: ${option.color}; `;
    }

    if (visualType === "difficulty") {
      const colors: Record<string, string> = {
        "1": "var(--semantic-success)", // green
        "2": "var(--semantic-warning)", // yellow
        "3": "var(--semantic-error)", // red
        "4": "var(--theme-accent-strong, var(--theme-accent-strong))", // purple
      };
      style += `--button-accent: ${colors[String(option.value)] || "var(--theme-accent)"}; `;
    }

    return style;
  }

  // Get image path for visual types
  function getImagePath(visualType: string, value: string) {
    switch (visualType) {
      case "gridMode":
        return `/images/grid/${value.toLowerCase()}_grid.svg`;
      case "startPosition":
        return `/images/position_images/${value.toLowerCase()}.png`;
      case "difficulty": {
        // Map difficulty names to levels
        const difficultyMap: Record<string, string> = {
          beginner: "level_1",
          intermediate: "level_2",
          advanced: "level_3",
        };
        return `/images/level_images/${difficultyMap[value.toLowerCase()] || "level_1"}.png`;
      }
      default:
        return "";
    }
  }

  // Check if this visual type should display images
  function shouldShowImage(visualType: string) {
    return ["gridMode", "startPosition", "difficulty"].includes(visualType);
  }
</script>

<button
  class="category-button"
  class:visual={visualType}
  class:has-icon={option.icon}
  class:has-image={shouldShowImage(visualType)}
  data-visual-type={visualType}
  style={getButtonStyle(option, visualType)}
  onclick={handleClick}
  type="button"
>
  <!-- Unified image-based button content with consistent styling -->
  {#if shouldShowImage(visualType)}
    <img
      class="filter-image"
      src={getImagePath(visualType, option.value || option.label)}
      alt={option.label}
      loading="lazy"
    />
    <div class="image-label">{option.label}</div>
  {:else}
    <!-- Standard button content for non-image buttons -->
    {#if option.icon}
      <span class="button-icon">{@html option.icon}</span>
    {/if}
    <span class="button-label">{option.label}</span>
  {/if}
</button>

<style>
  .category-button {
    --button-accent: var(--theme-accent, var(--primary-color));

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);

    padding: var(--spacing-md);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--transition-fast);

    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text, white);

    min-height: 60px;
    position: relative;
    overflow: hidden;
  }

  .category-button::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--button-accent), transparent);
    opacity: 0;
    transition: opacity var(--transition-fast);
    z-index: 0;
  }

  .category-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--button-accent);
    box-shadow:
      0 4px 16px var(--theme-shadow),
      0 0 0 1px var(--button-accent),
      0 0 20px rgba(var(--button-accent-rgb, 99, 102, 241), 0.3);
    transform: translateY(-2px);
  }

  .category-button:hover::before {
    opacity: 0.1;
  }

  .category-button:active {
    transform: translateY(0);
    box-shadow:
      0 2px 8px var(--theme-shadow),
      0 0 0 1px var(--button-accent);
  }

  .category-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Visual type buttons (larger, more prominent) */
  .category-button.visual {
    min-height: 120px;
    padding: var(--spacing-lg);
  }

  .category-button.visual.has-icon {
    min-height: 140px;
  }

  /* Image-based buttons - unified consistent styling for gridMode, startPosition, and difficulty */
  .category-button.has-image {
    min-height: 280px;
    max-height: 320px;
    padding: var(--spacing-md);
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  /* Grid mode buttons - square shape to match the images */
  .category-button.has-image[data-visual-type="gridMode"] {
    min-height: 240px;
    max-height: 240px;
    width: 240px;
    aspect-ratio: 1;
  }

  /* Filter Image - consistent sizing across all image types */
  .filter-image {
    flex: 1;
    width: 90%;
    height: 75%;
    min-height: 200px;
    max-height: 240px;
    object-fit: contain;
    transition: transform var(--transition-fast);
    border-radius: 6px;
    background: white;
    padding: var(--spacing-xs);
    border: 1px solid var(--theme-stroke-strong);
  }

  /* Grid mode images - same size as other images, not square */
  .category-button[data-visual-type="gridMode"] .filter-image {
    width: 90%;
    height: 75%;
    min-height: 200px;
    max-height: 240px;
    /* Remove aspect-ratio to match other images */
  }

  .category-button:hover .filter-image {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  /* Image Label */
  .image-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-align: center;
    margin-top: var(--spacing-xs);
    padding: var(--spacing-xs);
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    flex-shrink: 0;
  }

  /* Button Icon */
  .button-icon {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-xs);
    z-index: 1;
    position: relative;
  }

  .visual .button-icon {
    font-size: var(--font-size-2xl);
  }

  /* Button Label */
  .button-label {
    text-align: center;
    line-height: 1.3;
    z-index: 1;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Animations */
  @keyframes difficultyPulse {
    0%,
    100% {
      opacity: 0.8;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .category-button {
      min-height: var(--min-touch-target);
      padding: var(--spacing-sm);
      font-size: var(--font-size-xs);
    }

    .category-button.visual {
      min-height: 100px;
    }

    .category-button.visual.has-icon {
      min-height: 120px;
    }

    .category-button.has-image {
      min-height: 220px;
      max-height: 260px;
      padding: var(--spacing-sm);
    }

    .category-button.has-image[data-visual-type="gridMode"] {
      min-height: 180px;
      max-height: 180px;
      width: 180px;
    }

    .filter-image {
      min-height: 160px;
      max-height: 180px;
      height: 70%;
    }

    .category-button[data-visual-type="gridMode"] .filter-image {
      min-height: 160px;
      max-height: 180px;
      /* Same size as other images on mobile */
    }

    .image-label {
      font-size: var(--font-size-xs);
    }

    .button-icon {
      font-size: var(--font-size-lg);
    }

    .visual .button-icon {
      font-size: var(--font-size-xl);
    }
  }

  @media (max-width: 480px) {
    .button-label {
      font-size: var(--font-size-xs);
    }

    .category-button.has-image {
      min-height: 200px;
      max-height: 240px;
    }

    .category-button.has-image[data-visual-type="gridMode"] {
      min-height: 160px;
      max-height: 160px;
      width: 160px;
    }

    .filter-image {
      min-height: 140px;
      max-height: 160px;
      height: 65%;
    }

    .category-button[data-visual-type="gridMode"] .filter-image {
      min-height: 140px;
      max-height: 160px;
      /* Same size as other images on small mobile */
    }
  }
</style>
