<script lang="ts">
  /**
   * ChipToggle - Unified toggle chip component
   *
   * A single source of truth for all toggle chip styling across the app.
   * Fixes mobile touch issues with proper @media (hover: hover) handling.
   *
   * @example
   * // Horizontal layout (default)
   * <ChipToggle
   *   label="Stars"
   *   icon="fa-star"
   *   active={showStars}
   *   color="lime"
   *   onclick={() => showStars = !showStars}
   * />
   *
   * // Vertical layout (for quick commands)
   * <ChipToggle
   *   icon="fa-sync"
   *   label="Regen"
   *   layout="vertical"
   *   onclick={regenerate}
   * />
   *
   * // Icon-only
   * <ChipToggle
   *   icon="fa-bolt"
   *   active={isActive}
   *   color="amber"
   *   onclick={handleClick}
   * />
   */

  type ColorPreset =
    | "default" // Purple #6366f1 (app accent)
    | "cyan" // #06b6d4 (ocean theme)
    | "blue" // #3b82f6 (curious)
    | "lime" // #84cc16 (forest theme)
    | "amber" // #f59e0b (warning/excited)
    | "rose" // #f43f5e (favorites/social)
    | "emerald" // #10b981 (success/playful)
    | "red" // #ef4444 (error/alert)
    | "gray"; // #6b7280 (neutral/tired)

  interface Props {
    label?: string;
    icon?: string;
    active?: boolean;
    color?: ColorPreset;
    size?: "sm" | "md";
    layout?: "horizontal" | "vertical";
    disabled?: boolean;
    onclick?: () => void;
  }

  let {
    label,
    icon,
    active = false,
    color = "default",
    size = "md",
    layout = "horizontal",
    disabled = false,
    onclick,
  }: Props = $props();

  const iconOnly = !label && icon;
</script>

<button
  class="chip-toggle {size}"
  class:icon-only={iconOnly}
  class:vertical={layout === "vertical"}
  data-color={color}
  data-active={active}
  aria-pressed={active}
  aria-label={iconOnly ? icon?.replace("fa-", "") : undefined}
  title={iconOnly ? label : undefined}
  {disabled}
  {onclick}
