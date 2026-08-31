<script lang="ts">
  import { VIEWBOX_SIZE } from "$lib/shared/render/core/constants/viewbox";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getPropDimensions } from "$lib/shared/animation-engine/services/IPropTextureLoader";
  import { getTipPointsBaseline } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
  import {
    getAllPropTypes,
    getPropTypeDisplayInfo,
    hasBigVariant,
    isBigVariant,
    isPropActive,
    toggleBigVariant,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { propTipEnds } from "$lib/shared/pictograph/prop/domain/prop-tip-ends";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    HAND_ORBIT,
    MAX_STAGE_SCALE,
    MIN_STAGE_SCALE,
    compactStageMetrics,
    matchedStageScale,
    requiredStageScale,
  } from "./compact-stage";

  const CENTER = VIEWBOX_SIZE / 2;

  interface PropView {
    type: PropType;
    label: string;
    href: string;
    width: number;
    height: number;
    reach: number;
    ends: 1 | 2;
  }

  interface BigPair {
    base: PropView;
    big: PropView;
    matchedScale: number;
    requiredScale: number;
  }

  function propSvgHref(type: PropType): string {
    const value = type.toLowerCase();
    const animatedOnly =
      value === "torch" ||
      value === "bigtorch" ||
      value === "triquetra2" ||
      value.startsWith("sword-");
    return `/images/props/${animatedOnly ? "animated" : "pictograph"}/${value}.svg`;
  }

  function propView(type: PropType): PropView {
    const { width, height } = getPropDimensions(type);
    const points = getTipPointsBaseline(type).points;
    const reach = points.length
      ? Math.max(...points.map((point) => Math.hypot(point.dx, point.dy)))
      : 0;
    return {
      type,
      label: getPropTypeDisplayInfo(type).label,
      href: propSvgHref(type),
      width,
      height,
      reach,
      ends: propTipEnds(type),
    };
  }

  const pairs: BigPair[] = getAllPropTypes()
    .filter(
      (type) => isPropActive(type) && hasBigVariant(type) && !isBigVariant(type)
    )
    .map((type) => {
      const base = propView(type);
      const big = propView(toggleBigVariant(type));
      return {
        base,
        big,
        matchedScale: matchedStageScale(base.reach, big.reach),
        requiredScale: requiredStageScale(base.reach, big.reach),
      };
    });

  let selectedBase = $state<PropType>(PropType.FAN);
  let stageScaleOverride = $state<number | null>(null);
  const selectedPair = $derived(
    pairs.find(({ base }) => base.type === selectedBase) ?? pairs[0]
  );
  const stageScale = $derived(
    stageScaleOverride ?? selectedPair?.matchedScale ?? MAX_STAGE_SCALE
  );
  const metrics = $derived(
    selectedPair
      ? compactStageMetrics(
          selectedPair.base.reach,
          selectedPair.big.reach,
          stageScale
        )
      : null
  );
  const trackedEndsMatch = $derived(
    selectedPair?.base.ends === selectedPair?.big.ends
  );
  const compactMatchAvailable = $derived(
    !!selectedPair &&
      selectedPair.requiredScale >= MIN_STAGE_SCALE &&
      selectedPair.requiredScale <= MAX_STAGE_SCALE
  );
  const matchButtonLabel = $derived.by(() => {
    if (!selectedPair) return "Reset stage scale";
    if (compactMatchAvailable) {
      return `Match current ratio · ${Math.round(selectedPair.matchedScale * 100)}%`;
    }
    return `Closest compact scale · ${Math.round(selectedPair.matchedScale * 100)}% (needs ${Math.round(selectedPair.requiredScale * 100)}%)`;
  });
  const compatibilityNote = $derived.by(() => {
    if (!selectedPair) return "";
    if (!trackedEndsMatch) {
      return "This Big variant changes the tracked-end contract. It needs a semantic identity, not a scale replacement.";
    }
    if (!compactMatchAvailable) {
      return "This Big variant is not larger by tracked reach. A smaller grid would exaggerate it instead of reproducing it.";
    }
    return "The tracked-end contract survives. Compare the actual silhouette before replacing the Big type.";
  });

  function selectPair(type: PropType): void {
    selectedBase = type;
    stageScaleOverride = null;
  }

  function updateStageScale(event: Event): void {
    stageScaleOverride = Number(
      (event.currentTarget as HTMLInputElement).value
    );
  }

  function gridScaleTransform(scale: number): string {
    return `translate(${CENTER} ${CENTER}) scale(${scale}) translate(${-CENTER} ${-CENTER})`;
  }
</script>

