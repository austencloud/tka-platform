<!--
  ViewModeSwitcher.svelte

  Segmented control for switching between view modes in the sync feature.
  Allows users to toggle between animation view, grid view, or split (both) view.

  Design:
  - iOS-style segmented control with joined buttons
  - Theme-based colors with accent highlight for active mode
  - 48px touch targets for WCAG AAA compliance
  - Keyboard accessible with proper ARIA labels
-->
<script lang="ts">
  import { deviceSyncState } from '../state/device-sync-state.svelte';
  import type { ViewMode } from '../domain/sync-types';

  let {
    disabled = false,
    size = 'normal',
  }: {
    disabled?: boolean;
    size?: 'compact' | 'normal';
  } = $props();

  const currentMode = $derived(deviceSyncState.viewMode);

  interface ModeOption {
    id: ViewMode;
    icon: string;
    ariaLabel: string;
  }

  const modes: ModeOption[] = [
    { id: 'animation', icon: 'fa-play-circle', ariaLabel: 'Switch to animation view' },
    { id: 'grid', icon: 'fa-th', ariaLabel: 'Switch to step grid view' },
    { id: 'both', icon: 'fa-columns', ariaLabel: 'Switch to split view' },
  ];

  function handleModeChange(mode: ViewMode): void {
    if (disabled || mode === currentMode) return;
    deviceSyncState.setViewMode(mode);
  }

  function handleKeydown(event: KeyboardEvent, mode: ViewMode): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleModeChange(mode);
    }
  }
</script>

<div
  class="view-mode-switcher"
  class:compact={size === 'compact'}
  class:disabled
  role="tablist"
  aria-label="View mode selection"
>
  {#each modes as mode}
    <button
      type="button"
      class="mode-option"
      class:active={currentMode === mode.id}
      role="tab"
      aria-selected={currentMode === mode.id}
      aria-label={mode.ariaLabel}
      tabindex={currentMode === mode.id ? 0 : -1}
      {disabled}
      onclick={() => handleModeChange(mode.id)}
      onkeydown={(e) => handleKeydown(e, mode.id)}
    >
      <i class="fas {mode.icon}" aria-hidden="true"></i>
    </button>
  {/each}

  <!-- Sliding indicator -->
  <div
    class="indicator"
    style:transform={`translateX(${modes.findIndex((m) => m.id === currentMode) * 100}%)`}
  ></div>
</div>

<style>
  .view-mode-switcher {
    position: relative;
    display: inline-flex;
    gap: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 4px;
    isolation: isolate;
  }

  .view-mode-switcher.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .mode-option {
    position: relative;
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
    transition:
      color var(--duration-normal, 200ms) ease,
      transform var(--duration-fast, 100ms) ease;
    z-index: 1;
    -webkit-tap-highlight-color: transparent;
  }

  .mode-option i {
    font-size: var(--font-size-base, 16px);
  }

  .mode-option:hover:not(:disabled):not(.active) {
    color: var(--theme-text, #ffffff);
  }

  .mode-option:active:not(:disabled) {
    transform: scale(0.95);
  }

  .mode-option:focus-visible {
    outline: 2px solid var(--theme-accent, #fbbf24);
    outline-offset: 2px;
  }

  .mode-option.active {
    color: var(--theme-text, #ffffff);
  }

  /* Sliding indicator background */
  .indicator {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc((100% - 8px) / 3);
    height: calc(100% - 8px);
    background: var(--theme-accent, #fbbf24);
    border-radius: 8px;
    transition: transform var(--duration-emphasis, 300ms) cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
    box-shadow:
      0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.3)),
      0 0 0 1px var(--theme-accent-glow, rgba(251, 191, 36, 0.2));
  }

  /* Compact size variant */
  .view-mode-switcher.compact {
    padding: 3px;
    border-radius: 10px;
  }

  .compact .mode-option {
    width: 40px;
    height: 40px;
  }

  .compact .mode-option i {
    font-size: var(--font-size-sm, 14px);
  }

  .compact .indicator {
    top: 3px;
    left: 3px;
    width: calc((100% - 6px) / 3);
    height: calc(100% - 6px);
    border-radius: 7px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .indicator {
      transition: none;
    }

    .mode-option {
      transition: none;
    }
  }
</style>
