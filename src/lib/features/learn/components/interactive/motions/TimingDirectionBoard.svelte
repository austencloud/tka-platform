<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { createLayoutMotion } from "$lib/shared/transitions/layout-flip";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import HandMotionPlayer from "../foundations/HandMotionPlayer.svelte";
  import type {
    TimingDirectionMode,
    TimingDirectionModeId,
  } from "../foundations/pictograph-foundation-content";

  let { modes }: { modes: readonly TimingDirectionMode[] } = $props();

  const haptic = getHapticFeedback();
  let boardElement: HTMLDivElement | null = $state(null);
  let focusCloseButton: HTMLButtonElement | null = $state(null);
  let focusedModeId = $state<TimingDirectionModeId | null>(null);
  let playing = $state(true);

  const focusedMode = $derived(
    modes.find((mode) => mode.id === focusedModeId) ?? null
  );
  const orderedModes = $derived.by(() => {
    if (!focusedMode) return modes;
    return [focusedMode, ...modes.filter((mode) => mode.id !== focusedMode.id)];
  });

  const boardMotion = createLayoutMotion({
    getRoot: () => boardElement,
    groups: [{ selector: "[data-mode-id]", datasetKey: "modeId" }],
    getDuration: () => motionDuration(DURATION.emphasis),
  });

  function codeFor(mode: TimingDirectionMode): string {
    return mode.id.toUpperCase();
  }

  function fullNameFor(mode: TimingDirectionMode): string {
    return `${mode.timing}-${mode.direction}`;
  }

  function definitionFor(mode: TimingDirectionMode): string {
    return `${mode.timing} time, ${mode.direction.toLowerCase()} direction.`;
  }

  async function setFocusedMode(
    nextModeId: TimingDirectionModeId | null
  ): Promise<void> {
    if (nextModeId === focusedModeId) return;
    const previousModeId = focusedModeId;
    const captured = boardMotion.capture();
    focusedModeId = nextModeId;
    haptic?.trigger("selection");
    await tick();
    if (captured) boardMotion.play();
    if (nextModeId) {
      focusCloseButton?.focus({ preventScroll: true });
    } else if (previousModeId) {
      boardElement
        ?.querySelector<HTMLButtonElement>(
          `[data-mode-select="${previousModeId}"]`
        )
        ?.focus({ preventScroll: true });
    }
  }

  function togglePlaying(): void {
    playing = !playing;
    haptic?.trigger("selection");
  }

  function syncPlaying(nextPlaying: boolean): void {
    playing = nextPlaying;
  }

  function handleBoardKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !focusedModeId) return;
    event.preventDefault();
    void setFocusedMode(null);
  }

  export function collapseFocus(): boolean {
    if (!focusedModeId) return false;
    void setFocusedMode(null);
    return true;
  }

  onDestroy(() => boardMotion.cancel());
</script>

<div
  class="comparison-board"
  class:has-focus={focusedMode !== null}
  bind:this={boardElement}
  onkeydown={handleBoardKeydown}
  role="region"
  aria-label="Six time and direction relationships"
