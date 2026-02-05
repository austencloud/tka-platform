<!--
  ViewerSettingsPopover.svelte

  Settings popover for the sequence viewer.
  Provides visibility toggles for animation canvas elements.
-->
<script lang="ts">
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
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
  }

  let { open, darkMode, onDarkModeToggle, onClose }: Props = $props();

  // Animation visibility manager
  const animVisibility = getAnimationVisibilityManager();

  // Local reactive state for animation settings
  let animGridVisible = $state(animVisibility.isGridVisible());
  let animTrailsOn = $state(animVisibility.isTrailsVisible());
  let animTkaGlyph = $state(animVisibility.getVisibility("tkaGlyph"));
  let animWordHeader = $state(animVisibility.getVisibility("wordHeader"));
  let animStepNumbers = $state(animVisibility.getVisibility("stepNumbers"));

  // Haptic feedback
  const hapticService = container.items.hapticFeedback as IHapticFeedback | undefined;
  function haptic() {
    hapticService?.trigger("selection");
  }

  // Toggle handlers
  function toggleAnimGrid() {
    haptic();
    const newMode = animGridVisible ? "none" : "diamond";
    animVisibility.setGridMode(newMode);
    animGridVisible = newMode !== "none";
  }

  function toggleAnimTrails() {
    haptic();
    const newStyle = animTrailsOn ? "off" : "on";
    animVisibility.setTrailStyle(newStyle);
    animTrailsOn = newStyle === "on";
  }

  function toggleAnimTkaGlyph() {
    haptic();
    animTkaGlyph = !animTkaGlyph;
    animVisibility.setVisibility("tkaGlyph", animTkaGlyph);
  }

  function toggleAnimWordHeader() {
    haptic();
    animWordHeader = !animWordHeader;
    animVisibility.setVisibility("wordHeader", animWordHeader);
  }

  function toggleAnimStepNumbers() {
    haptic();
    animStepNumbers = !animStepNumbers;
    animVisibility.setVisibility("stepNumbers", animStepNumbers);
  }

  function handleDarkModeToggle() {
    haptic();
    onDarkModeToggle();
  }

  // Close on Escape
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={onClose}></div>

  <!-- Popover -->
  <div class="settings-popover" role="dialog" aria-label="Viewer settings">
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close settings">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <div class="chip-grid">
      <ChipToggle
        label={darkMode ? "Dark" : "Light"}
        icon={darkMode ? "fa-moon" : "fa-sun"}
        active={darkMode}
        color="amber"
        onclick={handleDarkModeToggle}
      />
      <ChipToggle
        label="Grid"
        icon="fa-th"
        active={animGridVisible}
        onclick={toggleAnimGrid}
      />
      <ChipToggle
        label="Trails"
        icon="fa-wind"
        active={animTrailsOn}
        onclick={toggleAnimTrails}
      />
      <ChipToggle
        label="TKA"
        icon="fa-font"
        active={animTkaGlyph}
        onclick={toggleAnimTkaGlyph}
      />
      <ChipToggle
        label="Word"
        icon="fa-heading"
        active={animWordHeader}
        onclick={toggleAnimWordHeader}
      />
      <ChipToggle
        label="Beats"
        icon="fa-hashtag"
        active={animStepNumbers}
        onclick={toggleAnimStepNumbers}
      />
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
    width: 280px;
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

  .chip-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-popover {
      transition: none;
    }
  }
</style>
