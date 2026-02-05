<!--
  PropIndicatorButton.svelte

  Shows current prop type icon in the button panel.
  Tap opens PropSelectionSheet for quick prop changes.
-->
<script lang="ts">
  import { getSettings, updateSetting } from "$lib/shared/application/state/app-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import PropSelectionSheet from "$lib/shared/settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import { container } from "$lib/shared/di";

  let sheetOpen = $state(false);

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const displayInfo = $derived(getPropTypeDisplayInfo(bluePropType));

  function handleClick() {
    try {
      const hapticService = container.items.hapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Haptic not available
    }
    sheetOpen = true;
  }

  function handleSelect(propType: PropType) {
    updateSetting("bluePropType", propType);
    if (!settings.catDogMode) {
      updateSetting("redPropType", propType);
    }
    sheetOpen = false;
  }
</script>

<button
  class="prop-indicator-button glass-button"
  onclick={handleClick}
  aria-label="Change prop type. Current: {displayInfo.label}"
  title={displayInfo.label}
  data-testid="prop-indicator-button"
>
  <img
    src={displayInfo.image}
    alt=""
    class="prop-icon"
    draggable="false"
  />
</button>

<PropSelectionSheet
  bind:isOpen={sheetOpen}
  selectedPropType={bluePropType}
  color="blue"
  title="Change Prop"
  onSelect={handleSelect}
/>

<style>
  .prop-indicator-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(30, 30, 46, 0.95));
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    -webkit-tap-highlight-color: transparent;
    padding: 0;
  }

  .prop-indicator-button:hover {
    transform: scale(1.05);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }

  .prop-indicator-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .prop-indicator-button:focus-visible {
    outline: 2px solid var(--theme-accent, #818cf8);
    outline-offset: 2px;
  }

  .prop-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    pointer-events: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Mobile responsive - 48px minimum */
  @media (max-width: 768px) {
    .prop-indicator-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }
  }

  /* Landscape mobile */
  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    .prop-indicator-button {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .prop-indicator-button {
      border: 2px solid var(--theme-stroke-strong);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .prop-indicator-button {
      transition: none;
    }

    .prop-indicator-button:hover,
    .prop-indicator-button:active {
      transform: none;
    }
  }
</style>
