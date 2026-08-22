<script lang="ts">
  interface Props {
    label: string;
    description: string;
    enabled?: boolean;
    isBusy?: boolean;
    disabled?: boolean;
    onToggle: () => void;
  }

  let {
    label,
    description,
    enabled = false,
    isBusy = false,
    disabled = false,
    onToggle,
  }: Props = $props();
</script>

<button
  type="button"
  class="preference-item"
  class:enabled
  onclick={onToggle}
  {disabled}
  aria-label={`${label}: ${enabled ? "on" : "off"}`}
  aria-pressed={enabled}
  aria-busy={isBusy}
>
  <span class="item-copy">
    <span class="item-label">{label}</span>
    <span class="item-description">{description}</span>
  </span>

  <span class="toggle-switch" aria-hidden="true">
    <span class="toggle-knob"></span>
  </span>
</button>

<style>
  .preference-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1em;
    width: 100%;
    min-height: 4.5em;
    padding: 0.8em 1em;
    border: 0;
    color: var(--theme-text);
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .preference-item:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
  }

  .preference-item:active:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-card-hover-bg) 82%,
      var(--theme-accent) 8%
    );
  }

  .preference-item:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  .preference-item:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .preference-item[aria-busy="true"] {
    cursor: wait;
    opacity: 0.68;
  }

  .item-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2em;
  }

  .item-label {
    color: var(--theme-text);
    font-size: max(0.875rem, var(--font-size-sm));
    font-weight: 650;
    line-height: 1.25;
  }

  .item-description {
    color: var(--theme-text-dim);
    font-size: max(0.75rem, var(--font-size-compact));
    line-height: 1.4;
  }

  .toggle-switch {
    box-sizing: border-box;
    display: flex;
    width: 2.8em;
    height: 1.65em;
    flex: 0 0 auto;
    align-items: center;
    padding: 0.2em;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-text) 10%, transparent);
    transition:
      background var(--duration-normal) ease,
      border-color var(--duration-normal) ease;
  }

  .toggle-knob {
    width: 1.15em;
    height: 1.15em;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-text) 72%, transparent);
    box-shadow: 0 0.12em 0.3em rgba(0, 0, 0, 0.28);
    transition:
      transform var(--duration-normal) ease,
      background var(--duration-normal) ease;
  }

  .preference-item.enabled .toggle-switch {
    border-color: var(--theme-accent);
    background: var(--theme-accent);
  }

  .preference-item.enabled .toggle-knob {
    transform: translateX(1.15em);
    background: var(--theme-text-on-accent, #fff);
  }

  @container notification-preferences (max-width: 32rem) {
    .preference-item {
      min-height: 4.25rem;
      padding: 0.75rem 0.85rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preference-item,
    .toggle-switch,
    .toggle-knob {
      transition: none;
    }
  }
</style>
