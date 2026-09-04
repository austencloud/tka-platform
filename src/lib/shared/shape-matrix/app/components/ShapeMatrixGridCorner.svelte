<script lang="ts">
  interface Props {
    onrandom: () => void;
  }

  const { onrandom }: Props = $props();
</script>

<div class="corner-frame">
  <div class="corner-guide">
    <strong>Pick a crossing</strong>
    <div class="axis-guide" aria-hidden="true">
      <span><i class="row-dot"></i>Rows ↓</span>
      <span><i class="column-dot"></i>Columns →</span>
    </div>
    <button
      type="button"
      aria-label="Pick a random crossing"
      onclick={() => onrandom()}
    >
      <i class="fas fa-dice" aria-hidden="true"></i>
      <span>Surprise me</span>
    </button>
  </div>
</div>

<style>
  .corner-frame {
    position: absolute;
    inset: 0;
    container-type: size;
  }

  .corner-guide {
    display: grid;
    width: 100%;
    height: 100%;
    place-content: center;
    gap: clamp(0.35rem, 5cqi, 0.8rem);
    padding: clamp(0.35rem, 7cqi, 1rem);
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .corner-guide > strong {
    font-size: clamp(0.875rem, 10cqi, 1.15rem);
    font-weight: 750;
    line-height: 1.1;
  }

  .axis-guide {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem 0.65rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.65));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    white-space: nowrap;
  }

  .axis-guide span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .axis-guide i {
    display: block;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
  }

  .row-dot {
    background: var(--prop-blue-text, #818cf8);
  }

  .column-dot {
    background: var(--prop-red-text, #f87171);
  }

  button {
    display: inline-flex;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, #f59e0b) 55%,
        var(--theme-stroke, transparent)
      );
    border-radius: 9px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 12%,
      var(--theme-card-bg, transparent)
    );
    color: var(--theme-text, #fff);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    white-space: nowrap;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  button:hover {
    border-color: var(--theme-accent, #f59e0b);
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 20%,
      var(--theme-card-hover-bg, transparent)
    );
    transform: translateY(-1px);
  }

  button:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: -3px;
  }

  @container (max-width: 7.5rem) {
    .axis-guide {
      display: none;
    }
  }

  @container (max-height: 7.5rem) {
    .axis-guide {
      display: none;
    }
  }

  @container (max-width: 5rem) {
    .corner-guide {
      padding: 0;
    }

    .corner-guide > strong,
    button span {
      display: none;
    }

    button {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: 0;
      font-size: 1rem;
    }
  }

  @container (max-height: 5rem) {
    .corner-guide {
      padding: 0;
    }

    .corner-guide > strong,
    button span {
      display: none;
    }

    button {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: 0;
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }

    button:hover {
      transform: none;
    }
  }
</style>
