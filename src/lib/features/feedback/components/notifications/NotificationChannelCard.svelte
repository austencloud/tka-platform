<script lang="ts">
  interface Props {
    label: string;
    description: string;
    status: string;
    icon: string;
    enabled?: boolean;
    busy?: boolean;
    disabled?: boolean;
    ariaLabel: string;
    onToggle: () => void;
  }

  let {
    label,
    description,
    status,
    icon,
    enabled = false,
    busy = false,
    disabled = false,
    ariaLabel,
    onToggle,
  }: Props = $props();
</script>

<button
  type="button"
  class="channel-card"
  class:enabled
  onclick={onToggle}
  {disabled}
  aria-label={ariaLabel}
  aria-pressed={enabled}
  aria-busy={busy}
>
  <span class="channel-icon" aria-hidden="true">
    <i class={`fas ${icon}`}></i>
  </span>

  <span class="channel-copy">
    <span class="channel-title-row">
      <span class="channel-label">{label}</span>
      <span class="channel-status">
        <span class="status-dot" aria-hidden="true"></span>
        {status}
      </span>
    </span>
    <span class="channel-description">{description}</span>
  </span>

  <span class="toggle-switch" aria-hidden="true">
    <span class="toggle-knob"></span>
  </span>
</button>

<style>
  .channel-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.85em;
    width: 100%;
    min-height: 5.25em;
    padding: 0.85em;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.85em;
    color: var(--theme-text);
    background: var(--theme-card-bg);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background var(--duration-fast) ease,
      border-color var(--duration-fast) ease,
      transform var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .channel-card:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
    transform: translateY(-1px);
  }

  .channel-card:active:not(:disabled) {
    transform: translateY(0);
  }

  .channel-card:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .channel-card:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .channel-card[aria-busy="true"] {
    cursor: wait;
    opacity: 0.68;
  }

  .channel-card.enabled {
    border-color: color-mix(
      in srgb,
      var(--theme-accent) 58%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--theme-accent) 8%,
      var(--theme-card-bg)
    );
  }

  .channel-icon {
    display: grid;
    width: 2.8em;
    height: 2.8em;
    place-items: center;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.75em;
    color: var(--theme-text-dim);
    background: color-mix(in srgb, var(--theme-text) 5%, transparent);
  }

  .channel-card.enabled .channel-icon {
    border-color: color-mix(in srgb, var(--theme-accent) 24%, transparent);
    color: var(--theme-accent-text, var(--theme-accent));
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .channel-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.25em;
  }

  .channel-title-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.65em;
  }

  .channel-label {
    overflow: hidden;
    color: var(--theme-text);
    font-size: max(0.9375rem, var(--font-size-base));
    font-weight: 725;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel-status {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.35em;
    color: var(--theme-text-dim);
    font-size: max(0.75rem, var(--font-size-compact));
    font-weight: 650;
    line-height: 1;
  }

  .status-dot {
    width: 0.45em;
    height: 0.45em;
    border-radius: 50%;
    background: var(--theme-text-dim);
  }

  .channel-card.enabled .channel-status {
    color: var(--theme-accent-text, var(--theme-accent));
  }

  .channel-card.enabled .status-dot {
    background: var(--theme-accent);
    box-shadow: 0 0 0 0.2em
      color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .channel-description {
    color: var(--theme-text-dim);
    font-size: max(0.75rem, var(--font-size-compact));
    line-height: 1.35;
  }

  .toggle-switch {
    box-sizing: border-box;
    display: flex;
    width: 3em;
    height: 1.8em;
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
    width: 1.3em;
    height: 1.3em;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-text) 72%, transparent);
    box-shadow: 0 0.12em 0.3em rgba(0, 0, 0, 0.28);
    transition:
      transform var(--duration-normal) ease,
      background var(--duration-normal) ease;
  }

  .channel-card.enabled .toggle-switch {
    border-color: var(--theme-accent);
    background: var(--theme-accent);
  }

  .channel-card.enabled .toggle-knob {
    transform: translateX(1.2em);
    background: var(--theme-text-on-accent, #fff);
  }

  @container notification-preferences (max-width: 32rem) {
    .channel-card {
      grid-template-columns: auto minmax(0, 1fr);
      min-height: 9rem;
    }

    .channel-title-row {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.2rem;
      min-height: 3.4em;
    }

    .channel-label {
      white-space: normal;
    }

    .toggle-switch {
      grid-column: 1 / -1;
      justify-self: end;
      margin-top: -2.25rem;
    }

    .channel-copy {
      padding-right: 3.4rem;
    }

    .channel-description {
      display: -webkit-box;
      min-height: 2.7em;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .channel-card,
    .toggle-switch,
    .toggle-knob {
      transition: none;
    }
  }
</style>
