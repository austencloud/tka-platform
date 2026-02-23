<!--
  PropIndicatorButton.svelte

  Shows current prop type icon in the button panel.
  Tap toggles the prop selection drawer (mounted at CreateModule level).
-->
<script lang="ts">
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { propDrawerState } from "$lib/shared/settings/state/prop-drawer-state.svelte";
  import { container } from "$lib/shared/di";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";

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
    propDrawerState.toggle();
  }
</script>

<button
  class="prop-indicator-button glass-button"
  onclick={handleClick}
  aria-label="Change prop type. Current: {displayInfo.label}"
  title={displayInfo.label}
  data-testid="prop-indicator-button"
>
  <PropCompositionPreview propType={bluePropType} size={32} />
</button>

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
