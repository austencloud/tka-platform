<!--
  ExpandButton.svelte

  Button to toggle expanded/fullscreen state of a container or modal.
  Shows expand/compress icons with a subtle visual style.

  Note: This is for UI-level expand (like modal fullscreen), not browser fullscreen.
  For browser fullscreen, use FullscreenButton.svelte instead.

  Used in: Sequence viewer modal, panel expansion
-->
<script lang="ts">
  interface Props {
    /** Whether currently in expanded state */
    isExpanded?: boolean;
    /** Callback when clicked */
    onclick: () => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Size variant */
    size?: "small" | "medium" | "large";
  }

  let {
    isExpanded = false,
    onclick,
    disabled = false,
    size = "medium",
  }: Props = $props();

  const sizeClasses = {
    small: "size-small",
    medium: "size-medium",
    large: "size-large",
  };

  const icon = $derived(isExpanded ? "fa-compress" : "fa-expand");
  const ariaLabel = $derived(isExpanded ? "Exit fullscreen" : "Enter fullscreen");
  const title = $derived(isExpanded ? "Exit fullscreen" : "Fullscreen");
</script>

<button
  type="button"
  class="expand-btn {sizeClasses[size]}"
  class:expanded={isExpanded}
  {onclick}
  {disabled}
  aria-label={ariaLabel}
  {title}
>
  <i class="fas {icon}" aria-hidden="true"></i>
</button>

<style>
  .expand-btn {
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
    font-size: 14px;
  }

  .size-medium {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    font-size: 16px;
  }

  .size-large {
    width: 56px;
    height: 56px;
    font-size: 20px;
  }

  /* Inactive state - subtle purple tint */
  .expand-btn:not(.expanded) {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.2);
    color: rgba(139, 92, 246, 0.7);
  }

  .expand-btn:hover:not(:disabled):not(.expanded) {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: #8b5cf6;
    box-shadow:
      0 0 16px rgba(139, 92, 246, 0.2),
      inset 0 0 12px rgba(139, 92, 246, 0.05);
    transform: scale(1.05);
  }

  /* Expanded state - solid purple glow */
  .expand-btn.expanded {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #8b5cf6;
    box-shadow:
      0 0 20px rgba(139, 92, 246, 0.3),
      inset 0 0 12px rgba(139, 92, 246, 0.1);
  }

  .expand-btn.expanded:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.3);
    border-color: rgba(139, 92, 246, 0.7);
    box-shadow:
      0 0 28px rgba(139, 92, 246, 0.4),
      inset 0 0 16px rgba(139, 92, 246, 0.15);
    transform: scale(1.05);
  }

  .expand-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  /* Disabled state */
  .expand-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .expand-btn:focus-visible {
    outline: 2px solid #8b5cf6;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .expand-btn {
      transition: none;
    }

    .expand-btn:hover:not(:disabled),
    .expand-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
