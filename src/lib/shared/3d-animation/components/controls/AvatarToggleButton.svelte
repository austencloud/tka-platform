<script lang="ts">
  /**
   * AvatarToggleButton
   *
   * Button to toggle figure visibility with a popover for customization.
   * Click toggles visibility, gear icon opens customizer popover.
   */

  import type { BodyType } from "../../services/contracts/IAvatarCustomizer";
  import AvatarCustomizer from "../panels/AvatarCustomizer.svelte";

  interface Props {
    showFigure: boolean;
    bodyType: BodyType;
    skinTone: string;
    onToggle: () => void;
    onBodyTypeChange: (type: BodyType) => void;
    onSkinToneChange: (color: string) => void;
  }

  let {
    showFigure,
    bodyType,
    skinTone,
    onToggle,
    onBodyTypeChange,
    onSkinToneChange,
  }: Props = $props();

  let popoverOpen = $state(false);
  let buttonRef: HTMLDivElement | null = $state(null);

  function togglePopover(e: MouseEvent) {
    e.stopPropagation();
    popoverOpen = !popoverOpen;
  }

  function closePopover() {
    popoverOpen = false;
  }

  // Close on outside click
  function handleOutsideClick(e: MouseEvent) {
    if (buttonRef && !buttonRef.contains(e.target as Node)) {
      popoverOpen = false;
    }
  }

  $effect(() => {
    if (popoverOpen) {
      document.addEventListener("click", handleOutsideClick);
      return () => document.removeEventListener("click", handleOutsideClick);
    }
    return undefined;
  });
</script>

<div class="avatar-toggle-container" bind:this={buttonRef}>
  <div class="button-group">
    <!-- Main toggle button -->
    <button
      class="toggle-btn main-btn"
      class:active={showFigure}
      onclick={onToggle}
      aria-label={showFigure ? "Hide figure" : "Show figure"}
      title={showFigure ? "Hide stick figure" : "Show stick figure"}
    >
      <i class="fas fa-person" aria-hidden="true"></i>
    </button>

    <!-- Settings button (only visible when figure is shown) -->
    {#if showFigure}
      <button
        class="toggle-btn settings-btn"
        class:popover-open={popoverOpen}
        onclick={togglePopover}
        aria-label="Customize avatar"
        title="Customize avatar"
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Popover -->
  {#if popoverOpen}
    <div class="popover">
      <AvatarCustomizer
        {bodyType}
        {skinTone}
        {onBodyTypeChange}
        {onSkinToneChange}
      />
    </div>
  {/if}
</div>

<style>
  .avatar-toggle-container {
    position: relative;
  }

  .button-group {
    display: flex;
    gap: 4px;
  }

  .toggle-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: none;
    border-radius: 12px;
    color: var(--theme-text);
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg);
    color: white;
  }

  .main-btn.active {
    background: rgba(100, 180, 255, 0.3);
    color: #64b5f6;
  }

  .settings-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    font-size: 0.85rem;
    border-radius: 8px;
  }

  .settings-btn.popover-open {
    background: rgba(100, 180, 255, 0.2);
    color: #64b5f6;
  }

  .popover {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    min-width: 260px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 100;
    animation: popoverIn var(--duration-fast) ease-out;
  }

  @keyframes popoverIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .popover {
      animation: none;
    }
  }
</style>
