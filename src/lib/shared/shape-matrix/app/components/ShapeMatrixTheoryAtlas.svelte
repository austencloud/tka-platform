<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    buildTheorySpinRatioAtlas,
    spinRatioKey,
    spinRatioPetals,
    spinRatioToTkaTurnFraction,
    type SpinStyle,
  } from "@vtg/domain";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixTheoryStage from "./ShapeMatrixTheoryStage.svelte";

  const state = getShapeMatrixAppContext();
  const ratios = buildTheorySpinRatioAtlas();
  const ratioOptions = ratios.map((ratio) => ({
    value: spinRatioKey(ratio),
    label: spinRatioKey(ratio),
  }));
  const selectedKey = $derived(spinRatioKey(state.theoryRatio));
  const turnFraction = $derived(spinRatioToTkaTurnFraction(state.theoryRatio));
  const selectedPetals = $derived(
    spinRatioPetals(state.theoryRatio, state.theorySpin)
  );
  const spinOptions = $derived.by(() => {
    if (state.theoryRatio.propRotations === 0) {
      return [
        {
          value: "pro" as const,
          label: "Clockwise hand",
          shortLabel: "CW hand",
        },
        {
          value: "anti" as const,
          label: "Counterclockwise hand",
          shortLabel: "CCW hand",
        },
      ];
    }
    if (state.theoryRatio.handCycles === 0) {
      return [
        {
          value: "pro" as const,
          label: "Clockwise prop",
          shortLabel: "CW prop",
        },
        {
          value: "anti" as const,
          label: "Counterclockwise prop",
          shortLabel: "CCW prop",
        },
      ];
    }
    return [
      { value: "pro" as const, label: "Prospin", shortLabel: "Pro" },
      { value: "anti" as const, label: "Antispin", shortLabel: "Anti" },
    ];
  });

  function selectRatio(key: string): void {
    const ratio = ratios.find((candidate) => spinRatioKey(candidate) === key);
    if (ratio) state.setTheoryRatio(ratio);
  }

  function formatTurn(): string {
    if (turnFraction === "fl") return "Float";
    if (turnFraction === null) return "No finite value";
    if (turnFraction.numerator === 0) return "0";
    if (turnFraction.denominator === 1) return `${turnFraction.numerator}`;
    const sign = turnFraction.numerator < 0 ? "−" : "";
    return `${sign}${Math.abs(turnFraction.numerator)}/${turnFraction.denominator}`;
  }

  function closureLabel(): string {
    const cycles = state.theoryRatio.handCycles;
    if (cycles === 0) return "Stationary hand";
    return `${cycles} hand ${cycles === 1 ? "cycle" : "cycles"}`;
  }
</script>

<section class="theory-atlas" aria-labelledby="theory-atlas-title">
  <div class="theory-stage-zone">
    <header class="theory-heading">
      <div>
        <span class="eyebrow">Continuous geometry</span>
        <h2 id="theory-atlas-title">Rational Ratio Atlas</h2>
      </div>
      <span class="theory-badge">Theory</span>
    </header>

    <div class="stage-card">
      <div class="stage-label" aria-live="polite">
        <strong>{selectedKey}</strong>
        <span>{state.theorySpin === "pro" ? "Pro" : "Anti"}</span>
      </div>
      <div class="stage-window">
        <Crossfade
          key={`${selectedKey}:${state.theorySpin}`}
          duration={DURATION.normal}
          fill
        >
          <ShapeMatrixTheoryStage
            ratio={state.theoryRatio}
            spin={state.theorySpin}
          />
        </Crossfade>
      </div>
    </div>

    <dl class="ratio-facts">
      <div>
        <dt>Prop : hand</dt>
        <dd>{selectedKey}</dd>
      </div>
      <div>
        <dt>TKA-equivalent</dt>
        <dd>{formatTurn()}</dd>
      </div>
      <div>
        <dt>Closed path</dt>
        <dd>{closureLabel()}</dd>
      </div>
      <div>
        <dt>Path petals</dt>
        <dd>{selectedPetals}</dd>
      </div>
    </dl>
  </div>

  <aside class="atlas-controls" aria-label="Theory ratio controls">
    <header class="control-heading">
      <div>
        <span class="eyebrow">Exact ratios</span>
        <h3>Through ninths</h3>
      </div>
      <span class="ratio-count">{ratios.length}</span>
    </header>

    <p class="atlas-note">
      Every reduced ratio from 0:1 to 1:1 with a denominator up to 9, plus the
      stationary-hand 1:0 endpoint.
    </p>

    <div class="ratio-picker">
      <SegmentedControl
        options={ratioOptions}
        value={selectedKey}
        onchange={selectRatio}
        columns={6}
        size="sm"
        density="tight"
        color="accent"
        semantics="radiogroup"
        ariaLabel="Prop-to-hand rotation ratio"
      />
    </div>

    <div class="spin-control">
      <span class="control-label">Direction relationship</span>
      <SegmentedControl
        options={spinOptions}
        value={state.theorySpin}
        onchange={(spin: SpinStyle) => state.setTheorySpin(spin)}
        size="sm"
        color="accent"
        semantics="radiogroup"
        ariaLabel="Rotation direction relationship"
      />
    </div>

    <p class="boundary-note">
      These paths are calculated continuously. The atlas does not assign new
      Kinetic Alphabet letters.
    </p>
  </aside>
