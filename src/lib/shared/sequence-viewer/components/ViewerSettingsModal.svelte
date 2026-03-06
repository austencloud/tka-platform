<!--
  ViewerSettingsModal.svelte

  Near-full-screen modal for viewer settings.
  Renders the actual VisibilityTab panels (same components, same state managers)
  plus a prop selector section at the top. One source of truth for all visibility settings.
-->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import VisibilityTab from "$lib/shared/settings/components/tabs/VisibilityTab.svelte";
  import PropSelectionSheet from "$lib/shared/settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import { getSettings, updateSetting } from "$lib/shared/application/state/app-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open = $bindable(), onClose }: Props = $props();

  // Prop selector drawer state
  let propDrawerOpen = $state(false);
  let activeTab = $state<"blue" | "red">("blue");

  // Current prop types from settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const redPropType = $derived(settings.redPropType ?? PropType.STAFF);
  const catDogMode = $derived(settings.catDogMode ?? false);

  // Display info for current props
  const blueDisplayInfo = $derived(getPropTypeDisplayInfo(bluePropType));
  const redDisplayInfo = $derived(getPropTypeDisplayInfo(redPropType));

  // Derived prop for the sheet based on active tab
  const sheetPropType = $derived(activeTab === "blue" ? bluePropType : redPropType);
  const sheetTitle = $derived(
    catDogMode ? (activeTab === "blue" ? "Blue Prop" : "Red Prop") : "Select Prop"
  );

  // Haptic feedback
  const hapticService = container.items.hapticFeedback as IHapticFeedback | undefined;

  function handleOpenPropSelector() {
    hapticService?.trigger("selection");
    propDrawerOpen = true;
  }

  function handlePropSelect(propType: PropType) {
    if (catDogMode) {
      if (activeTab === "blue") {
        updateSetting("bluePropType", propType);
        // Auto-switch to red tab for second hand
        activeTab = "red";
        return;
      } else {
        updateSetting("redPropType", propType);
      }
    } else {
      updateSetting("bluePropType", propType);
      updateSetting("redPropType", propType);
    }
    propDrawerOpen = false;
  }

  function handleClose() {
    open = false;
    onClose();
  }
</script>

<BaseModal
  bind:open
  onclose={handleClose}
  size="xl"
  animation="slide"
  class="viewer-settings-modal"
>
  {#snippet header()}
    <div class="settings-modal-header" data-animate="1">
      <div class="header-title-group">
        <i class="fas fa-cog header-icon" aria-hidden="true"></i>
        <h2 class="header-title">Viewer Settings</h2>
      </div>
      <button
        type="button"
        class="close-btn"
        onclick={handleClose}
        aria-label="Close settings"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="settings-modal-body">
    <!-- Prop selector section -->
    <section class="prop-section" data-animate="2">
      <div class="section-label-row">
        <span class="section-label">Props</span>
      </div>
      <button
        type="button"
        class="prop-indicator-btn"
        onclick={handleOpenPropSelector}
        aria-label="Change prop type"
      >
        <div class="prop-icons">
          <PropCompositionPreview propType={bluePropType} size={36} />
        </div>
        <span class="prop-label">
          {#if catDogMode && redPropType !== bluePropType}
            {blueDisplayInfo.label} / {redDisplayInfo.label}
          {:else}
            {blueDisplayInfo.label}
          {/if}
        </span>
        <i class="fas fa-chevron-right arrow-icon" aria-hidden="true"></i>
      </button>
    </section>

    <!-- Visibility settings (the actual VisibilityTab panels) -->
    <section class="visibility-section" data-animate="3">
      <VisibilityTab />
    </section>
  </div>
</BaseModal>

<!-- Prop selector drawer - rendered OUTSIDE the modal so position:fixed works -->
<PropSelectionSheet
  bind:isOpen={propDrawerOpen}
  selectedPropType={sheetPropType}
  color={activeTab}
  title={sheetTitle}
  onSelect={handlePropSelect}
  showTabs={catDogMode}
  bind:activeTab
  autoClose={!catDogMode}
/>

<style>
  /* Modal sizing - xl is good for desktop, full-screen on mobile via modal-tokens.css */
  :global(dialog.viewer-settings-modal.base-modal) {
    max-height: 92vh;
  }

  /* Fix: xl modals in BaseModal don't get height:100% on wrapper or flex:1 on body.
     This makes the modal body fill available space so descendants can flex-fill too. */
  :global(dialog.viewer-settings-modal .modal-content-wrapper) {
    height: 100%;
  }

  :global(dialog.viewer-settings-modal .modal-body) {
    flex: 1;
    min-height: 0;
  }

  /* Desktop: constrain preview frames to fit without scrolling.
     The three visibility panels sit side-by-side, each with a square preview + controls.
     Without this, preview frames demand 280×280px via aspect-ratio:1, which overflows
     on viewports shorter than ~935px (common on laptops).

     Formula: 92vh (modal) minus ~580px of non-preview content:
       header (~80px) + prop section (~110px) + panel overhead (~140px) + controls (~250px)

     The preview stays square because both max-height and max-width use the same value.
     On mobile (< 768px), panels show one at a time — no constraint needed. */
  @media (min-width: 768px) {
    :global(dialog.viewer-settings-modal .preview-frame) {
      max-height: clamp(100px, calc(92vh - 580px), 280px);
      max-width: clamp(100px, calc(92vh - 580px), 280px);
    }
  }

  /* Ensure prop selection drawer sits above the modal */
  :global(.prop-selection-drawer) {
    z-index: 1100 !important;
  }

  /* Header */
  .settings-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    font-size: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .header-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Body - fills modal body via flex, distributes space to visibility section */
  .settings-modal-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* Prop selector section - fixed height, never shrinks */
  .prop-section {
    flex-shrink: 0;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .section-label-row {
    margin-bottom: 10px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .prop-indicator-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
  }

  .prop-indicator-btn:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .prop-indicator-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .prop-icons {
    display: flex;
    align-items: center;
  }

  .prop-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
    flex: 1;
    text-align: left;
  }

  .arrow-icon {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Visibility section - takes remaining vertical space after prop section */
  .visibility-section {
    flex: 1;
    min-height: 0;
    padding: 4px 0;

    /* Signal to VisibilityTab: fill parent height */
    --vt-height: 100%;
    --vt-container-flex-grow: 1;
    --vt-container-min-h: 0px;
    /* Signal to panels: previews shrink, controls don't */
    --vt-panel-min-h: 0px;
    --vt-preview-min-h: 60px;
    --vt-header-shrink: 0;
    --vt-controls-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn,
    .prop-indicator-btn {
      transition: none;
    }
  }
</style>
