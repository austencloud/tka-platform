<script lang="ts">
  let {
    progress,
    playing,
    reducedMotion,
    ontoggle,
    onscrub,
  }: {
    progress: number;
    playing: boolean;
    reducedMotion: boolean;
    ontoggle: () => void;
    onscrub: (value: number) => void;
  } = $props();

  function readRange(event: Event): void {
    onscrub(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<div class="transport" aria-label="Construction playback">
  <button
    type="button"
    class="play-button"
    onclick={ontoggle}
    disabled={reducedMotion}
    aria-label={reducedMotion
      ? "Animation disabled by reduced motion preference"
      : playing
        ? "Pause construction"
        : "Play construction"}
  >
    <i class="fas {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    {reducedMotion ? "Motion off" : playing ? "Pause" : "Play"}
  </button>

  <label class="cycle-scrubber">
    <span>Cycle position</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={progress}
      oninput={readRange}
    />
  </label>
  <output class="progress-value">{Math.round(progress * 100)}%</output>
</div>

<style>
  .transport {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 3.4rem;
    align-items: end;
    gap: 0.75rem;
    width: min(100%, 1040px);
    margin-inline: auto;
    padding: 0.85rem clamp(0.65rem, 1.6cqi, 1.25rem) 1rem;
    border-top: 1px solid var(--construction-border);
  }

  .play-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.48rem;
    min-width: 6.4rem;
    min-height: 44px;
    padding: 0 1rem;
    border: 1px solid
      color-mix(in srgb, var(--construction-trace-b) 46%, transparent);
    border-radius: 0.7rem;
    background: color-mix(
      in srgb,
      var(--construction-trace-b) 17%,
      transparent
    );
    color: color-mix(in srgb, var(--construction-trace-b) 74%, white);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }

  .play-button:hover:not(:disabled) {
    border-color: color-mix(
      in srgb,
      var(--construction-trace-b) 72%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--construction-trace-b) 24%,
      transparent
    );
    transform: translateY(-1px);
  }
  .play-button:focus-visible,
  input:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
  }
  .play-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cycle-scrubber {
    display: grid;
    min-width: 0;
  }
  .cycle-scrubber span {
    margin-bottom: -0.3rem;
    color: var(--construction-muted);
    font-size: 0.75rem;
  }
  .cycle-scrubber input {
    width: 100%;
    min-height: 44px;
    margin: 0;
    accent-color: var(--construction-trace-b);
    cursor: pointer;
  }
  .cycle-scrubber input:focus-visible {
    border-radius: 0.5rem;
  }

  .progress-value {
    align-self: center;
    color: var(--construction-text);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  @container (max-width: 29rem) {
    .transport {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .progress-value {
      display: none;
    }
    .play-button {
      min-width: 5.75rem;
      padding-inline: 0.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .play-button {
      transition: none;
    }
  }
</style>