</section>

<style>
  .theory-atlas {
    container: theory-atlas / size;
    display: grid;
    grid-template-columns: minmax(26rem, 1.35fr) minmax(30rem, 1fr);
    gap: clamp(0.75rem, 1.2vw, 1.5rem);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: clamp(0.75rem, 1.25vw, 1.5rem);
    overflow: hidden;
    background:
      radial-gradient(
        circle at 28% 35%,
        color-mix(in srgb, var(--theme-accent, #f59e0b) 9%, transparent),
        transparent 34rem
      ),
      var(--theme-panel-bg, #0a0f14);
  }

  .theory-stage-zone,
  .atlas-controls {
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #111923) 92%,
      transparent
    );
  }

  .theory-stage-zone {
    display: grid;
    grid-template-rows: auto minmax(12rem, 1fr) auto;
    gap: 0.75rem;
    padding: clamp(0.75rem, 1vw, 1.25rem);
  }

  .theory-heading,
  .control-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h2,
  h3,
  p,
  dl,
  dd {
    margin: 0;
  }

  h2 {
    font-size: clamp(1.2rem, 1.6vw, 1.65rem);
    line-height: 1.15;
  }

  h3 {
    font-size: 1.05rem;
    line-height: 1.2;
  }

  .eyebrow,
  .control-label {
    display: block;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .eyebrow {
    margin-bottom: 0.25rem;
  }

  .theory-badge,
  .ratio-count {
    display: inline-grid;
    min-width: 2.5rem;
    min-height: 2rem;
    place-items: center;
    padding-inline: 0.6rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #f59e0b) 42%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 10%,
      transparent
    );
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .stage-card {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 14px;
    background:
      radial-gradient(
        circle at center,
        color-mix(in srgb, var(--theme-accent, #f59e0b) 5%, transparent),
        transparent 58%
      ),
      color-mix(in srgb, var(--theme-panel-bg, #0a0f14) 92%, black);
  }

  .stage-window {
    position: absolute;
    inset: 0;
    padding: clamp(1rem, 3cqw, 2.5rem);
  }

  .stage-label {
    position: absolute;
    z-index: 2;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    font-variant-numeric: tabular-nums;
  }

  .stage-label strong {
    font-size: 1.1rem;
  }

  .stage-label span {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.64));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .ratio-facts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .ratio-facts > div {
    min-width: 0;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    background: var(--theme-panel-bg, rgb(0 0 0 / 0.2));
  }

  .ratio-facts dt {
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ratio-facts dd {
    margin-top: 0.25rem;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atlas-controls {
    align-self: stretch;
    justify-self: stretch;
    width: 100%;
    padding: clamp(0.75rem, 1vw, 1.25rem);
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .atlas-controls > * {
    width: min(100%, 48rem);
    margin-inline: auto;
  }

  .atlas-note,
  .boundary-note {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.68));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  .atlas-note {
    max-width: 42rem;
    margin-top: 0.75rem;
  }

  .ratio-picker {
    width: min(100%, 48rem);
    margin-top: 1rem;
  }

  .ratio-picker :global(.segmented-control) {
    width: 100%;
  }

  .ratio-picker :global(.segment) {
    font-variant-numeric: tabular-nums;
  }

  .spin-control {
    display: grid;
    gap: 0.4rem;
    margin-top: 1rem;
  }

  .spin-control :global(.segmented-control) {
    width: min(100%, 22rem);
  }

  .boundary-note {
    margin-top: 1rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 10px;
    background: var(--theme-panel-bg, rgb(0 0 0 / 0.18));
  }

  @container shape-matrix-app (max-width: 74.99rem) {
    .theory-atlas {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(24rem, 58%) minmax(18rem, auto);
      overflow: auto;
    }

    .theory-stage-zone,
    .atlas-controls {
      width: 100%;
    }
  }

  @container shape-matrix-app (min-width: 48rem) and (max-height: 32rem) {
    .theory-atlas {
      grid-template-columns: minmax(22rem, 0.95fr) minmax(25rem, 1.05fr);
      grid-template-rows: 1fr;
      overflow: hidden;
    }

    .theory-stage-zone {
      grid-template-rows: auto minmax(10rem, 1fr);
    }

    .ratio-facts {
      display: none;
    }
  }

  @container shape-matrix-app (max-width: 32rem) {
    .theory-atlas {
      align-content: start;
      grid-template-rows: 27rem 40rem;
      padding: 0.5rem;
    }

    .theory-stage-zone,
    .atlas-controls {
      border-radius: 12px;
    }

    .atlas-controls {
      overflow: visible;
    }

    .ratio-facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