>
  <div class="board-toolbar">
    <div class="selection-status" aria-live="polite">
      {focusedMode
        ? `${codeFor(focusedMode)}. ${definitionFor(focusedMode)}`
        : "All six relationships"}
    </div>
    <PanelButton
      variant="secondary"
      onclick={togglePlaying}
      ariaPressed={playing}
      ariaLabel={playing ? "Pause all animations" : "Play all animations"}
    >
      <i class="fa-solid {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
      ></i>
      <span>{playing ? "Pause all" : "Play all"}</span>
    </PanelButton>
  </div>

  <div class="mode-grid" class:has-focus={focusedMode !== null}>
    {#each orderedModes as mode (mode.id)}
      {@const isFocused = mode.id === focusedModeId}
      <article
        class="mode-tile"
        class:is-focused={isFocused}
        data-mode-id={mode.id}
        style:--element-accent={mode.element.accentColor}
        aria-label={`${codeFor(mode)}. ${definitionFor(mode)}`}
      >
        <header class="mode-header">
          <div class="mode-identity">
            <img src={mode.element.iconPath} alt="" />
            <strong>{codeFor(mode)}</strong>
            {#if isFocused}
              <span>{fullNameFor(mode)}</span>
            {/if}
          </div>

          {#if isFocused}
            <PanelButton
              bind:ref={focusCloseButton}
              variant="secondary"
              onclick={() => void setFocusedMode(null)}
              ariaLabel="Back to all six relationships"
            >
              <i class="fa-solid fa-compress" aria-hidden="true"></i>
              <span>All six</span>
            </PanelButton>
          {/if}
        </header>

        <div class="mode-player">
          <HandMotionPlayer
            sequence={mode.sequence}
            ariaLabel={`${fullNameFor(mode)}: ${definitionFor(mode)}`}
            showElementalGlyph
            interactive={isFocused}
            playbackAllowed={focusedMode === null || isFocused}
            externalPlaying={playing}
            onExternalPlayingChange={syncPlaying}
            framed={false}
          />
        </div>

        {#if isFocused}
          <p class="mode-definition">{definitionFor(mode)}</p>
        {:else}
          <button
            type="button"
            class="mode-select"
            data-mode-select={mode.id}
            onclick={() => void setFocusedMode(mode.id)}
            aria-label={`Focus ${fullNameFor(mode)}. ${definitionFor(mode)}`}
          ></button>
        {/if}
      </article>
    {/each}
  </div>
</div>

<style>
  .comparison-board {
    container: motion-board / size;
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: clamp(0.45rem, 1.1cqh, 0.75rem);
  }

  .board-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: var(--min-touch-target, 44px);
  }

  .board-toolbar :global(.panel-btn) {
    flex: 0 0 auto;
    min-height: var(--min-touch-target, 44px);
    padding: 0.45rem 0.75rem;
  }

  .selection-status {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-grid {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: clamp(0.45rem, 1.2cqw, 0.9rem);
  }

  .mode-grid.has-focus {
    grid-template-columns: minmax(0, 2.35fr) minmax(11rem, 0.65fr);
    grid-template-rows: repeat(5, minmax(0, 1fr));
  }

  .mode-tile {
    position: relative;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--element-accent) 36%, var(--theme-stroke));
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in srgb,
      var(--element-accent) 8%,
      var(--theme-card-bg)
    );
    box-shadow: 0 0.5rem 1.5rem
      color-mix(in srgb, var(--element-accent) 6%, transparent);
  }

  .mode-tile.is-focused {
    grid-column: 1;
    grid-row: 1 / 6;
    grid-template-rows: auto minmax(0, 1fr) auto;
    border-color: color-mix(
      in srgb,
      var(--element-accent) 72%,
      var(--theme-stroke-strong)
    );
    box-shadow: 0 1rem 3rem
      color-mix(in srgb, var(--element-accent) 13%, transparent);
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) {
    grid-column: 2;
  }

  .mode-header {
    position: relative;
    z-index: 5;
    min-width: 0;
    min-height: 2.6rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.55rem;
    background: color-mix(
      in srgb,
      var(--element-accent) 11%,
      var(--theme-panel-bg)
    );
  }

  .mode-identity {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .mode-identity img {
    flex: 0 0 auto;
    width: 1.45rem;
    height: 1.45rem;
    object-fit: contain;
  }

  .mode-identity strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .mode-identity span {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-header :global(.panel-btn) {
    flex: 0 0 auto;
    min-height: var(--min-touch-target, 44px);
    padding: 0.4rem 0.65rem;
  }

  .mode-player {
    min-width: 0;
    min-height: 0;
  }

  .mode-definition {
    margin: 0;
    padding: 0.55rem 0.75rem 0.65rem;
    color: var(--theme-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    line-height: 1.35;
    text-align: center;
  }

  .mode-select {
    position: absolute;
    inset: 0;
    z-index: 6;
    border: 1px solid transparent;
    border-radius: inherit;
    background: transparent;
    cursor: zoom-in;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  .mode-select:hover {
    border-color: color-mix(
      in srgb,
      var(--element-accent) 82%,
      var(--theme-text)
    );
    background: color-mix(in srgb, var(--element-accent) 7%, transparent);
  }

  .mode-select:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: -3px;
  }

  @container motion-board (max-width: 50rem) {
    .mode-grid:not(.has-focus) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
    }

    .mode-grid.has-focus {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) minmax(4.5rem, auto);
    }

    .mode-tile.is-focused {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) {
      grid-column: auto;
      grid-row: 2;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-player {
      display: none;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-header {
      height: 100%;
      justify-content: center;
      padding: 0.3rem;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity {
      flex-direction: column;
      gap: 0.15rem;
    }
  }

  @container motion-board (max-width: 28rem) {
    .board-toolbar {
      min-height: 2.5rem;
    }

    .board-toolbar :global(.panel-btn) {
      min-height: 2.5rem;
      padding: 0.3rem 0.55rem;
    }

    .selection-status {
      font-size: var(--font-size-compact, 0.75rem);
    }

    .mode-header {
      min-height: 2.25rem;
      padding: 0.25rem 0.4rem;
    }

    .mode-identity img {
      width: 1.2rem;
      height: 1.2rem;
    }

    .mode-identity strong,
    .mode-identity span,
    .mode-definition {
      font-size: var(--font-size-compact, 0.75rem);
    }

    .mode-header :global(.panel-btn span),
    .board-toolbar :global(.panel-btn span) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }
  }

  @media (max-height: 540px) and (min-width: 701px) {
    .comparison-board {
      grid-template-rows: minmax(0, 1fr);
    }

    .board-toolbar {
      position: absolute;
      top: 0.35rem;
      right: 0.35rem;
      z-index: 8;
    }

    .selection-status {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }

    .board-toolbar :global(.panel-btn) {
      background: color-mix(in srgb, var(--theme-panel-bg) 88%, transparent);
    }

    .mode-grid:not(.has-focus) {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr);
    }

    .mode-grid.has-focus {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
    }

    .mode-tile.is-focused {
      grid-column: 1 / 5;
      grid-row: 1 / 4;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) {
      grid-column: auto;
      grid-row: auto;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-player {
      display: block;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-header {
      height: auto;
      justify-content: flex-start;
      padding: 0.25rem 0.4rem;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity {
      flex-direction: row;
      gap: 0.35rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-select {
      transition: none;
    }
  }
</style>
