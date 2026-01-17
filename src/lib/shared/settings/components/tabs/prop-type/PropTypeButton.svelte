<script lang="ts">
  import { PropType } from "../../../../pictograph/prop/domain/enums/PropType";
  import { MotionColor } from "../../../../pictograph/shared/domain/enums/pictograph-enums";
  import { getMotionColor } from "../../../../utils/svg-color-utils";
  import { getPropTypeDisplayInfo } from "./PropTypeRegistry";

  let {
    propType,
    selected = false,
    selectedBlue = false,
    selectedRed = false,
    shouldRotate = false,
    color = "blue",
    onSelect,
    onImageLoad,
  } = $props<{
    propType: PropType;
    selected?: boolean;
    selectedBlue?: boolean;
    selectedRed?: boolean;
    shouldRotate?: boolean;
    color?: "blue" | "red";
    onSelect?: (propType: PropType) => void;
    onImageLoad?: (propType: PropType, width: number, height: number) => void;
  }>();

  // Reactive display info - recalculates when propType changes
  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  let svgContent = $state("");
  let viewBox = $state("0 0 100 100");
  let isLoading = $state(true);

  // Reactive loading based on color prop
  $effect(() => {
    // Watch both propType and color
    propType;
    color;
    loadAndTransformSvg();
  });

  async function loadAndTransformSvg() {
    isLoading = true;
    try {
      const response = await fetch(displayInfo.image);
      if (!response.ok)
        throw new Error(`Failed to fetch SVG: ${response.status}`);

      let svgText = await response.text();

      // Apply color transformation BEFORE parsing (transform the raw text)
      const targetColor = color === "red" ? MotionColor.RED : MotionColor.BLUE;
      svgText = applyColorToSvg(svgText, targetColor);

      // Now parse the transformed SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, "image/svg+xml");
      const svgElement = doc.querySelector("svg");

      if (svgElement) {
        const viewBoxAttr = svgElement.getAttribute("viewBox");
        if (viewBoxAttr) {
          viewBox = viewBoxAttr;
        }

        // Report dimensions for rotation logic
        const [, , w, h] = viewBoxAttr?.split(" ").map(Number) || [
          0, 0, 100, 100,
        ];
        onImageLoad?.(propType, w || 100, h || 100);

        // Extract inner content from transformed SVG
        svgContent = svgElement.innerHTML;
      }

      isLoading = false;
    } catch (error) {
      console.error("Failed to load prop SVG:", error);
      isLoading = false;
    }
  }

  function applyColorToSvg(svgText: string, motionColor: MotionColor): string {
    // Use "dark" mode for prop type buttons (shown on dark card backgrounds)
    const targetColor = getMotionColor(motionColor, "dark");

    // Accent colors to preserve
    const ACCENT_COLORS_TO_PRESERVE = ["#c9ac68"];

    // Replace fill attributes
    let coloredSvg = svgText.replace(
      /fill="(#[0-9A-Fa-f]{3,6})"/gi,
      (match, capturedColor) => {
        const colorLower = capturedColor.toLowerCase();
        if (
          ACCENT_COLORS_TO_PRESERVE.some(
            (accent) => accent.toLowerCase() === colorLower
          )
        ) {
          return match;
        }
        return `fill="${targetColor}"`;
      }
    );

    // Replace fill in CSS styles
    coloredSvg = coloredSvg.replace(
      /fill:\s*(#[0-9A-Fa-f]{3,6})/gi,
      (match, capturedColor) => {
        const colorLower = capturedColor.toLowerCase();
        if (
          ACCENT_COLORS_TO_PRESERVE.some(
            (accent) => accent.toLowerCase() === colorLower
          )
        ) {
          return match;
        }
        return `fill:${targetColor}`;
      }
    );

    // Replace stroke attributes (important for line-based props)
    coloredSvg = coloredSvg.replace(
      /stroke="(#[0-9A-Fa-f]{3,6})"/gi,
      (match, capturedColor) => {
        const colorLower = capturedColor.toLowerCase();
        if (
          ACCENT_COLORS_TO_PRESERVE.some(
            (accent) => accent.toLowerCase() === colorLower
          )
        ) {
          return match;
        }
        return `stroke="${targetColor}"`;
      }
    );

    // Replace stroke in CSS styles
    coloredSvg = coloredSvg.replace(
      /stroke:\s*(#[0-9A-Fa-f]{3,6})/gi,
      (match, capturedColor) => {
        const colorLower = capturedColor.toLowerCase();
        if (
          ACCENT_COLORS_TO_PRESERVE.some(
            (accent) => accent.toLowerCase() === colorLower
          )
        ) {
          return match;
        }
        return `stroke:${targetColor}`;
      }
    );

    // Make CSS class names unique for each color
    const colorSuffix = motionColor.toLowerCase();
    coloredSvg = coloredSvg.replace(/\.st(\d+)/g, `.st$1-${colorSuffix}`);
    coloredSvg = coloredSvg.replace(
      /class="st(\d+)"/g,
      `class="st$1-${colorSuffix}"`
    );

    // Remove centerPoint circle
    coloredSvg = coloredSvg.replace(
      /<circle[^>]*id="centerPoint"[^>]*\/?>/,
      ""
    );

    return coloredSvg;
  }

  function handleClick() {
    onSelect?.(propType);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(propType);
    }
  }
</script>

<button
  class="prop-button"
  class:selected
  onclick={handleClick}
  onkeydown={handleKeydown}
  aria-label={`Select ${displayInfo.label} prop type`}
  aria-pressed={selected}
  title={`${displayInfo.label} - Click to select this prop type`}
>
  <div class="prop-image-container">
    {#if isLoading}
      <div class="prop-loading">Loading...</div>
    {:else}
      <svg
        class="prop-image"
        class:rotated={shouldRotate}
        {viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        {@html svgContent}
      </svg>
    {/if}
  </div>
  <span class="prop-label">{displayInfo.label}</span>

  <!-- Checkmark indicator -->
  {#if selected || selectedBlue || selectedRed}
    <div class="checkmark-container">
      {#if selected}
        <!-- Single selection mode: show checkmark matching the color prop -->
        <div class="ios-checkmark {color}">
          <i class="fas fa-check" aria-hidden="true"></i>
        </div>
      {:else}
        <!-- Dual selection mode (both props shown, rare case) -->
        {#if selectedBlue}
          <div class="ios-checkmark blue">
            <i class="fas fa-check" aria-hidden="true"></i>
          </div>
        {/if}
        {#if selectedRed}
          <div class="ios-checkmark red" class:offset={selectedBlue}>
            <i class="fas fa-check" aria-hidden="true"></i>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</button>

<style>
  /* iOS-native prop button - Inline Grid Optimized */
  .prop-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.36, 0.66, 0.04, 1);
    color: var(--theme-text);
    position: relative;
    /* Percentage-based padding scales with button size */
    padding: 8% 6% 6%;
    gap: 4%;
    border-radius: 10px;
    box-sizing: border-box;
    /* Taller than wide: width is 1, height is 1.2 */
    aspect-ratio: 1 / 1.2;
    width: 100%;
    overflow: hidden;
    box-shadow: var(--theme-shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
  }

  .prop-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px) scale(1.01); /* iOS subtle lift */
    box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.14),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Selected - Uses theme accent */
  .prop-button.selected {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: var(--theme-text);
    transform: scale(1.02); /* Slightly larger when selected */
    box-shadow:
      0 6px 20px color-mix(in srgb, var(--theme-accent) 25%, transparent),
      0 2px 6px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .prop-button.selected:hover {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    transform: translateY(-1px) scale(1.03);
  }

  .prop-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .prop-button:active {
    transform: scale(0.98);
    transition-duration: 0.1s; /* iOS immediate feedback */
  }

  .prop-image-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    /* Flex-grow to fill available space above the label */
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .prop-loading {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .prop-image {
    width: 100%;
    height: 100%;
    max-width: 85%;
    max-height: 85%;
    object-fit: contain;
    opacity: 0.9;
    transition: opacity 0.2s ease;
  }

  /* Rotate image 90 degrees counterclockwise when aspect ratios don't match */
  .prop-image.rotated {
    transform: rotate(-90deg);
  }

  .prop-button:hover .prop-image {
    opacity: 1;
  }

  .prop-button.selected .prop-image {
    opacity: 1;
  }

  /* Label typography */
  .prop-label {
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    width: 100%;
    font-size: clamp(9px, 2.5cqi, 11px);
    font-weight: 600;
    letter-spacing: -0.1px;
    line-height: 1.2;
    flex-shrink: 0;
    color: var(--theme-text, var(--theme-text));
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  /* Checkmark container */
  .checkmark-container {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 3px;
    z-index: 10;
  }

  /* Compact checkmark for inline grid */
  .ios-checkmark {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 700;
    animation: ios-checkmark-pop 0.3s cubic-bezier(0.36, 0.66, 0.04, 1);
  }

  .ios-checkmark.blue {
    background: var(--prop-blue);
    box-shadow:
      0 3px 10px color-mix(in srgb, var(--prop-blue) 50%, transparent),
      0 1px 3px var(--theme-shadow);
  }

  .ios-checkmark.red {
    background: var(--prop-red);
    box-shadow:
      0 3px 10px color-mix(in srgb, var(--prop-red) 50%, transparent),
      0 1px 3px var(--theme-shadow);
  }

  /* When both checkmarks are present, offset the red one slightly */
  .ios-checkmark.red.offset {
    margin-left: -8px;
  }

  @keyframes ios-checkmark-pop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* iOS Accessibility - Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .prop-button,
    .prop-image,
    .ios-checkmark {
      transition: none;
      animation: none;
    }

    .prop-button:hover,
    .prop-button:active {
      transform: none;
    }

    /* Keep rotation but remove transition animation */
    .prop-image {
      transition: none;
    }
  }

  /* iOS Accessibility - High Contrast */
  @media (prefers-contrast: high) {
    .prop-button {
      border: 2px solid var(--theme-stroke-strong);
    }

    .prop-button.selected {
      border: 2px solid var(--theme-accent);
      background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    }
  }

  /* Light mode support - skipped, app is dark-mode only */
</style>
