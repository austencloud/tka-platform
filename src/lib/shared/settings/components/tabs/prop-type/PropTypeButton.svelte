<script lang="ts">
  import { PropType } from "../../../../pictograph/prop/domain/enums/PropType";
  import { getPropTypeDisplayInfo } from "./PropTypeRegistry";
  import PropCompositionPreview from "../../../../pictograph/prop/components/PropCompositionPreview.svelte";

  let {
    propType,
    selected = false,
    selectedBlue = false,
    selectedRed = false,
    color = "blue",
    badge = undefined,
    onSelect,
  } = $props<{
    propType: PropType;
    selected?: boolean;
    selectedBlue?: boolean;
    selectedRed?: boolean;
    /**
     * Checkmark accent. "blue" / "red" use the prop-blue/prop-red tokens
     * (two-performer legacy); any other CSS color string applies inline
     * so callers can paint per-performer palettes.
     */
    color?: "blue" | "red" | (string & {});
    /** Variant count badge. Shown as a small circle in the top-right corner. */
    badge?: number;
    onSelect?: (propType: PropType) => void;
  }>();

  // Sentinel colors get class-based styling (uses theme tokens + shadow).
  // Arbitrary CSS color strings fall through to an inline style.
  const isSentinel = $derived(color === "blue" || color === "red");
  const customStyle = $derived(
    isSentinel
      ? ""
      : `background: ${color}; box-shadow: 0 3px 10px color-mix(in srgb, ${color} 50%, transparent), 0 1px 3px var(--theme-shadow);`,
  );

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

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
    <PropCompositionPreview {propType} />
  </div>
  <span class="prop-label">{displayInfo.label}</span>

  <!-- Variant count badge -->
  {#if badge}
    <div class="variant-badge" aria-label={`${badge} variants`}>{badge}</div>
  {/if}

  <!-- Checkmark indicator -->
  {#if selected || selectedBlue || selectedRed}
    <div class="checkmark-container">
      {#if selected}
        <!-- Single selection mode: show checkmark matching the color prop -->
        <div
          class="ios-checkmark"
          class:blue={color === "blue"}
          class:red={color === "red"}
          style={customStyle}
        >
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
    transition: all var(--duration-normal) cubic-bezier(0.36, 0.66, 0.04, 1);
    color: var(--theme-text);
    position: relative;
    padding: 6px 5px 4px;
    gap: 4px;
    border-radius: 10px;
    box-sizing: border-box;
    /* Slightly taller than wide for label space */
    aspect-ratio: 1 / 1.1;
    width: 100%;
    min-height: 44px;
    overflow: hidden;
  }

  .prop-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px) scale(1.01); /* iOS subtle lift */
    box-shadow: var(--theme-shadow-hover, 0 6px 18px rgba(0, 0, 0, 0.14));
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
    transition-duration: var(--duration-instant); /* iOS immediate feedback */
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

  .prop-image-container :global(.prop-composition-preview) {
    width: 85%;
    height: auto;
    aspect-ratio: 1;
    max-height: 85%;
    opacity: 0.9;
    transition: opacity var(--duration-normal) ease;
  }

  .prop-button:hover .prop-image-container :global(.prop-composition-preview) {
    opacity: 1;
  }

  .prop-button.selected
    .prop-image-container
    :global(.prop-composition-preview) {
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
    font-size: clamp(var(--font-size-compact, 12px), 2.5cqi, var(--font-size-sm, 14px));
    font-weight: 600;
    letter-spacing: -0.1px;
    line-height: 1.2;
    flex-shrink: 0;
    color: var(--theme-text, var(--theme-text));
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  /* Variant count badge */
  .variant-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    color: var(--theme-panel-bg, #121218);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    z-index: 10;
    pointer-events: none;
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
    animation: ios-checkmark-pop var(--duration-emphasis)
      cubic-bezier(0.36, 0.66, 0.04, 1);
  }

  .ios-checkmark.blue {
    background: var(--prop-blue-text, #818cf8);
    box-shadow:
      0 3px 10px
        color-mix(in srgb, var(--prop-blue-text, #818cf8) 50%, transparent),
      0 1px 3px var(--theme-shadow);
  }

  .ios-checkmark.red {
    background: var(--prop-red-text, #f87171);
    box-shadow:
      0 3px 10px
        color-mix(in srgb, var(--prop-red-text, #f87171) 50%, transparent),
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
    .ios-checkmark {
      transition: none;
      animation: none;
    }

    .prop-button:hover,
    .prop-button:active {
      transform: none;
    }

    .prop-image-container :global(.prop-composition-preview) {
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
</style>
