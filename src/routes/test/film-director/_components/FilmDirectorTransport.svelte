<script lang="ts">
  import { getFilmDirectorContext } from "../_lib/film-director-context";

  const director = getFilmDirectorContext();

  function formatTime(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }
</script>

<div class="transport" aria-label="Film playback controls">
  <div class="playback-row">
    <div class="button-cluster">
      <button
        class="icon-button"
        type="button"
        onclick={director.previousScene}
        aria-label="Previous scene"
      >
        <i class="fas fa-backward-step" aria-hidden="true"></i>
      </button>
      <button
        class="play-button"
        type="button"
        onclick={director.togglePlayback}
        aria-label={director.wantsToPlay ? "Pause film" : "Play film"}
      >
        <i
          class="fas {director.wantsToPlay ? 'fa-pause' : 'fa-play'}"
          aria-hidden="true"
        ></i>
        <span>{director.wantsToPlay ? "Pause" : "Play"}</span>
      </button>
      <button
        class="icon-button"
        type="button"
        onclick={director.nextScene}
        aria-label="Next scene"
      >
        <i class="fas fa-forward-step" aria-hidden="true"></i>
      </button>
    </div>

    <label class="scrubber">
      <span class="sr-only">Film position</span>
      <input
        type="range"
        min="0"
        max={director.film.durationSeconds}
        step="0.01"
        value={director.playheadSeconds}
        oninput={(event) =>
          director.seek(
            Number((event.currentTarget as HTMLInputElement).value)
          )}
      />
    </label>

    <span class="timecode">
      {formatTime(director.playheadSeconds)} / {formatTime(
        director.film.durationSeconds
      )}
    </span>

    <button class="json-button" type="button" onclick={director.toggleEditor}>
      <i class="fas fa-code" aria-hidden="true"></i>
      <span>Scene JSON</span>
    </button>
  </div>

  <div class="scene-strip themed-scrollbar" aria-label="Film scenes">
    {#each director.film.scenes as scene, index (scene.id)}
      <button
        class:active={index === director.frame.sceneIndex}
        class="scene-button"
        type="button"
        onclick={() => director.selectScene(index)}
        aria-current={index === director.frame.sceneIndex ? "true" : undefined}
      >
        <span class="scene-number">{String(index + 1).padStart(2, "0")}</span>
        <span class="scene-name">{scene.title}</span>
        <span class="scene-duration">{scene.durationSeconds}s</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .transport {
    position: absolute;
    right: max(0.75rem, env(safe-area-inset-right));
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    left: max(0.75rem, env(safe-area-inset-left));
    z-index: 70;
    display: grid;
    gap: 0.65rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 94%,
      transparent
    );
    box-shadow: 0 1rem 3.5rem rgba(0, 0, 0, 0.38);
  }

  .playback-row {
    display: grid;
    grid-template-columns: auto minmax(8rem, 1fr) auto auto;
    align-items: center;
    gap: 0.65rem;
  }

  .button-cluster {
    display: flex;
    gap: 0.4rem;
  }

  button {
    min-height: 2.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.7rem;
    color: inherit;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #242431) 78%,
      var(--theme-accent, #8b7cf6)
    );
  }

  button:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .icon-button {
    width: 2.75rem;
    padding: 0;
  }

  .play-button,
  .json-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 0.9rem;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
  }

  .play-button {
    min-width: 6.4rem;
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #9d8cff) 68%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 32%,
      var(--theme-card-bg, #242431)
    );
  }

  .scrubber {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .scrubber input {
    width: 100%;
    min-height: 2.75rem;
    accent-color: var(--theme-accent, #9d8cff);
    cursor: pointer;
  }

  .timecode {
    min-width: 5.9rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .scene-strip {
    display: flex;
    gap: 0.5rem;
    min-width: 0;
    padding-bottom: 0.15rem;
    overflow-x: auto;
    scroll-snap-type: x proximity;
  }

  .scene-button {
    display: grid;
    grid-template-columns: auto minmax(8rem, auto) auto;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.6rem;
    min-width: 12rem;
    padding: 0 0.8rem;
    scroll-snap-align: start;
    text-align: left;
  }

  .scene-button.active {
    border-color: var(--theme-accent, #9d8cff);
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 24%,
      var(--theme-card-bg, #242431)
    );
  }

  .scene-number,
  .scene-duration {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .scene-name {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 44rem) {
    .transport {
      gap: 0.5rem;
      padding: 0.6rem;
    }

    .playback-row {
      grid-template-columns: auto minmax(4rem, 1fr) auto;
      gap: 0.45rem;
    }

    .timecode {
      display: none;
    }

    .json-button {
      width: 2.75rem;
      min-width: 2.75rem;
      padding: 0;
    }

    .json-button span,
    .play-button span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    .play-button {
      min-width: 2.75rem;
      padding: 0;
    }

    .scene-button {
      grid-template-columns: auto minmax(7rem, auto);
      min-width: 10.5rem;
    }

    .scene-duration {
      display: none;
    }
  }

  @media (max-height: 31rem) and (min-width: 45rem) {
    .transport {
      grid-template-columns: minmax(0, 1fr) minmax(18rem, auto);
      align-items: center;
    }

    .scene-strip {
      order: -1;
    }

    .scene-button {
      min-width: 10rem;
    }

    .scene-duration {
      display: none;
    }
  }
</style>
