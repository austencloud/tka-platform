<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { reducedMotion } from "$lib/shared/transitions/motion";
  import {
    createRenderActivityGate,
    renderGateTarget,
  } from "$lib/shared/render-gating/render-activity-gate";
  import HandMotionPlayer from "$lib/features/learn/components/interactive/foundations/HandMotionPlayer.svelte";
  import { TIMING_DIRECTION_MODES } from "$lib/features/learn/components/interactive/foundations/pictograph-foundation-content";
  import {
    TIMING_DIRECTION_ARTICLES,
    type DirectionValue,
  } from "../_data/timing-direction-articles";

  const modes = TIMING_DIRECTION_ARTICLES.map((article) => ({
    article,
    motion: TIMING_DIRECTION_MODES.find(
      (mode) =>
        mode.timing === article.timing && mode.direction === article.direction
    )!,
    href: `/timing-and-direction/${article.slug}`,
  }));
  const directions: readonly DirectionValue[] = ["Same", "Opposite"];
  let selectedCode = $state("TS");
  let playing = $state(true);
  let currentStep = $state(0);
  let seekClock: ((step: number) => void) | null = null;
  const clockMode = modes[0]!;
  const playbackGate = createRenderActivityGate({
    name: "timing-direction-atlas",
  });

  function followClock(step: number, sequenceId: string | null): void {
    if (sequenceId === clockMode.motion.sequence.id) currentStep = step;
  }

  function registerClockSeek(seek: ((step: number) => void) | null): void {
    seekClock = seek;
  }

  onDestroy(() => playbackGate.dispose());
  let detailHeading: HTMLHeadingElement | null = $state(null);
  const selected = $derived(
    modes.find((mode) => mode.article.code === selectedCode)!
  );

  onMount(() => {
    if (reducedMotion()) playing = false;
  });

  function selectMode(code: string): void {
    selectedCode = code;
    // On phones the larger player is below the grid; bring the result into view.
    if (window.matchMedia("(max-width: 900px)").matches) {
      detailHeading?.focus({ preventScroll: true });
      detailHeading?.scrollIntoView({
        behavior: reducedMotion() ? "instant" : "smooth",
        block: "start",
      });
    }
  }
</script>

<section
  class="atlas"
  aria-label="Six timing and direction modes"
  use:renderGateTarget={playbackGate}
