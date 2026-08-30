<script lang="ts">
  let {
    accent,
    icon = null,
    code,
    label,
    active = false,
    disabled = false,
    ariaLabel,
    onpick,
  }: {
    accent: string;
    icon?: string | null;
    code: string;
    label: string;
    active?: boolean;
    disabled?: boolean;
    ariaLabel: string;
    onpick: () => void;
  } = $props();
</script>

<button
  type="button"
  class="relationship-choice"
  class:active
  style="--choice-accent: {accent}"
  aria-pressed={active}
  aria-label={ariaLabel}
  {disabled}
  onclick={onpick}
>
  {#if icon}
    <img class="choice-icon" src={icon} alt="" />
  {:else}
    <span class="choice-dot" aria-hidden="true"></span>
  {/if}
  <span class="choice-copy">
    <strong>{code}</strong>
    <small>{label}</small>
  </span>
</button>

<style>
  .relationship-choice {
    display: flex;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    padding: 0.5rem 0.35rem;
    border: 1px solid color-mix(in srgb, var(--choice-accent) 45%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--choice-accent) 7%, transparent);
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .relationship-choice:hover:not(:disabled) {
    background: color-mix(in srgb, var(--choice-accent) 15%, transparent);
    transform: translateY(-1px);
  }

  .relationship-choice.active {
    border-color: var(--choice-accent);
    background: color-mix(in srgb, var(--choice-accent) 25%, transparent);
    box-shadow: 0 0 14px
      color-mix(in srgb, var(--choice-accent) 32%, transparent);
  }

  .relationship-choice:disabled {
    opacity: 0.38;
    cursor: default;
  }

  .relationship-choice:focus-visible {
    outline: 2px solid var(--choice-accent);
    outline-offset: 2px;
  }

  .choice-icon {
    width: 1.55rem;
    height: 1.55rem;
    flex: 0 0 auto;
    object-fit: contain;
  }

  .choice-dot {
    width: 0.72rem;
    height: 0.72rem;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--choice-accent);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--choice-accent) 42%, transparent);
  }

  .choice-copy {
    display: grid;
    width: 100%;
    min-width: 0;
    text-align: center;
  }

  .choice-copy strong,
  .choice-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .choice-copy strong {
    color: color-mix(in srgb, var(--choice-accent) 80%, white);
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.035em;
  }

  .choice-copy small {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.64));
    font-size: var(--font-size-compact, 0.75rem);
  }

  @container shape-matrix-drill (max-width: 30rem) {
    .relationship-choice {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.4rem;
      justify-content: start;
      padding: 0.3rem 0.45rem;
    }

    .choice-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .choice-copy {
      text-align: left;
    }
  }

  @container shape-matrix-drill (min-width: 42rem) and (max-height: 24rem) {
    .relationship-choice {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.4rem;
      justify-content: start;
      padding: 0.3rem 0.45rem;
    }

    .choice-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .choice-copy {
      text-align: left;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .relationship-choice {
      transition: none;
    }

    .relationship-choice:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
