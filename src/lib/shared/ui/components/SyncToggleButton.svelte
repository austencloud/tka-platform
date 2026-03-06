<!--
  SyncToggleButton.svelte

  Toggle button for LAN sync functionality.
  Shows distinct visual states for inactive, searching, and connected.

  States:
  - Inactive (default): Subtle, ready to activate
  - Searching: Pulsing animation, looking for devices
  - Connected: Solid green glow, link icon
-->
<script lang="ts">
  interface Props {
    /** Whether sync is actively searching for devices */
    isSearching?: boolean;
    /** Whether currently connected to another device */
    isConnected?: boolean;
    /** Whether the button is in a toggling transition */
    isToggling?: boolean;
    /** Callback when toggled */
    onToggle: () => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Size variant */
    size?: "small" | "medium" | "large";
  }

  let {
    isSearching = false,
    isConnected = false,
    isToggling = false,
    onToggle,
    disabled = false,
    size = "medium",
  }: Props = $props();

  const sizeClasses = {
    small: "size-small",
    medium: "size-medium",
    large: "size-large",
  };

  // Determine the visual state
  const state = $derived(
    isToggling ? "toggling" :
    isConnected ? "connected" :
    isSearching ? "searching" :
    "inactive"
  );

  // Determine icon
  const icon = $derived(
    isToggling ? "fa-spinner fa-spin" :
    isConnected ? "fa-link" :
    "fa-broadcast-tower"
  );

  // Determine aria-label
  const ariaLabel = $derived(
    isConnected ? "Synced - tap to disconnect" :
    isSearching ? "Looking for devices..." :
    "Tap to sync with nearby device"
  );

  // Determine title
  const title = $derived(
    isConnected ? "Connected - tap to disconnect" :
    isSearching ? "Searching for devices..." :
    "Sync with nearby device"
  );
</script>

<button
  class="sync-toggle {sizeClasses[size]}"
  class:searching={state === "searching"}
  class:connected={state === "connected"}
  class:toggling={state === "toggling"}
  onclick={onToggle}
  disabled={disabled || isToggling}
  aria-label={ariaLabel}
  {title}
>
  <i class="fas {icon}" aria-hidden="true"></i>
</button>

<style>
  .sync-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
  }

  /* Sizes */
  .size-small {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .size-medium {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    font-size: 18px;
  }

  .size-large {
    width: 56px;
    height: 56px;
    font-size: 22px;
  }

  /* Hover state - inactive */
  .sync-toggle:hover:not(:disabled):not(.searching):not(.connected) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #ffffff);
    transform: scale(1.05);
  }

  .sync-toggle:active:not(:disabled) {
    transform: scale(0.95);
  }

  /* Searching state - pulsing blue */
  .sync-toggle.searching {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
    color: var(--theme-accent, #6366f1);
    box-shadow:
      0 0 16px rgba(99, 102, 241, 0.2),
      inset 0 0 12px rgba(99, 102, 241, 0.1);
    animation: sync-pulse 2s ease-in-out infinite;
  }

  .sync-toggle.searching:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow:
      0 0 24px rgba(99, 102, 241, 0.3),
      inset 0 0 16px rgba(99, 102, 241, 0.15);
  }

  @keyframes sync-pulse {
    0%, 100% {
      opacity: 1;
      box-shadow:
        0 0 16px rgba(99, 102, 241, 0.2),
        inset 0 0 12px rgba(99, 102, 241, 0.1);
    }
    50% {
      opacity: 0.7;
      box-shadow:
        0 0 24px rgba(99, 102, 241, 0.4),
        inset 0 0 16px rgba(99, 102, 241, 0.2);
    }
  }

  /* Connected state - solid green */
  .sync-toggle.connected {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.5);
    color: #22c55e;
    box-shadow:
      0 0 16px rgba(34, 197, 94, 0.25),
      inset 0 0 12px rgba(34, 197, 94, 0.1);
    animation: none;
  }

  .sync-toggle.connected:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.7);
    box-shadow:
      0 0 24px rgba(34, 197, 94, 0.35),
      inset 0 0 16px rgba(34, 197, 94, 0.15);
    transform: scale(1.05);
  }

  /* Toggling state */
  .sync-toggle.toggling {
    opacity: 0.6;
    cursor: wait;
  }

  /* Disabled state */
  .sync-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sync-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .sync-toggle {
      transition: none;
      animation: none !important;
    }

    .sync-toggle:hover:not(:disabled),
    .sync-toggle:active:not(:disabled) {
      transform: none;
    }
  }
</style>
