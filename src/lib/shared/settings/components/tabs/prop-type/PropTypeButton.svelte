<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { PropType } from "../../../../pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import PropCompositionPreview from "../../../../pictograph/prop/components/PropCompositionPreview.svelte";

  let {
    propType,
    selected = false,
    selectedBlue = false,
    selectedRed = false,
    color = "blue",
    badge = undefined,
    actionLabel,
    buttonProps,
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
    /** Override when the tile opens a family chooser instead of selecting. */
    actionLabel?: string;
    /** Native trigger attributes supplied by a headless interaction primitive. */
    buttonProps?: HTMLButtonAttributes;
    onSelect?: (propType: PropType) => void;
  }>();

  // Sentinel colors get class-based styling (uses theme tokens + shadow).
  // Arbitrary CSS color strings fall through to an inline style.
  const isSentinel = $derived(color === "blue" || color === "red");
  const customStyle = $derived(
    isSentinel
      ? ""
      : `background: ${color}; box-shadow: 0 3px 10px color-mix(in srgb, ${color} 50%, transparent), 0 1px 3px var(--theme-shadow);`
  );

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));

  function handleClick() {
    onSelect?.(propType);
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " ") && onSelect) {
      e.preventDefault();
      onSelect(propType);
    }
  }
</script>

<button
  class="prop-button"
  class:selected
  onclick={handleClick}
  onkeydown={handleKeydown}
  {...buttonProps}
  aria-label={actionLabel ?? `Select ${displayInfo.label} prop type`}
  aria-pressed={selected}
  data-ghost={selected ? undefined : "safe"}
  data-ghost-kind={selected ? undefined : "prop"}
  data-ghost-label={displayInfo.label}
  title={actionLabel ?? `${displayInfo.label} - Click to select this prop type`}
>
  <div class="prop-image-container">
    <PropCompositionPreview {propType} neutral />
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
  .prop-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition:
      color var(--duration-normal, 200ms) cubic-bezier(0.22, 1, 0.36, 1),
      background-color var(--duration-normal, 200ms)
        cubic-bezier(0.22, 1, 0.36, 1),
      border-color var(--duration-normal, 200ms) cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow var(--duration-normal, 200ms) cubic-bezier(0.22, 1, 0.36, 1),
      transform var(--duration-fast, 150ms) cubic-bezier(0.22, 1, 0.36, 1);
    color: var(--theme-text);
    position: relative;
    padding: 8px 4px 6px;
    gap: 4px;
    border-radius: 12px;
    box-sizing: border-box;
    aspect-ratio: 1 / 1.15;
    width: 100%;
    min-height: 44px;
    overflow: hidden;
  }

  .prop-button:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .prop-button.selected {
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text);
    box-shadow: 0 0 16px
      color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .prop-button.selected:hover {
    background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
  }

  .prop-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .prop-button:active {
    transform: scale(0.96);
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
    width: 75%;
    height: auto;
    aspect-ratio: 1;
    max-height: 75%;
    opacity: 0.45;
    transition: opacity var(--duration-normal, 200ms) ease;
  }

  .prop-button:hover .prop-image-container :global(.prop-composition-preview) {
    opacity: 0.7;
  }

  .prop-button.selected
    .prop-image-container
    :global(.prop-composition-preview) {
    opacity: 0.95;
  }

  .prop-label {
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    width: 100%;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    letter-spacing: -0.1px;
    line-height: 1.2;
    flex-shrink: 0;
    color: var(--theme-text-dim);
    opacity: 0.4;
    transition:
      color var(--duration-normal, 200ms) ease,
      opacity var(--duration-normal, 200ms) ease;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .prop-button:hover .prop-label {
    opacity: 0.65;
  }

  .prop-button.selected .prop-label {
    opacity: 1;
    color: var(--theme-accent);
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

  .ios-checkmark {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 9px;
    font-weight: 700;
    animation: ios-checkmark-pop var(--duration-emphasis, 300ms)
      cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .ios-checkmark.blue {
    background: var(--theme-accent, #818cf8);
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--theme-accent, #818cf8) 40%, transparent);
  }

  .ios-checkmark.red {
    background: var(--prop-red-text, #f87171);
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--prop-red-text, #f87171) 40%, transparent);
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
