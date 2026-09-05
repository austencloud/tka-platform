<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { CARD_SIZES } from "$lib/features/choreo-card/domain/card-sizes";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { createLayoutMotion } from "$lib/shared/transitions/layout-flip";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import HandMotionPlayer from "../foundations/HandMotionPlayer.svelte";
  import type {
    TimingDirectionMode,
    TimingDirectionModeId,
  } from "../foundations/pictograph-foundation-content";

  let {
    modes,
    onFocusChange,
    articleHrefFor,
    showDirectionRowLabels = false,
    active = true,
    onReady,
  }: {
    modes: readonly TimingDirectionMode[];
    onFocusChange?: (focused: boolean) => void;
    articleHrefFor?: (mode: TimingDirectionMode) => string;
    showDirectionRowLabels?: boolean;
    active?: boolean;
    onReady?: () => void;
  } = $props();

  const haptic = getHapticFeedback();
  const pokerCardAspectRatio =
    CARD_SIZES.poker.widthInches / CARD_SIZES.poker.heightInches;
  let boardElement: HTMLDivElement | null = $state(null);
  let focusCloseButton: HTMLButtonElement | null = $state(null);
  let focusedModeId = $state<TimingDirectionModeId | null>(null);
  let playing = $state(true);
  let highlightedStepIndex = $state<number | null>(null);
  let seekFocusedPlayer = $state<((step: number) => void) | null>(null);
  const preparedPlayers = new Set<TimingDirectionModeId>();
  let reportedReady = false;

  function playerPrepared(id: TimingDirectionModeId): void {
    preparedPlayers.add(id);
    if (reportedReady || !modes.every((mode) => preparedPlayers.has(mode.id)))
      return;
    reportedReady = true;
    onReady?.();
  }

  const focusedMode = $derived(
    modes.find((mode) => mode.id === focusedModeId) ?? null
  );
  const groupedModes = $derived.by(() => {
    if (!showDirectionRowLabels) return modes;
    return [
      ...modes.filter((mode) => mode.direction === "Same"),
      ...modes.filter((mode) => mode.direction === "Opposite"),
    ];
  });
  const orderedModes = $derived.by(() => {
    if (!focusedMode) return groupedModes;
    return [
      focusedMode,
      ...groupedModes.filter((mode) => mode.id !== focusedMode.id),
    ];
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
    highlightedStepIndex = null;
    seekFocusedPlayer = null;
    focusedModeId = nextModeId;
    onFocusChange?.(nextModeId !== null);
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

  function syncFocusedStep(
    currentStep: number,
    sequenceId: string | null
  ): void {
    if (!focusedMode || sequenceId !== focusedMode.sequence.id) return;
    highlightedStepIndex =
      currentStep < 1
        ? null
        : Math.min(
            focusedMode.sequence.steps.length - 1,
            Math.max(0, Math.floor(currentStep) - 1)
          );
  }

  function seekToCardStep(stepIndex: number): void {
    seekFocusedPlayer?.(stepIndex + 1);
    haptic?.trigger("selection");
  }

  function handleBoardKeydown(event: KeyboardEvent): void {
    if (
      event.key !== "Escape" ||
      !focusedModeId ||
      !boardElement?.contains(event.target as Node)
    ) {
      return;
    }
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

<svelte:window onkeydown={handleBoardKeydown} />

<div
  class="comparison-board"
  class:has-focus={focusedMode !== null}
  bind:this={boardElement}
  role="region"
  aria-label="Six timing and direction relationships"
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

  <div
    class="mode-grid"
    class:has-focus={focusedMode !== null}
    class:with-row-labels={showDirectionRowLabels}
  >
    {#each orderedModes as mode, index (mode.id)}
      {#if showDirectionRowLabels && !focusedMode && (index === 0 || orderedModes[index - 1]?.direction !== mode.direction)}
        <h3 class="direction-row-label">{mode.direction} Direction</h3>
      {/if}
      {@const isFocused = mode.id === focusedModeId}
      {@const articleHref = articleHrefFor?.(mode)}
      <article
        class="mode-tile"
        class:is-focused={isFocused}
        data-mode-id={mode.id}
        data-timing={mode.timing}
        data-direction={mode.direction}
        style:--element-accent={mode.element.accentColor}
        style:--element-dark={mode.element.darkComplement}
        aria-label={`${codeFor(mode)}. ${definitionFor(mode)}`}
      >
        <header class="mode-header">
          <div class="mode-identity">
            {#if focusedMode && !isFocused}
              <img src={mode.element.iconPath} alt="" />
            {/if}
            <strong>{codeFor(mode)}</strong>
            <span
              >{isFocused || focusedMode
                ? fullNameFor(mode)
                : definitionFor(mode)}</span
            >
          </div>

          {#if isFocused}
            <div class="mode-actions">
              {#if articleHref}
                <a
                  class="mode-article-link"
                  href={articleHref}
                  aria-label={`Read the ${fullNameFor(mode)} article`}
                >
                  <span>Read article</span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </a>
              {/if}
              <PanelButton
                bind:ref={focusCloseButton}
                variant="secondary"
                onclick={() => void setFocusedMode(null)}
                ariaLabel="Back to all six relationships"
              >
                <i class="fa-solid fa-compress" aria-hidden="true"></i>
                <span>All six</span>
              </PanelButton>
            </div>
          {/if}
        </header>

        {#if isFocused}
          <div class="study-surfaces">
            <div class="mode-player">
              <HandMotionPlayer
                sequence={mode.sequence}
                ariaLabel={`${fullNameFor(mode)}: ${definitionFor(mode)}`}
                showElementalGlyph
                interactive
                playbackAllowed={active}
                externalPlaying={playing}
                onExternalPlayingChange={syncPlaying}
                onStepChange={syncFocusedStep}
                onSeekRef={(seek) => (seekFocusedPlayer = seek)}
                framed={false}
              />
            </div>
            <div
              class="mode-card"
              aria-label={`${fullNameFor(mode)} hand paths by step`}
            >
              <ChoreoCard
                sequence={mode.sequence}
                handPathMode
                darkMode
                frameColors={{
                  accent: mode.element.accentColor,
                  dark: mode.element.darkComplement,
                }}
                cardAspectRatio={pokerCardAspectRatio}
                showWord={false}
                customTitleText={mode.element.name}
                showDifficultyLevel={false}
                includeStartPosition
                columnCount={2}
                showNotes
                customNotesText={definitionFor(mode)}
                showLoopGlyph={false}
                showQRCode={false}
                showStepNumbers
                forceContain
                showHighlight
                {highlightedStepIndex}
                onStepClick={seekToCardStep}
              />
            </div>
          </div>
        {:else}
          <div class="mode-player">
            <HandMotionPlayer
              sequence={mode.sequence}
              ariaLabel={`${fullNameFor(mode)}: ${definitionFor(mode)}`}
              showElementalGlyph
              interactive={focusedMode === null}
              playbackAllowed={active && focusedMode === null}
              externalPlaying={playing}
              onExternalPlayingChange={syncPlaying}
              onCanvasInitialized={() => playerPrepared(mode.id)}
              onLoadError={() => playerPrepared(mode.id)}
              framed={false}
            />
          </div>
        {/if}

        {#if !isFocused}
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
    font-size: clamp(0.875rem, calc(0.72rem + 0.25cqw), 1.125rem);
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
    grid-template-columns: minmax(0, 3fr) minmax(16rem, 0.75fr);
    grid-template-rows: repeat(5, minmax(0, 1fr));
  }

  .mode-grid.with-row-labels:not(.has-focus) {
    grid-template-columns: minmax(7.5rem, auto) repeat(3, minmax(0, 1fr));
  }

  .direction-row-label {
    min-width: 0;
    display: grid;
    place-items: center start;
    margin: 0;
    padding-inline: 0.35rem;
    color: var(--theme-text);
    font-size: clamp(0.875rem, calc(0.72rem + 0.25cqw), 1.125rem);
    font-weight: 750;
    line-height: 1.2;
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
    grid-template-rows: auto minmax(0, 1fr);
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
    grid-template-rows: minmax(0, 1fr);
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-player {
    display: none;
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-header {
    height: 100%;
    justify-content: center;
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem;
    text-align: center;
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity img {
    width: clamp(1.75rem, calc(1.45rem + 0.35cqw), 2.25rem);
    height: clamp(1.75rem, calc(1.45rem + 0.35cqw), 2.25rem);
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity strong {
    font-size: clamp(1.2rem, calc(1rem + 0.22cqw), 1.5rem);
  }

  .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity span {
    overflow: visible;
    font-size: clamp(1rem, calc(0.9rem + 0.16cqw), 1.25rem);
    line-height: 1.25;
    text-overflow: clip;
  }

  .mode-header {
    position: relative;
    z-index: 5;
    min-width: 0;
    min-height: 3rem;
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
    font-size: clamp(1.125rem, calc(0.9rem + 0.28cqw), 1.35rem);
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .mode-identity span {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-dim);
    font-size: clamp(1rem, calc(0.85rem + 0.2cqw), 1.25rem);
    font-weight: 650;
    line-height: 1.2;
    text-overflow: ellipsis;
  }

  .mode-header :global(.panel-btn) {
    flex: 0 0 auto;
    min-height: var(--min-touch-target, 44px);
    padding: 0.4rem 0.65rem;
  }

  .mode-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .mode-article-link {
    min-height: var(--min-touch-target, 44px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.4rem 0.65rem;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 650;
    text-decoration: none;
    border: 1px solid var(--element-accent);
    border-radius: var(--radius-md, 0.5rem);
    background: color-mix(
      in srgb,
      var(--element-accent) 14%,
      var(--theme-card-bg)
    );
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .mode-article-link:hover {
    background: color-mix(
      in srgb,
      var(--element-accent) 22%,
      var(--theme-card-bg)
    );
  }

  .mode-article-link:focus-visible {
    outline: 3px solid var(--element-accent);
    outline-offset: 2px;
  }

  .mode-player {
    min-width: 0;
    min-height: 0;
  }

  .study-surfaces {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(18rem, 0.92fr);
    gap: clamp(0.5rem, 1cqw, 0.9rem);
    min-width: 0;
    min-height: 0;
    padding: clamp(0.5rem, 0.8cqw, 0.8rem);
  }

  .study-surfaces .mode-player,
  .mode-card {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
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

    .mode-grid.with-row-labels:not(.has-focus) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: auto minmax(0, 1fr) auto minmax(0, 1fr);
    }

    .direction-row-label {
      grid-column: 1 / -1;
      place-items: end start;
      padding: 0.1rem 0;
    }

    .mode-grid.has-focus {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) minmax(5.5rem, auto);
    }

    .mode-tile.is-focused {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) {
      grid-column: auto;
      grid-row: 2;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-header {
      padding: 0.3rem;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity {
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.3rem;
    }

    .study-surfaces {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }
  }

  @container motion-board (max-width: 28rem) {
    .board-toolbar {
      min-height: var(--min-touch-target, 44px);
    }

    .board-toolbar :global(.panel-btn) {
      min-height: var(--min-touch-target, 44px);
      padding: 0.3rem 0.55rem;
    }

    .mode-header {
      min-height: 2.75rem;
      padding: 0.25rem 0.4rem;
    }

    .mode-identity img {
      width: 1.2rem;
      height: 1.2rem;
    }

    .mode-identity strong,
    .mode-identity span {
      font-size: var(--font-size-min, 0.875rem);
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }

    .mode-header :global(.panel-btn span),
    .board-toolbar :global(.panel-btn span),
    .mode-article-link span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }
  }

  @media (max-height: 540px) and (min-width: 801px) {
    .comparison-board {
      grid-template-rows: minmax(0, 1fr);
    }

    .board-toolbar {
      position: absolute;
      top: -3rem;
      right: 0;
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

    .board-toolbar :global(.panel-btn span) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }

    .mode-grid:not(.has-focus) {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr);
    }

    .mode-grid.with-row-labels:not(.has-focus) {
      grid-template-columns: minmax(7.5rem, auto) repeat(3, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }

    .mode-grid.with-row-labels:not(.has-focus) .direction-row-label {
      grid-column: auto;
      place-items: center start;
      padding-inline: 0.35rem;
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

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-header {
      justify-content: flex-start;
      padding: 0.25rem 0.4rem;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity {
      flex-direction: row;
      gap: 0.35rem;
      padding: 0.25rem;
      text-align: left;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity img {
      width: 1.5rem;
      height: 1.5rem;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity strong {
      font-size: 1rem;
    }

    .mode-grid.has-focus .mode-tile:not(.is-focused) .mode-identity span {
      font-size: var(--font-size-min, 0.875rem);
    }

    .study-surfaces {
      grid-template-columns: minmax(0, 1.08fr) minmax(15rem, 0.92fr);
      grid-template-rows: minmax(0, 1fr);
      padding: 0.35rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-select,
    .mode-article-link {
      transition: none;
    }
  }
</style>
