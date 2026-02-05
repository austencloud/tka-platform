<!--
  FloatingPropIndicator.svelte

  Persistent floating button showing the current prop icon.
  Tap opens PropSelectionSheet for quick prop changes from any module.
  Hides when already on Settings > Props tab.
-->
<script lang="ts">
  import { getSettings, updateSetting } from "$lib/shared/application/state/app-state.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import PropSelectionSheet from "./tabs/prop-type/PropSelectionSheet.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  let sheetOpen = $state(false);

  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const displayInfo = $derived(getPropTypeDisplayInfo(bluePropType));

  // Hide when user is already on Settings > Props tab
  const isOnPropsTab = $derived(
    navigationState.currentModule === "settings" &&
    navigationState.activeTab === "props"
  );

  // Bottom offset accounts for mobile nav bar
  const bottomOffset = $derived(layoutState.primaryNavHeight ?? 0);

  function handleOpen() {
    try {
      const haptic = container.items.hapticFeedback as IHapticFeedback;
      haptic.trigger("selection");
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

{#if !isOnPropsTab}
  <button
    class="floating-prop-indicator"
    style="--bottom-offset: {bottomOffset}px"
    onclick={handleOpen}
    aria-label="Change prop type. Current: {displayInfo.label}"
    title={displayInfo.label}
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
{/if}

<style>
  .floating-prop-indicator {
    position: fixed;
    right: 16px;
    bottom: calc(var(--bottom-offset, 0px) + 16px);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(30, 30, 46, 0.95));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 70;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 1px 4px rgba(0, 0, 0, 0.2);
    transition:
      transform var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    padding: 0;
  }

  .floating-prop-indicator:hover {
    transform: scale(1.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.35),
      0 2px 6px rgba(0, 0, 0, 0.25);
  }

  .floating-prop-indicator:active {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .floating-prop-indicator:focus-visible {
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

  /* Desktop: no nav bar offset */
  @media (min-width: 1024px) {
    .floating-prop-indicator {
      bottom: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-prop-indicator {
      transition: none;
    }

    .floating-prop-indicator:hover,
    .floating-prop-indicator:active {
      transform: none;
    }
  }
</style>