>
  <div class="atlas-toolbar">
    <p>Select a preview to see it larger.</p>
    <PanelButton
      onclick={() => (playing = !playing)}
      ariaLabel={playing ? "Pause all animations" : "Play all animations"}
    >
      <i class="fa-solid {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
      ></i>
      <span class="play-label">{playing ? "Pause all" : "Play all"}</span>
    </PanelButton>
  </div>

  <div class="atlas-body">
    <div
      id="mode-comparison"
      class="comparison"
      aria-label="Compare all six modes"
    >
      <div class="timing-headings" aria-hidden="true">
        {#each modes.filter((mode) => mode.article.direction === "Same") as mode}
          <span>{mode.article.timing}</span>
        {/each}
      </div>
      {#each directions as direction}
        <div
          class="direction-group"
          role="group"
          aria-label={`${direction} direction`}
        >
          <h2>{direction} direction</h2>
          <div class="mode-row">
            {#each modes.filter((mode) => mode.article.direction === direction) as mode (mode.article.code)}
              <article
                class="mode"
                class:selected={selectedCode === mode.article.code}
                style:--mode-accent={mode.motion.element.accentColor}
                aria-label={mode.article.name}
              >
                <button
                  class="preview"
                  type="button"
                  aria-label={`Preview ${mode.article.name}`}
                  aria-pressed={selectedCode === mode.article.code}
                  aria-controls="timing-detail"
                  onclick={() => selectMode(mode.article.code)}
                >
                  <span class="preview-label">
                    <strong>
                      <img
                        src={mode.motion.element.iconPath}
                        alt=""
                        width="18"
                        height="18"
                      />
                      {mode.article.code}
                    </strong>
                    <i
                      class="fa-solid fa-check"
                      class:shown={selectedCode === mode.article.code}
                      aria-hidden="true"
                    ></i>
                  </span>
                  <span class="preview-animation">
                    <HandMotionPlayer
                      sequence={mode.motion.sequence}
                      ariaLabel={mode.article.name}
                      interactive={false}
                      externalPlaying={playing}
                      externalStep={mode === clockMode ? null : currentStep}
                      onStepChange={mode === clockMode
                        ? followClock
                        : undefined}
                      onSeekRef={mode === clockMode
                        ? registerClockSeek
                        : undefined}
                      playbackGate={mode === clockMode
                        ? playbackGate
                        : undefined}
                      framed={false}
                    />
                  </span>
                </button>
                <div class="article-action">
                  <PanelButton
                    href={mode.href}
                    ariaLabel={`Read ${mode.article.name}`}
                    accentColor={mode.motion.element.accentColor}
                  >
                    <i class="fa-solid fa-book-open" aria-hidden="true"></i>
                    <span>Article</span>
                  </PanelButton>
                </div>
              </article>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <section
      id="timing-detail"
      class="detail"
      aria-label="Selected mode"
      style:--mode-accent={selected.motion.element.accentColor}
    >
      <header class="detail-heading" aria-live="polite" aria-atomic="true">
        <img
          src={selected.motion.element.iconPath}
          alt=""
          width="32"
          height="32"
        />
        <div>
          <h2 bind:this={detailHeading} tabindex="-1">
            {selected.article.timing} time
          </h2>
          <p>
            {selected.article.direction} direction
            <span>· {selected.article.code}</span>
          </p>
        </div>
      </header>
      <div class="detail-animation">
        <HandMotionPlayer
          sequence={selected.motion.sequence}
          ariaLabel={`${selected.article.name}. Drag the playback bar to scrub.`}
          externalPlaying={playing}
          externalStep={currentStep}
          onExternalSeek={(step) => seekClock?.(step)}
          onExternalPlayingChange={(nextPlaying) => (playing = nextPlaying)}
          framed={false}
        />
      </div>
      <div class="detail-footer">
        <p>Drag the bar to scrub.</p>
        <PanelButton
          href={selected.href}
          accentColor={selected.motion.element.accentColor}
        >
          <i class="fa-solid fa-book-open" aria-hidden="true"></i>
          Read {selected.article.code} article
        </PanelButton>
      </div>
      <div class="compare-action">
        <PanelButton href="#mode-comparison">
          <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
          All six modes
        </PanelButton>
      </div>
    </section>
  </div>
</section>

<style>
  .atlas {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .atlas-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .atlas-toolbar p,
  .detail-footer p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .play-label {
    display: inline-block;
    min-width: 4.25rem;
  }

  .atlas-toolbar :global(.panel-btn) {
    flex-shrink: 0;
  }

  .atlas-body {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: clamp(1.5rem, 3vw, 3rem);
    align-items: center;
  }

  .comparison {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
    scroll-margin-top: 5.5rem;
  }

  .timing-headings,
  .mode-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.4rem, 1vw, 0.85rem);
  }

  .timing-headings {
    text-align: center;
    color: var(--theme-text);
    font-size: 1rem;
    font-weight: 700;
  }

  .direction-group {
    min-width: 0;
  }

  .direction-group h2 {
    margin: 0 0 0.5rem;
    color: var(--theme-text);
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.25;
  }

  .mode,
  .detail {
    min-width: 0;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--radius-lg, 0.75rem);
    /* Keep the moving background out of the demonstrations. */
    background: rgb(from var(--theme-panel-bg) r g b / 1);
  }

  .mode {
    background: color-mix(
      in srgb,
      var(--mode-accent) 9%,
      rgb(from var(--theme-panel-bg) r g b / 1)
    );
    border-color: color-mix(
      in srgb,
      var(--mode-accent) 45%,
      var(--theme-stroke-strong)
    );
    transition:
      border-color var(--transition-normal),
      background-color var(--transition-normal);
  }

  .mode.selected {
    background: color-mix(
      in srgb,
      var(--mode-accent) 17%,
      rgb(from var(--theme-panel-bg) r g b / 1)
    );
    border-color: var(--mode-accent);
    box-shadow: 0 0 0 1px var(--mode-accent);
  }

  .preview {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--radius-lg, 0.75rem);
    background: transparent;
    color: var(--theme-text);
    cursor: pointer;
  }

  .preview:hover {
    background: color-mix(in srgb, var(--mode-accent) 10%, transparent);
  }

  .preview-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.65rem 0.65rem 0;
    font-size: 0.875rem;
    line-height: 1.25;
  }

  .preview-label i {
    visibility: hidden;
    color: var(--mode-accent);
  }

  .preview-label strong {
    color: var(--mode-accent);
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
  }

  .preview-label i.shown {
    visibility: visible;
  }

  .preview-animation {
    display: block;
    width: 100%;
    aspect-ratio: 1.15;
    overflow: hidden;
    border-radius: inherit;
  }

  .article-action {
    display: flex;
    justify-content: center;
    padding: 0 0.5rem 0.5rem;
  }

  .article-action :global(.panel-btn) {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }

  .preview:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 3px;
  }

  .detail {
    overflow: hidden;
    border-color: color-mix(
      in srgb,
      var(--mode-accent) 55%,
      var(--theme-stroke)
    );
    background: color-mix(
      in srgb,
      var(--mode-accent) 7%,
      rgb(from var(--theme-panel-bg) r g b / 1)
    );
  }

  .detail-heading {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 1rem;
    min-height: 5.25rem;
  }

  .detail-heading img {
    flex: 0 0 auto;
  }

  .detail-heading h2 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.25rem, 1rem + 0.4vw, 1.65rem);
    line-height: 1.25;
    scroll-margin-top: 7rem;
  }

  .detail-heading h2:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 4px;
  }

  .detail-heading p {
    margin: 0.25rem 0 0;
    color: var(--theme-text);
    font-size: 1rem;
    line-height: 1.3;
  }

  .detail-heading p span {
    color: var(--theme-text-dim);
  }

  .detail-animation {
    width: 100%;
    aspect-ratio: 1.08;
  }

  .detail-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    padding: 0.35rem 1rem 0.75rem;
  }

  .compare-action {
    display: none;
    justify-content: center;
    padding: 0 1rem 0.75rem;
  }

  @media (max-width: 900px) {
    .atlas-body {
      grid-template-columns: minmax(0, 1fr);
    }

    .detail {
      width: min(100%, 36rem);
      justify-self: center;
    }

    .compare-action {
      display: flex;
    }
  }

  @media (max-width: 480px) {
    .atlas {
      gap: 0.75rem;
    }

    .atlas-toolbar {
      gap: 0.5rem;
    }

    .atlas-toolbar :global(.panel-btn) {
      padding: 0.5rem 0.6rem;
    }

    .timing-headings {
      font-size: 0.875rem;
    }

    .preview-label {
      padding: 0.4rem 0.4rem 0;
    }

    .article-action i {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mode {
      transition: none;
    }
  }
</style>