<section class="comparison" aria-labelledby="compact-stage-title">
  <div class="section-heading">
    <div>
      <span class="eyebrow">Spatial-scale experiment</span>
      <h2 id="compact-stage-title">Big prop or compact stage?</h2>
      <p>
        The proposal keeps the regular prop comfortable and contracts the grid
        beneath it. Matched scale preserves the current prop-to-grid ratio.
      </p>
    </div>
    {#if selectedPair && metrics}
      <div class="scale-readout" aria-live="polite">
        <strong>{Math.round(metrics.stageScale * 100)}%</strong>
        <span>stage scale</span>
      </div>
    {/if}
  </div>

  <div class="pair-tabs" role="list" aria-label="Big prop families">
    {#each pairs as pair (pair.base.type)}
      <button
        type="button"
        class:active={pair.base.type === selectedPair?.base.type}
        aria-pressed={pair.base.type === selectedPair?.base.type}
        onclick={() => selectPair(pair.base.type)}
      >
        {pair.base.label}
      </button>
    {/each}
  </div>

  {#if selectedPair && metrics}
    <div class="stage-legend" aria-label="Comparison diagram legend">
      <span><i class="grid-swatch"></i>Production animation grid</span>
      <span><i class="reach-swatch"></i>Measured outer reach</span>
      <span><i class="reference-swatch"></i>Full-size hand radius</span>
    </div>

    <div class="comparison-grid">
      <figure class="stage-card current-card">
        <figcaption>
          <span class="card-kicker">Current model</span>
          <strong>{selectedPair.big.label}</strong>
          <span>{Math.round(selectedPair.big.reach)} reach · full grid</span>
        </figcaption>
        <svg
          viewBox="0 0 {VIEWBOX_SIZE} {VIEWBOX_SIZE}"
          role="img"
          aria-label="{selectedPair.big.label} on the current full-size grid"
        >
          <rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} class="stage-bg" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HAND_ORBIT + selectedPair.big.reach}
            class="mandala-ring"
          />
          <g class="production-grid strict-mode">
            <GridSvg gridMode={GridMode.DIAMOND} showNonRadialPoints={true} />
          </g>
          <image
            href={selectedPair.big.href}
            x={CENTER + HAND_ORBIT - selectedPair.big.width / 2}
            y={CENTER - selectedPair.big.height / 2}
            width={selectedPair.big.width}
            height={selectedPair.big.height}
          />
        </svg>
      </figure>

      <figure class="stage-card proposal-card">
        <figcaption>
          <span class="card-kicker">Proposed model</span>
          <strong>{selectedPair.base.label} + compact stage</strong>
          <span>
            {Math.round(selectedPair.base.reach)} reach ·
            {Math.round(metrics.compactOrbit)} grid radius
          </span>
        </figcaption>
        <svg
          viewBox="0 0 {VIEWBOX_SIZE} {VIEWBOX_SIZE}"
          role="img"
          aria-label="{selectedPair.base
            .label} on a compact grid at {Math.round(
            metrics.stageScale * 100
          )} percent scale"
        >
          <rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} class="stage-bg" />
          <circle cx={CENTER} cy={CENTER} r={HAND_ORBIT} class="ghost-orbit" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={metrics.compactOrbit + selectedPair.base.reach}
            class="mandala-ring proposed"
          />
          <g
            class="production-grid compact strict-mode"
            transform={gridScaleTransform(metrics.stageScale)}
            style:--grid-mark-counter-scale={1 / metrics.stageScale}
          >
            <GridSvg gridMode={GridMode.DIAMOND} showNonRadialPoints={true} />
          </g>
          <image
            href={selectedPair.base.href}
            x={CENTER + metrics.compactOrbit - selectedPair.base.width / 2}
            y={CENTER - selectedPair.base.height / 2}
            width={selectedPair.base.width}
            height={selectedPair.base.height}
          />
        </svg>
      </figure>
    </div>

    <div class="controls-card">
      <div class="slider-heading">
        <label for="compact-stage-scale">Stage scale</label>
        <button type="button" onclick={() => (stageScaleOverride = null)}>
          {matchButtonLabel}
        </button>
      </div>
      <input
        id="compact-stage-scale"
        type="range"
        min={MIN_STAGE_SCALE}
        max={MAX_STAGE_SCALE}
        step="0.01"
        value={metrics.stageScale}
        oninput={updateStageScale}
      />
      <div class="scale-axis" aria-hidden="true">
        <span>Smaller grid</span>
        <span>Full grid</span>
      </div>

      <div class="metric-row">
        <div>
          <span>Ratio drift</span>
          <strong class:matched={Math.abs(metrics.ratioDriftPercent) < 0.5}>
            {metrics.ratioDriftPercent >= 0
              ? "+"
              : ""}{metrics.ratioDriftPercent.toFixed(1)}%
          </strong>
        </div>
        <div>
          <span>Tracked ends</span>
          <strong class:warning={!trackedEndsMatch}>
            {selectedPair.base.ends} → {selectedPair.big.ends}
          </strong>
        </div>
        <p class:warning-note={!trackedEndsMatch || !compactMatchAvailable}>
          {compatibilityNote}
        </p>
      </div>
    </div>
  {/if}
