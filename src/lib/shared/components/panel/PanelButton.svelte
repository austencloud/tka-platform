<script lang="ts">
  /**
   * PanelButton - Button component with primary/secondary variants
   */

  import type { Snippet } from "svelte";

  type ButtonVariant = "primary" | "secondary";

  interface Props {
    /** Button variant */
    variant?: ButtonVariant;
    /** Content to render */
    children: Snippet;
    /** Click handler */
    onclick?: (event: MouseEvent) => void;
    /** Disabled state */
    disabled?: boolean;
    /** Button type */
    type?: "button" | "submit" | "reset";
    /** Full width */
    fullWidth?: boolean;
    /** Accessible name when the visible label is shortened responsively. */
    ariaLabel?: string;
    /** Exposes the native button for focus restoration after inline editing. */
    ref?: HTMLButtonElement | null;
    /** Announces that the button's action is in progress. */
    ariaBusy?: boolean;
    /** For a disclosure button: whether the region it controls is open. */
    ariaExpanded?: boolean;
    /** Makes this the active surface's Ctrl/Cmd+S target. */
    saveShortcut?: boolean;
  }

  let {
    variant = "secondary",
    children,
    onclick,
    disabled = false,
    type = "button",
    fullWidth = false,
    ariaLabel,
    ref = $bindable(null),
    ariaBusy = false,
    ariaExpanded,
    saveShortcut = false,
  }: Props = $props();
</script>

<button
  data-save-shortcut={saveShortcut ? "" : undefined}
  bind:this={ref}
  class="panel-btn panel-btn--{variant}"
  class:panel-btn--full-width={fullWidth}
  {onclick}
  {disabled}
  {type}
  aria-label={ariaLabel}
  aria-busy={ariaBusy}
  aria-expanded={ariaExpanded}
>
  {@render children()}
</button>

<style>
  .panel-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: var(--min-touch-target);
  }

  .panel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .panel-btn--full-width {
    width: 100%;
  }

  /* Primary variant - uses theme accent */
  .panel-btn--primary {
    background: var(--theme-accent);
    border: 1px solid var(--theme-accent);
    color: var(--theme-text-on-accent, white);
  }

  .panel-btn--primary:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  /* Secondary variant - ghost style */
  .panel-btn--secondary {
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text, white);
  }

  .panel-btn--secondary:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-btn {
      transition: none;
    }
  }
</style>
