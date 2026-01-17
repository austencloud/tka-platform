<script lang="ts">
  /**
   * IconButton - Touch-friendly icon button (48px minimum)
   * Uses --theme-* CSS variables for consistent theming.
   */

  interface Props {
    /** FontAwesome icon class */
    icon: string;
    /** Button label for accessibility */
    label: string;
    /** Whether button is in active/toggled state */
    active?: boolean;
    /** Whether button appears dimmed */
    dimmed?: boolean;
    /** Click handler */
    onclick: () => void;
  }

  let {
    icon,
    label,
    active = false,
    dimmed = false,
    onclick,
  }: Props = $props();
</script>

<button
  type="button"
  class="icon-btn"
  class:active
  class:dimmed
  {onclick}
  aria-label={label}
>
  <i class={icon} aria-hidden="true"></i>
</button>

<style>
  .icon-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-fast);
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .icon-btn.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  .icon-btn.dimmed {
    opacity: 0.4;
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
