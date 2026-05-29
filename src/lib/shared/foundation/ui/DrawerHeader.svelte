<!--
  DrawerHeader.svelte

  Shared header component for drawers with title and close button.
  Provides consistent styling and accessibility across all drawer types.

  Usage:
    <DrawerHeader title="Filter Options" onClose={() => isOpen = false} />
    <DrawerHeader title="What's New" icon="fa-gift" onClose={handleClose} />
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  interface Props {
    /** The title displayed in the header */
    title: string;
    /** Callback when close button is clicked */
    onClose: () => void;
    /** Optional subtitle or secondary text */
    subtitle?: string;
    /** Optional Font Awesome icon class (e.g., "fa-gift", "fa-tasks") */
    icon?: string;
    /** Optional custom icon color */
    iconColor?: string;
  }

  let { title, onClose, subtitle, icon, iconColor }: Props = $props();

  let hapticService: HapticFeedback | null = null;
  try {
    hapticService = getHapticFeedback();
  } catch {
    // Optional service
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }
</script>

<header class="drawer-header">
  <div class="drawer-header-text">
    <h2>
      {#if icon}
        <i
          class="fas {icon}"
          aria-hidden="true"
          style={iconColor ? `color: ${iconColor}` : undefined}
        ></i>
      {/if}
      {title}
    </h2>
    {#if subtitle}
      <p class="drawer-header-subtitle">{subtitle}</p>
    {/if}
  </div>
  <button
    class="drawer-close-btn"
    onclick={handleClose}
    aria-label="Close"
    type="button"
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
</header>

<style>
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    gap: 16px;
  }

  .drawer-header-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0; /* Allow text truncation */
  }

  .drawer-header h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-xl, 1.25rem);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
    line-height: 1.2;
  }

  .drawer-header h2 i {
    font-size: 0.9em;
    color: var(--theme-accent, #6366f1);
  }

  .drawer-header-subtitle {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    line-height: 1.3;
  }

  .drawer-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) ease;
    flex-shrink: 0;
  }

  .drawer-close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .drawer-close-btn:active {
    transform: scale(0.95);
  }

  .drawer-close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .drawer-header {
      padding: 16px 20px;
    }

    .drawer-header h2 {
      font-size: var(--font-size-lg, 1.125rem);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .drawer-close-btn {
      transition: none;
    }

    .drawer-close-btn:active {
      transform: none;
    }
  }
</style>