</section>

<style>
  .comparison {
    container-type: inline-size;
    max-width: 162.5rem;
    margin: 0 auto 3rem;
    color: var(--theme-text, #e8e6f4);
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .eyebrow,
  .card-kicker {
    display: block;
    color: var(--theme-accent, #9b8cff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0.25rem 0 0.35rem;
    font-size: clamp(1.35rem, 2.5cqi, 2rem);
    line-height: 1.1;
  }

  .section-heading p {
    max-width: 48rem;
    margin: 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.5;
  }

  .scale-readout {
    flex: 0 0 auto;
    min-width: 7.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.875rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    text-align: right;
  }

  .scale-readout strong {
    display: block;
    color: var(--theme-accent, #9b8cff);
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
  }

  .scale-readout span {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .pair-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.25rem 0 0.5rem;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .pair-tabs button,
  .slider-heading button {
    min-height: 44px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    color: var(--theme-text, #e8e6f4);
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    cursor: pointer;
  }

  .pair-tabs button {
    flex: 0 0 auto;
    padding: 0.65rem 1rem;
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .pair-tabs button:hover,
  .pair-tabs button.active {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #9b8cff) 70%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #9b8cff) 16%,
      transparent
    );
  }

  .pair-tabs button:focus-visible,
  .slider-heading button:focus-visible,
  input[type="range"]:focus-visible {
    outline: 3px solid
      color-mix(in srgb, var(--theme-accent, #9b8cff) 55%, transparent);
    outline-offset: 2px;
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .stage-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem 1.1rem;
    margin: 0 0 0.85rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .stage-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .stage-legend i {
    display: inline-block;
    width: 1.25rem;
    height: 0.5rem;
  }

  .grid-swatch {
    border-radius: 999px;
    background: #d0d0d0;
  }

  .reach-swatch {
    border-top: 2px dashed rgba(255, 255, 255, 0.48);
  }

  .reference-swatch {
    border-top: 2px dashed rgba(255, 255, 255, 0.2);
  }

  .stage-card {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 1rem;
    background: var(--theme-card-bg, #101018);
  }

  .proposal-card {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #9b8cff) 55%,
      transparent
    );
  }

  figcaption {
    display: grid;
    min-height: 5.5rem;
    align-content: center;
    gap: 0.15rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  figcaption strong {
    font-size: 1.05rem;
  }

  figcaption > span:last-child {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }

  .stage-bg {
    fill: var(--theme-panel-bg, #0c0c13);
  }

  .ghost-orbit,
  .mandala-ring {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .production-grid {
    color: #d0d0d0;
  }

  .production-grid.compact :global(circle) {
    transform: scale(var(--grid-mark-counter-scale));
    transform-box: fill-box;
    transform-origin: center;
  }

  .mandala-ring {
    stroke: rgba(255, 255, 255, 0.24);
    stroke-width: 3;
    stroke-dasharray: 12 10;
  }

  .mandala-ring.proposed {
    stroke: color-mix(in srgb, var(--theme-accent, #9b8cff) 60%, transparent);
  }

  .ghost-orbit {
    stroke: rgba(255, 255, 255, 0.12);
    stroke-width: 2;
    stroke-dasharray: 6 10;
  }

  .controls-card {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }

  .slider-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.7rem;
  }

  .slider-heading label {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
  }

  .slider-heading button {
    padding: 0.55rem 0.9rem;
    border-radius: 0.75rem;
    background: transparent;
  }

  input[type="range"] {
    width: 100%;
    min-height: 44px;
    margin: 0;
    accent-color: var(--theme-accent, #9b8cff);
    cursor: pointer;
  }

  .scale-axis {
    display: flex;
    justify-content: space-between;
    margin-top: -0.4rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .metric-row {
    display: grid;
    grid-template-columns: auto auto minmax(15rem, 1fr);
    align-items: center;
    gap: 1rem 1.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .metric-row > div {
    display: grid;
    gap: 0.1rem;
  }

  .metric-row span {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .metric-row strong {
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .metric-row strong.matched {
    color: var(--semantic-success, #78dca0);
  }

  .metric-row strong.warning,
  .warning-note {
    color: var(--semantic-warning, #f0c85a);
  }

  .metric-row p {
    margin: 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  @container (max-width: 44rem) {
    .section-heading,
    .slider-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .scale-readout {
      align-self: flex-start;
      text-align: left;
    }

    .comparison-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .metric-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric-row p {
      grid-column: 1 / -1;
    }
  }

  @container (max-width: 28rem) {
    .section-heading {
      gap: 0.85rem;
    }

    .pair-tabs button {
      padding-inline: 0.85rem;
    }

    .controls-card {
      padding: 0.85rem;
    }

    .metric-row {
      gap: 0.75rem;
    }
  }
</style>
