<script lang="ts">
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { TIMING_DIRECTION_MODES } from "$lib/features/learn/components/interactive/foundations/pictograph-foundation-content";
  import {
    getTimingDirectionArticleByPair,
    type DirectionValue,
    type TimingValue,
  } from "../_data/timing-direction-articles";

  const TIMING_OPTIONS: { value: TimingValue; label: string }[] = [
    { value: "Together", label: "Together" },
    { value: "Split", label: "Split" },
    { value: "Quarter", label: "Quarter" },
  ];
  const DIRECTION_OPTIONS: { value: DirectionValue; label: string }[] = [
    { value: "Same", label: "Same" },
    { value: "Opposite", label: "Opposite" },
  ];

  let selectedTiming = $state<TimingValue>("Quarter");
  let selectedDirection = $state<DirectionValue>("Same");

  const article = $derived(
    getTimingDirectionArticleByPair(selectedTiming, selectedDirection)
  );
  const mode = $derived(
    TIMING_DIRECTION_MODES.find(
      (candidate) =>
        candidate.timing === selectedTiming &&
        candidate.direction === selectedDirection
    ) ?? TIMING_DIRECTION_MODES[0]!
  );
</script>

<div class="explorer-shell">
  <div
    class="explorer"
    style:--mode-accent={mode.element.accentColor}
    style:--theme-accent={mode.element.accentColor}
  >
    <div class="controls">
      <p class="section-kicker">Build a mode</p>
      <h2 id="relationship-builder-title">Pick one from each axis</h2>
      <p class="instruction">
        Timing says where the props are in their cycles. Direction says which
        way they rotate.
      </p>

      <div class="axis-control">
        <span id="timing-axis-label">Timing</span>
        <SegmentedControl
          options={TIMING_OPTIONS}
          value={selectedTiming}
          onchange={(value) => (selectedTiming = value)}
          color="accent"
          semantics="radiogroup"
          ariaLabelledby="timing-axis-label"
        />
      </div>

      <div class="axis-control">
        <span id="direction-axis-label">Direction</span>
        <SegmentedControl
          options={DIRECTION_OPTIONS}
          value={selectedDirection}
          onchange={(value) => (selectedDirection = value)}
          color="accent"
          semantics="radiogroup"
          ariaLabelledby="direction-axis-label"
        />
      </div>

      <div class="mode-result" aria-live="polite">
        <img src={mode.element.iconPath} alt="" />
        <div>
          <span>{article.code} · {mode.element.element}</span>
          <h3>{article.name}</h3>
          <p>{article.definition}</p>
        </div>
      </div>

      <a class="mode-link" href={`/timing-and-direction/${article.slug}`}>
        Read the {article.compactName} article
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>

    <div class="live-stage">
      <SequenceHeroDemo
        sequence={mode.sequence}
        element={mode.element}
        note={`${article.name} · ${article.phase} phase`}
        externalBpm={60}
        cornerToggle
        loadPriority="immediate"
      />
    </div>
  </div>
</div>

<style>
  .explorer-shell {
    container: timing-explorer / inline-size;
    width: 100%;
  }

  .explorer {
    display: grid;
    grid-template-columns: minmax(18rem, 0.9fr) minmax(22rem, 1.1fr);
    align-items: center;
    gap: clamp(2rem, 4vw, 5rem);
    width: 100%;
  }

  .controls {
    display: grid;
    align-content: center;
    gap: 1rem;
    min-width: 0;
  }

  .section-kicker {
    margin: 0;
  }

  h2 {
    margin: 0;
    color: var(--theme-text);
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-size: clamp(1.8rem, 1.45rem + 1vw, 2.7rem);
    line-height: 1.05;
  }

  .instruction {
    max-inline-size: var(--measure-note);
    margin: 0 0 0.35rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 1rem);
    line-height: 1.55;
  }

  .axis-control {
    display: grid;
    gap: 0.45rem;
  }

  .axis-control > span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 760;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .mode-result {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 0.9rem;
    min-height: 10.5rem;
    margin-top: 0.4rem;
    padding: 1rem;
    border: 1px solid
      color-mix(in oklch, var(--mode-accent) 38%, var(--theme-stroke));
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in oklch,
      var(--mode-accent) 9%,
      var(--theme-card-bg)
    );
  }

  .mode-result img {
    width: 3rem;
    height: 3rem;
    object-fit: contain;
  }

  .mode-result div {
    display: grid;
    gap: 0.35rem;
  }

  .mode-result span {
    color: color-mix(in oklch, var(--mode-accent) 72%, var(--theme-text));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .mode-result h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.15rem, 1rem + 0.4vw, 1.45rem);
  }

  .mode-result p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.5;
  }

  .mode-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    width: fit-content;
    min-height: 44px;
    padding: 0.65rem 1rem;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    text-decoration: none;
    border: 1px solid
      color-mix(in oklch, var(--mode-accent) 52%, var(--theme-stroke));
    border-radius: var(--radius-md, 0.5rem);
    background: color-mix(
      in oklch,
      var(--mode-accent) 11%,
      var(--theme-card-bg)
    );
  }

  .mode-link:hover {
    background: color-mix(
      in oklch,
      var(--mode-accent) 18%,
      var(--theme-card-bg)
    );
  }

  .mode-link:focus-visible {
    outline: 2px solid var(--mode-accent);
    outline-offset: 3px;
  }

  .live-stage {
    min-width: 0;
  }

  @container timing-explorer (max-width: 780px) {
    .explorer {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.75rem;
    }

    .mode-result {
      min-height: 9.75rem;
    }
  }

  @container timing-explorer (max-width: 430px) {
    .mode-result {
      min-height: 12.5rem;
    }

    .mode-link {
      width: 100%;
    }
  }
</style>
