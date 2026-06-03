<!--
  PropIndicatorButton.svelte

  Shows current prop type icon in the button panel.
  Tap toggles the prop selection drawer (mounted at CreateModule level).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getSettings, updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getPropTypeDisplayInfo, getAllPropTypes } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { propDrawerState } from "$lib/shared/settings/state/prop-drawer-state.svelte";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const displayInfo = $derived(getPropTypeDisplayInfo(bluePropType));

  function shuffleToRandomProp() {
    const allProps = getAllPropTypes();
    const otherProps = allProps.filter((p) => p !== bluePropType);
    const randomProp = otherProps[Math.floor(Math.random() * otherProps.length)]!;

    try {
      const hapticService = getHapticFeedback();
      hapticService?.trigger("selection");
    } catch {
      // Haptic not available
    }

    updateSettings({ bluePropType: randomProp, redPropType: randomProp });
  }

  function handleClick(event: MouseEvent) {
    if (event.shiftKey) {
      shuffleToRandomProp();
      return;
    }

    try {
      const hapticService = getHapticFeedback();
      hapticService?.trigger("selection");
    } catch {
      // Haptic not available
    }
    propDrawerState.toggle();
  }
</script>

<button
  class="prop-indicator-button glass-button"
  onclick={(e) => handleClick(e)}
  aria-label="Change prop type. Current: {displayInfo.label}"
  title={displayInfo.label}
  data-testid="prop-indicator-button"
>
  <PropCompositionPreview propType={bluePropType} size={40} />
</button>

<style>
  .prop-indicator-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 2px solid var(--theme-accent, #818cf8);
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--transition-normal, var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1));
    box-shadow: 0 0 12px color-mix(in srgb, var(--theme-accent, #818cf8) 25%, transparent);
    -webkit-tap-highlight-color: transparent;
    padding: 0;
    filter: brightness(1.3) saturate(1.3);
  }

  .prop-indicator-button:hover {
    transform: scale(1.05);
    border-color: var(--theme-accent, #818cf8);
    box-shadow: 0 0 18px color-mix(in srgb, var(--theme-accent, #818cf8) 40%, transparent);
  }

  .prop-indicator-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .prop-indicator-button:focus-visible {
    outline: 2px solid var(--theme-accent, #818cf8);
    outline-offset: 2px;
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
