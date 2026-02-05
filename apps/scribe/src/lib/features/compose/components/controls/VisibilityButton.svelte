<!--
  VisibilityButton.svelte

  Single motion visibility toggle button (eye icon).
  Can be styled for blue or red motion.
-->
<script lang="ts">
  type MotionColor = "blue" | "red";

  let {
    color = "blue",
    isVisible = true,
    onToggle = () => {},
  }: {
    color?: MotionColor;
    isVisible?: boolean;
    onToggle?: () => void;
  } = $props();

  const colorClass = $derived(
    color === "blue" ? "blue-vis-btn" : "red-vis-btn"
  );
  const ariaLabel = $derived(
    isVisible ? `Hide ${color} motion` : `Show ${color} motion`
  );
</script>

<button
  class="vis-btn {colorClass}"
  class:active={isVisible}
  onclick={onToggle}
  type="button"
  aria-label={ariaLabel}
>
  <i class="fas {isVisible ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i>
</button>

<style>
  /* Visibility Buttons */
  .vis-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    width: var(--min-touch-target);
    padding: 0;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 var(--theme-card-bg);
    flex-shrink: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    .vis-btn:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text-dim, var(--theme-text-dim));
      transform: translateY(-1px);
    }
  }

  .vis-btn:active {
    transform: scale(0.97);
  }

  .vis-btn.active.blue-vis-btn {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.25) 0%,
      rgba(37, 99, 235, 0.2) 100%
    );
    border-color: rgba(59, 130, 246, 0.5);
    color: rgba(191, 219, 254, 1);
    box-shadow:
      0 2px 12px rgba(59, 130, 246, 0.2),
      0 0 16px rgba(59, 130, 246, 0.15),
      inset 0 1px 0 var(--theme-stroke);
  }

  .vis-btn.active.red-vis-btn {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.25) 0%,
      rgba(220, 38, 38, 0.2) 100%
    );
    border-color: rgba(239, 68, 68, 0.5);
    color: rgba(254, 202, 202, 1);
    box-shadow:
      0 2px 12px rgba(239, 68, 68, 0.2),
      0 0 16px rgba(239, 68, 68, 0.15),
      inset 0 1px 0 var(--theme-stroke);
  }

  /* Responsive adjustments - maintain 48px touch target for WCAG AAA */
  @media (max-width: 375px) and (max-height: 670px) {
    .vis-btn {
      font-size: var(--font-size-sm);
    }
  }
</style>