>
  {#if icon}
    <i class="fas {icon}" aria-hidden="true"></i>
  {/if}
  {#if label}
    <span>{label}</span>
  {/if}
</button>

<style>
  .chip-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 48px;
    background: var(--chip-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--chip-border, rgba(255, 255, 255, 0.08));
    border-radius: 20px;
    color: var(--chip-text, #9ca3af);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: var(--chip-glow, none);
    -webkit-tap-highlight-color: transparent;
  }

  .chip-toggle i {
    font-size: 0.75rem;
  }

  .chip-toggle span {
    white-space: nowrap;
  }

  /* Icon-only variant */
  .chip-toggle.icon-only {
    padding: 8px;
    min-width: 48px;
  }

  .chip-toggle.icon-only i {
    font-size: 0.9rem;
  }

  /* Size variants */
  .chip-toggle.sm {
    padding: 6px 10px;
    min-height: 36px;
    font-size: 0.75rem;
  }

  .chip-toggle.sm i {
    font-size: 0.65rem;
  }

  .chip-toggle.sm.icon-only {
    padding: 6px;
    min-width: 36px;
  }

  /* Vertical layout (icon on top, label below) */
  .chip-toggle.vertical {
    flex-direction: column;
    gap: 4px;
    padding: 10px 8px;
    border-radius: 16px;
    font-size: 0.7rem;
  }

  .chip-toggle.vertical i {
    font-size: 0.85rem;
  }

  /* Disabled state */
  .chip-toggle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Hover - ONLY on devices that support hover (not touch) */
  @media (hover: hover) {
    .chip-toggle:hover:not(:disabled):not([data-active="true"]) {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      color: #e5e7eb;
    }
  }

  /* Focus visible for keyboard navigation */
  .chip-toggle:focus-visible {
    outline: 2px solid var(--chip-focus, #6366f1);
    outline-offset: 2px;
  }

  /* ========================================
     ACTIVE STATES BY COLOR
     Using data attributes avoids CSS specificity wars
     ======================================== */

  /* Default (Purple) */
  .chip-toggle[data-color="default"][data-active="true"] {
    --chip-bg: rgba(99, 102, 241, 0.2);
    --chip-border: rgba(99, 102, 241, 0.5);
    --chip-text: #a5b4fc;
    --chip-glow: 0 0 12px rgba(99, 102, 241, 0.2);
    --chip-focus: #6366f1;
  }

  /* Cyan (Ocean theme) */
  .chip-toggle[data-color="cyan"][data-active="true"] {
    --chip-bg: rgba(6, 182, 212, 0.2);
    --chip-border: rgba(6, 182, 212, 0.5);
    --chip-text: #67e8f9;
    --chip-glow: 0 0 12px rgba(6, 182, 212, 0.2);
    --chip-focus: #06b6d4;
  }

  /* Blue (Curious) */
  .chip-toggle[data-color="blue"][data-active="true"] {
    --chip-bg: rgba(59, 130, 246, 0.2);
    --chip-border: rgba(59, 130, 246, 0.5);
    --chip-text: #93c5fd;
    --chip-glow: 0 0 12px rgba(59, 130, 246, 0.2);
    --chip-focus: #3b82f6;
  }

  /* Lime (Forest theme) */
  .chip-toggle[data-color="lime"][data-active="true"] {
    --chip-bg: rgba(132, 204, 22, 0.2);
    --chip-border: rgba(132, 204, 22, 0.5);
    --chip-text: #bef264;
    --chip-glow: 0 0 12px rgba(132, 204, 22, 0.2);
    --chip-focus: #84cc16;
  }

  /* Amber (Warning) */
  .chip-toggle[data-color="amber"][data-active="true"] {
    --chip-bg: rgba(245, 158, 11, 0.2);
    --chip-border: rgba(245, 158, 11, 0.5);
    --chip-text: #fcd34d;
    --chip-glow: 0 0 12px rgba(245, 158, 11, 0.2);
    --chip-focus: #f59e0b;
  }

  /* Rose (Favorites) */
  .chip-toggle[data-color="rose"][data-active="true"] {
    --chip-bg: rgba(244, 63, 94, 0.2);
    --chip-border: rgba(244, 63, 94, 0.5);
    --chip-text: #fda4af;
    --chip-glow: 0 0 12px rgba(244, 63, 94, 0.2);
    --chip-focus: #f43f5e;
  }

  /* Emerald (Success/Include) */
  .chip-toggle[data-color="emerald"][data-active="true"] {
    --chip-bg: rgba(16, 185, 129, 0.2);
    --chip-border: rgba(16, 185, 129, 0.5);
    --chip-text: #6ee7b7;
    --chip-glow: 0 0 12px rgba(16, 185, 129, 0.2);
    --chip-focus: #10b981;
  }

  /* Red (Error/Exclude) */
  .chip-toggle[data-color="red"][data-active="true"] {
    --chip-bg: rgba(239, 68, 68, 0.2);
    --chip-border: rgba(239, 68, 68, 0.5);
    --chip-text: #fca5a5;
    --chip-glow: 0 0 12px rgba(239, 68, 68, 0.2);
    --chip-focus: #ef4444;
  }

  /* Gray (Neutral/Tired) */
  .chip-toggle[data-color="gray"][data-active="true"] {
    --chip-bg: rgba(107, 114, 128, 0.2);
    --chip-border: rgba(107, 114, 128, 0.5);
    --chip-text: #d1d5db;
    --chip-glow: 0 0 12px rgba(107, 114, 128, 0.15);
    --chip-focus: #6b7280;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chip-toggle {
      transition: none;
    }
  }
</style>
