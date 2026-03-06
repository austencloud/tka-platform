<!--
  MultiPerformerButton.svelte

  Button to open multi-performer/stagger mode preview.
  Shows multiple users icon with a subtle group-themed visual style.

  Used in: Sequence viewer, Animation preview
-->
<script lang="ts">
  interface Props {
    /** Callback when clicked */
    onclick: () => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Size variant */
    size?: "small" | "medium" | "large";
    /** Whether multi-performer mode is currently active */
    active?: boolean;
  }

  let {
    onclick,
    disabled = false,
    size = "medium",
    active = false,
  }: Props = $props();

  const sizeClasses = {
    small: "size-small",
    medium: "size-medium",
    large: "size-large",
  };
</script>

<button
  type="button"
  class="multi-performer-btn {sizeClasses[size]}"
  class:active
  {onclick}
  {disabled}
  aria-label={active ? "Close multi-performer preview" : "Preview with multiple performers"}
  title={active ? "Close multi-performer preview" : "Multiple performers"}
>
  <i class="fas fa-users" aria-hidden="true"></i>
</button>

<style>
  .multi-performer-btn {
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

  /* Inactive state - subtle cyan/teal tint (community/group feel) */
  .multi-performer-btn:not(.active) {
    background: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.2);
    color: rgba(6, 182, 212, 0.7);
  }

  .multi-performer-btn:hover:not(:disabled):not(.active) {
    background: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.4);
    color: #06b6d4;
    box-shadow:
      0 0 16px rgba(6, 182, 212, 0.2),
      inset 0 0 12px rgba(6, 182, 212, 0.05);
    transform: scale(1.05);
  }

  /* Active state - solid cyan glow */
  .multi-performer-btn.active {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.5);
    color: #06b6d4;
    box-shadow:
      0 0 20px rgba(6, 182, 212, 0.3),
      inset 0 0 12px rgba(6, 182, 212, 0.1);
  }

  .multi-performer-btn.active:hover:not(:disabled) {
    background: rgba(6, 182, 212, 0.3);
    border-color: rgba(6, 182, 212, 0.7);
    box-shadow:
      0 0 28px rgba(6, 182, 212, 0.4),
      inset 0 0 16px rgba(6, 182, 212, 0.15);
    transform: scale(1.05);
  }

  .multi-performer-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  /* Disabled state */
  .multi-performer-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .multi-performer-btn:focus-visible {
    outline: 2px solid #06b6d4;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .multi-performer-btn {
      transition: none;
    }

    .multi-performer-btn:hover:not(:disabled),
    .multi-performer-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
