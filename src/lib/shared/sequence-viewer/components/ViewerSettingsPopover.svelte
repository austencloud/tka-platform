<!--
  ViewerSettingsPopover.svelte

  Settings popover for the sequence viewer.
  Dark mode toggle and prop type selection as consistent action rows.
-->
<script lang="ts">
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    /** Whether the popover is open */
    open: boolean;
    /** Current dark mode state */
    darkMode: boolean;
    /** Callback when dark mode is toggled */
    onDarkModeToggle: () => void;
    /** Callback to close the popover */
    onClose: () => void;
    /** Callback to open prop selector drawer */
    onOpenPropSelector?: () => void;
  }

  let { open, darkMode, onDarkModeToggle, onClose, onOpenPropSelector }: Props = $props();

  // Get current prop types from settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const redPropType = $derived(settings.redPropType ?? PropType.STAFF);
  const catDogMode = $derived(settings.catDogMode ?? false);

  // Display info for current props
  const blueDisplayInfo = $derived(getPropTypeDisplayInfo(bluePropType));
  const redDisplayInfo = $derived(getPropTypeDisplayInfo(redPropType));

  const propLabel = $derived(
    catDogMode && redPropType !== bluePropType
      ? `${blueDisplayInfo.label} / ${redDisplayInfo.label}`
      : blueDisplayInfo.label
  );

  // Haptic feedback
  const hapticService = container.items.hapticFeedback as IHapticFeedback | undefined;
  function haptic() {
    hapticService?.trigger("selection");
  }

  function handleDarkModeToggle() {
    haptic();
    onDarkModeToggle();
  }

  function handlePropSelectorOpen() {
    haptic();
    onClose();
    onOpenPropSelector?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={onClose}></div>

  <div class="settings-popover" role="dialog" aria-label="Viewer settings">
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close settings">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <div class="settings-rows">
      <!-- Dark mode row -->
      <button
        type="button"
        class="settings-row"
        onclick={handleDarkModeToggle}
        aria-label="Toggle {darkMode ? 'light' : 'dark'} mode"
      >
        <div class="row-icon">
          <i class="fas {darkMode ? 'fa-moon' : 'fa-sun'}" aria-hidden="true"></i>
        </div>
        <span class="row-label">{darkMode ? "Dark mode" : "Light mode"}</span>
        <div class="row-toggle" class:active={darkMode}>
          <div class="toggle-thumb"></div>
        </div>
      </button>

      <!-- Prop selector row -->
      {#if onOpenPropSelector}
        <button
          type="button"
          class="settings-row"
          onclick={handlePropSelectorOpen}
          aria-label="Change prop type, currently {propLabel}"
        >
          <div class="row-icon prop-icons">
            <img
              src={blueDisplayInfo.image}
              alt={blueDisplayInfo.label}
              class="prop-icon blue"
            />
            {#if catDogMode && redPropType !== bluePropType}
              <img
                src={redDisplayInfo.image}
                alt={redDisplayInfo.label}
                class="prop-icon red"
              />
            {/if}
          </div>
          <span class="row-label">{propLabel}</span>
          <i class="fas fa-chevron-right row-chevron" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .settings-popover {
    position: absolute;
    top: 56px;
    right: 8px;
    width: 260px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 101;
    overflow: hidden;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .settings-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 150ms ease;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Unified row list */
  .settings-rows {
    padding: 4px 0;
  }

  .settings-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    min-height: 48px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 150ms ease;
    text-align: left;
  }

  .settings-row:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .settings-row:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .row-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    flex-shrink: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-base, 16px);
  }

  .row-label {
    flex: 1;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, white);
  }

  /* Toggle switch for dark mode */
  .row-toggle {
    position: relative;
    width: 40px;
    height: 22px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 11px;
    flex-shrink: 0;
    transition: background 200ms ease, border-color 200ms ease;
  }

  .row-toggle.active {
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform 200ms ease;
  }

  .row-toggle.active .toggle-thumb {
    transform: translateX(18px);
  }

  /* Chevron for prop row */
  .row-chevron {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    flex-shrink: 0;
  }

  /* Prop icons in row */
  .prop-icons {
    gap: 2px;
  }

  .prop-icon {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  .prop-icon.blue {
    filter: drop-shadow(0 1px 2px rgba(59, 130, 246, 0.4));
  }

  .prop-icon.red {
    filter: drop-shadow(0 1px 2px rgba(239, 68, 68, 0.4));
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-row,
    .close-btn,
    .row-toggle,
    .toggle-thumb {
      transition: none;
    }
  }
</style>
