<script lang="ts">
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { animate } from "motion";
  import {
    classifyTrochoid,
    evaluateTrochoid,
    recommendedTrochoidSampleCount,
    sampleTrochoid,
    type TrochoidParameters,
    type TrochoidPoint,
  } from "@caps/domain/trochoid";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  const VIEWBOX_SIZE = 700;
  const CENTER = VIEWBOX_SIZE / 2;
  const UNIT_SCALE = 118;
  const CYCLE_SECONDS = 10;
  const RINGS = [0.5, 1, 1.5, 2, 2.5].map((radius) => radius * UNIT_SCALE);
  const SPOKES = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    const radius = 2.5 * UNIT_SCALE;
    return {
      x1: CENTER - Math.cos(angle) * radius,
      y1: CENTER - Math.sin(angle) * radius,
      x2: CENTER + Math.cos(angle) * radius,
      y2: CENTER + Math.sin(angle) * radius,
    };
  });

  type PresetId =
    | "five-inspin"
    | "five-antispin"
    | "cycloid"
    | "three-antispin"
    | "custom";

  interface TrochoidPreset {
    id: Exclude<PresetId, "custom">;
    label: string;
    shortLabel: string;
    parameters: TrochoidParameters;
  }

  const PRESETS: TrochoidPreset[] = [
    {
      id: "five-inspin",
      label: "Five-petal inspin rosette",
      shortLabel: "5 inspin",
      parameters: { theta1: 1, theta2: 4, rho1: 1, rho2: 1, d: 1 },
    },
    {
      id: "five-antispin",
      label: "Five-petal antispin rosette",
      shortLabel: "5 antispin",
      parameters: { theta1: 1, theta2: -6, rho1: 1, rho2: 1, d: 1 },
    },
    {
      id: "cycloid",
      label: "Five-lobed cycloid",
      shortLabel: "Cycloid",
      parameters: { theta1: 1, theta2: 4, rho1: 1, rho2: 1 / 5, d: 1 },
    },
    {
      id: "three-antispin",
      label: "Three-petal antispin rosette",
      shortLabel: "3 antispin",
      parameters: { theta1: 1, theta2: -3, rho1: 1, rho2: 1, d: 1 },
    },
  ];

  const PRESET_OPTIONS = [
    ...PRESETS.map((preset) => ({
      value: preset.id as PresetId,
      label: preset.label,
      shortLabel: preset.shortLabel,
      ariaLabel: `${preset.shortLabel}: ${preset.label}`,
    })),
    {
      value: "custom" as PresetId,
      label: "Custom parameters",
      shortLabel: "Custom",
      ariaLabel: "Custom: custom parameters",
    },
  ];

  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  let theta1 = $state(1);
  let theta2 = $state(4);
  let rho1 = $state(1);
  let rho2 = $state(1);
  let division = $state(1);
  let progress = $state(0.08);
  let playing = $state(false);
  let playback: { stop: () => void } | null = null;

  const parameters = $derived<TrochoidParameters>({
    theta1,
    theta2,
    rho1,
    rho2,
    d: division,
  });
  const classification = $derived(classifyTrochoid(parameters));
  const classificationLabel = $derived(
    classification === "cycloid"
      ? "Cycloid"
      : classification === "rosette"
        ? "Rosette"
        : "Trochoid"
  );
  const trace = $derived(
    sampleTrochoid(parameters, recommendedTrochoidSampleCount(parameters))
  );
  const tracePath = $derived(toSvgPath(trace));
  const currentTime = $derived(progress * division);
  const currentFrame = $derived(evaluateTrochoid(parameters, currentTime));
  const shoulder = $derived(project(currentFrame.shoulder));
  const hand = $derived(project(currentFrame.hand));
  const tip = $derived(project(currentFrame.tip));
  const armLabel = $derived(vectorLabel(shoulder, hand));
  const propLabel = $derived(vectorLabel(hand, tip));
  const notation = $derived(
    `${formatScalar(theta1)} ${formatScalar(theta2)} ; ${formatScalar(rho1)} ${formatScalar(rho2)} ; ${formatScalar(division)}`
  );
  const activePreset = $derived.by<PresetId>(() => {
    const match = PRESETS.find((preset) =>
      sameParameters(parameters, preset.parameters)
    );
    return match?.id ?? "custom";
  });

  function project(point: TrochoidPoint): TrochoidPoint {
    return {
      x: CENTER + point.x * UNIT_SCALE,
      y: CENTER - point.y * UNIT_SCALE,
    };
  }

  function toSvgPath(points: TrochoidPoint[]): string {
    return points
      .map((point, index) => {
        const projected = project(point);
        return `${index === 0 ? "M" : "L"} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
      })
      .join(" ");
  }

  function vectorLabel(from: TrochoidPoint, to: TrochoidPoint): TrochoidPoint {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: (from.x + to.x) / 2 - (dy / length) * 18,
      y: (from.y + to.y) / 2 + (dx / length) * 18,
    };
  }

  function formatScalar(value: number): string {
    if (Math.abs(value - Math.round(value)) < 1e-8)
      return String(Math.round(value));

    for (const denominator of [2, 3, 4, 5, 8]) {
      const numerator = Math.round(value * denominator);
      if (Math.abs(value - numerator / denominator) < 1e-8) {
        return `${numerator}/${denominator}`;
      }
    }

    return String(Number(value.toFixed(2)));
  }

  function sameParameters(
    a: TrochoidParameters,
    b: TrochoidParameters
  ): boolean {
    return (
      Math.abs(a.theta1 - b.theta1) < 1e-8 &&
      Math.abs(a.theta2 - b.theta2) < 1e-8 &&
      Math.abs(a.rho1 - b.rho1) < 1e-8 &&
      Math.abs(a.rho2 - b.rho2) < 1e-8 &&
      Math.abs(a.d - b.d) < 1e-8
    );
  }

  function stopPlayback(): void {
    playback?.stop();
    playback = null;
  }

  function startPlayback(): void {
    if (reduceMotion.current) return;
    stopPlayback();
    if (progress >= 0.999) progress = 0;

    playing = true;
    const start = progress;
    playback = animate(start, 1, {
      duration: Math.max(0.1, (1 - start) * CYCLE_SECONDS),
      ease: "linear",
      onUpdate: (latest) => {
        progress = latest;
      },
      onComplete: () => {
        if (!playing) return;
        progress = 0;
        startPlayback();
      },
    });
  }

  function pausePlayback(): void {
    playing = false;
    stopPlayback();
  }

  function togglePlayback(): void {
    if (playing) pausePlayback();
    else startPlayback();
  }

  function applyPreset(id: PresetId): void {
    if (id === "custom") return;
    const preset = PRESETS.find((candidate) => candidate.id === id);
    if (!preset) return;

    const resume = playing;
    stopPlayback();
    ({ theta1, theta2, rho1, rho2, d: division } = preset.parameters);
    progress = 0.08;
    if (resume) startPlayback();
  }

  function readRange(event: Event): number {
    return Number((event.currentTarget as HTMLInputElement).value);
  }

  function scrub(event: Event): void {
    pausePlayback();
    progress = readRange(event);
  }

  $effect(() => {
    if (reduceMotion.current && playing) pausePlayback();
  });

  onMount(() => {
    if (!reduceMotion.current) startPlayback();
    return stopPlayback;
  });
</script>

<section class="trochoid-model" aria-labelledby="trochoid-model-title">
  <header class="model-header">
    <div>
      <span class="model-kicker">Live construction</span>
      <h3 id="trochoid-model-title">{classificationLabel}</h3>
      <p>
        O stays fixed. M circles O. E circles M. The luminous line is the path
        traced by E.
      </p>
    </div>
    <code class="notation" aria-label="Current notation">{notation}</code>
  </header>

  <div
    class="equation"
    role="math"
    aria-label="P of t equals rho one times cosine and sine of two pi theta one t, plus rho two times cosine and sine of two pi times theta one plus theta two times t"
  >
    <span class="equation-formula" aria-hidden="true">
      <span class="equation-term"><i>P</i>(t) = ρ₁(cos 2πθ₁t, sin 2πθ₁t)</span>
      <span class="equation-term">
        + ρ₂(cos 2π(θ₁ + θ₂)t, sin 2π(θ₁ + θ₂)t)</span
      >
    </span>
  </div>

  <div class="preset-picker">
    <span id="trochoid-preset-label">Start with a known curve</span>
    <SegmentedControl
      options={PRESET_OPTIONS}
      value={activePreset}
      onchange={applyPreset}
      semantics="radiogroup"
      ariaLabelledby="trochoid-preset-label"
      color="accent"
      size="sm"
    />
  </div>

  <div class="model-grid">
    <div class="stage-panel">
      <div class="stage-key" aria-hidden="true">
        <span class="key-item origin-key"><i></i>O shoulder</span>
        <span class="key-item hand-key"><i></i>M hand</span>
        <span class="key-item tip-key"><i></i>E prop tip</span>
      </div>

      <svg
        class="model-stage"
        viewBox="0 0 {VIEWBOX_SIZE} {VIEWBOX_SIZE}"
        role="img"
        aria-label="Animated two-vector construction for {notation}. The shoulder is fixed at O, the hand M follows the first circle, and the prop tip E traces the {classificationLabel.toLowerCase()}."
      >
        <defs>
          <radialGradient id="trochoid-stage-wash" cx="50%" cy="48%" r="64%">
            <stop offset="0%" stop-color="var(--trochoid-stage-center)" />
            <stop offset="100%" stop-color="var(--trochoid-stage-edge)" />
          </radialGradient>
          <linearGradient
            id="trochoid-trace-gradient"
            x1="8%"
            y1="12%"
            x2="92%"
            y2="88%"
          >
            <stop offset="0%" stop-color="var(--trochoid-trace-a)" />
            <stop offset="52%" stop-color="var(--trochoid-trace-b)" />
            <stop offset="100%" stop-color="var(--trochoid-trace-c)" />
          </linearGradient>
          <filter
            id="trochoid-trace-glow"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="trochoid-node-glow"
            x="-120%"
            y="-120%"
            width="340%"
            height="340%"
          >
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="trochoid-arm-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--trochoid-arm)" />
          </marker>
          <marker
            id="trochoid-prop-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--trochoid-prop)" />
          </marker>
        </defs>

        <rect
          width={VIEWBOX_SIZE}
          height={VIEWBOX_SIZE}
          rx="34"
          fill="url(#trochoid-stage-wash)"
        />

        <g class="coordinate-grid" aria-hidden="true">
          {#each RINGS as radius (radius)}
            <circle cx={CENTER} cy={CENTER} r={radius} />
          {/each}
          {#each SPOKES as spoke, index (index)}
            <line {...spoke} />
          {/each}
          <line
            class="axis"
            x1="38"
            y1={CENTER}
            x2={VIEWBOX_SIZE - 38}
            y2={CENTER}
          />
          <line
            class="axis"
            x1={CENTER}
            y1="38"
            x2={CENTER}
            y2={VIEWBOX_SIZE - 38}
          />
        </g>

        <path class="trace-ghost" d={tracePath} />
        <path
          class="trace-drawn"
          d={tracePath}
          pathLength="1"
          stroke-dasharray="{Math.max(progress, 0.001)} 1"
          filter="url(#trochoid-trace-glow)"
        />

        <circle
          class="arm-orbit"
          cx={shoulder.x}
          cy={shoulder.y}
          r={rho1 * UNIT_SCALE}
        />
        <circle
          class="prop-orbit"
          cx={hand.x}
          cy={hand.y}
          r={rho2 * UNIT_SCALE}
        />

        <line
          class="arm-vector"
          x1={shoulder.x}
          y1={shoulder.y}
          x2={hand.x}
          y2={hand.y}
          marker-end="url(#trochoid-arm-arrow)"
        />
        <line
          class="prop-vector"
          x1={hand.x}
          y1={hand.y}
          x2={tip.x}
          y2={tip.y}
          marker-end="url(#trochoid-prop-arrow)"
        />

        <g
          class="vector-label"
          transform="translate({armLabel.x} {armLabel.y})"
        >
          <rect x="-19" y="-14" width="38" height="28" rx="12" />
          <text>ρ₁</text>
        </g>
        <g
          class="vector-label"
          transform="translate({propLabel.x} {propLabel.y})"
        >
          <rect x="-19" y="-14" width="38" height="28" rx="12" />
          <text>ρ₂</text>
        </g>

        <g
          class="point-node origin-node"
          transform="translate({shoulder.x} {shoulder.y})"
        >
          <circle class="node-halo" r="17" />
          <circle class="node-core" r="7" />
          <text x="16" y="-14">O</text>
        </g>
        <g
          class="point-node hand-node"
          transform="translate({hand.x} {hand.y})"
        >
          <circle class="node-halo" r="19" />
          <circle class="node-core" r="8" />
          <text x="17" y="-15">M</text>
        </g>
        <g class="point-node tip-node" transform="translate({tip.x} {tip.y})">
          <circle class="node-halo" r="23" filter="url(#trochoid-node-glow)" />
          <circle class="node-core" r="9" />
          <text x="18" y="-16">E</text>
        </g>
      </svg>
    </div>

    <aside class="controls" aria-label="Trochoid parameters">
      <div class="control-intro">
        <span class="control-kicker">Change the geometry</span>
        <p>
          θ₂ is measured relative to the arm. On the page, the prop vector turns
          at θ₁ + θ₂.
        </p>
      </div>

      <div class="control-list">
        <label class="parameter arm-turns">
          <span class="parameter-name"><b>θ₁</b><small>Arm turns</small></span>
          <output>{formatScalar(theta1)}</output>
          <input
            type="range"
            min="-3"
            max="3"
            step="1"
            value={theta1}
            oninput={(event) => (theta1 = readRange(event))}
          />
        </label>

        <label class="parameter prop-turns">
          <span class="parameter-name"
            ><b>θ₂</b><small>Prop turns, relative</small></span
          >
          <output>{formatScalar(theta2)}</output>
          <input
            type="range"
            min="-8"
            max="8"
            step="1"
            value={theta2}
            oninput={(event) => (theta2 = readRange(event))}
          />
        </label>

        <label class="parameter arm-radius">
          <span class="parameter-name"><b>ρ₁</b><small>Arm radius</small></span>
          <output>{formatScalar(rho1)}</output>
          <input
            type="range"
            min="0.25"
            max="1.25"
            step="0.05"
            value={rho1}
            oninput={(event) => (rho1 = readRange(event))}
          />
        </label>

        <label class="parameter prop-radius">
          <span class="parameter-name"><b>ρ₂</b><small>Prop radius</small></span
          >
          <output>{formatScalar(rho2)}</output>
          <input
            type="range"
            min="0.1"
            max="1.25"
            step="0.05"
            value={rho2}
            oninput={(event) => (rho2 = readRange(event))}
          />
        </label>

        <label class="parameter cycle-division">
          <span class="parameter-name"><b>d</b><small>Cycle used</small></span>
          <output>{formatScalar(division)}</output>
          <input
            type="range"
            min="0.25"
            max="1"
            step="0.25"
            value={division}
            oninput={(event) => (division = readRange(event))}
          />
        </label>
      </div>

      <div class="instant-readout">
        <span>At this instant</span>
        <dl>
          <div>
            <dt>t</dt>
            <dd>{currentTime.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Arm angle</dt>
            <dd>{(theta1 * currentTime).toFixed(2)} turns</dd>
          </div>
          <div>
            <dt>Prop angle</dt>
            <dd>{((theta1 + theta2) * currentTime).toFixed(2)} turns</dd>
          </div>
        </dl>
      </div>

      <div class="transport">
        <button
          type="button"
          class="play-button"
          onclick={togglePlayback}
          disabled={reduceMotion.current}
          aria-label={reduceMotion.current
            ? "Animation disabled by reduced motion preference"
            : playing
              ? "Pause model"
              : "Play model"}
        >
          <i class="fas {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
          ></i>
          {reduceMotion.current ? "Motion off" : playing ? "Pause" : "Play"}
        </button>
        <label class="cycle-scrubber">
          <span>Cycle position</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            oninput={scrub}
          />
        </label>
        <span class="progress-value" aria-hidden="true"
          >{Math.round(progress * 100)}%</span
        >
      </div>
    </aside>
  </div>
</section>

<style>
  .trochoid-model {
    --trochoid-surface: color-mix(
      in oklch,
      var(--theme-card-bg, #11151f) 88%,
      #071b19
    );
    --trochoid-panel: color-mix(
      in oklch,
      var(--theme-card-bg, #11151f) 94%,
      #102821
    );
    --trochoid-border: color-mix(
      in oklch,
      var(--theme-stroke, #ffffff1f) 68%,
      #34d399
    );
    --trochoid-text: var(--theme-text, #f8fafc);
    --trochoid-muted: var(--theme-text-dim, #aab4c3);
    --trochoid-arm: #67e8f9;
    --trochoid-prop: #c4b5fd;
    --trochoid-origin: #e2e8f0;
    --trochoid-hand: #fbbf24;
    --trochoid-tip: #fb7185;
    --trochoid-trace-a: #67e8f9;
    --trochoid-trace-b: #34d399;
    --trochoid-trace-c: #c4b5fd;
    --trochoid-stage-center: #102b29;
    --trochoid-stage-edge: #080c15;
    --theme-card-bg: var(--trochoid-panel);
    --theme-stroke: var(--trochoid-border);
    --theme-text: var(--trochoid-text);
    --theme-text-dim: var(--trochoid-muted);
    --theme-accent: #34d399;
    container-type: inline-size;
    overflow: hidden;
    border: 1px solid var(--trochoid-border);
    border-radius: clamp(18px, 2.2vw, 30px);
    background:
      radial-gradient(
        circle at 14% 0%,
        color-mix(in srgb, var(--trochoid-arm) 12%, transparent),
        transparent 34%
      ),
      radial-gradient(
        circle at 92% 8%,
        color-mix(in srgb, var(--trochoid-prop) 10%, transparent),
        transparent 30%
      ),
      var(--trochoid-surface);
    box-shadow:
      0 28px 80px rgb(0 0 0 / 0.28),
      inset 0 1px rgb(255 255 255 / 0.04);
    color: var(--trochoid-text);
  }

  .model-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: clamp(1rem, 3cqi, 2.5rem);
    padding: clamp(1.25rem, 3.2cqi, 2.35rem) clamp(1.25rem, 3.5cqi, 2.75rem)
      1rem;
  }

  .model-kicker,
  .control-kicker,
  .preset-picker > span,
  .instant-readout > span {
    display: block;
    color: color-mix(in srgb, var(--trochoid-trace-b) 86%, white);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .model-header h3 {
    margin: 0.28rem 0 0.45rem;
    font-size: clamp(1.65rem, 4cqi, 3rem);
    letter-spacing: -0.035em;
    line-height: 1;
  }

  .model-header p {
    max-width: 44rem;
    margin: 0;
    color: var(--trochoid-muted);
    font-size: clamp(0.95rem, 1.5cqi, 1.08rem);
    line-height: 1.55;
  }

  .notation {
    flex: 0 0 auto;
    min-width: 12rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid
      color-mix(in srgb, var(--trochoid-trace-b) 34%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--trochoid-trace-b) 9%, transparent);
    color: color-mix(in srgb, var(--trochoid-trace-b) 76%, white);
    font-size: clamp(0.8rem, 1.25cqi, 0.95rem);
    font-variant-numeric: tabular-nums;
    text-align: center;
    white-space: nowrap;
  }

  .equation {
    margin: 0 clamp(1.25rem, 3.5cqi, 2.75rem) 1.15rem;
    padding: 0.9rem 1rem;
    overflow-x: auto;
    border-block: 1px solid
      color-mix(in srgb, var(--trochoid-border) 75%, transparent);
    color: color-mix(
      in srgb,
      var(--trochoid-text) 88%,
      var(--trochoid-trace-b)
    );
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: clamp(0.78rem, 1.35cqi, 0.98rem);
    font-variant-numeric: tabular-nums;
    line-height: 1.55;
    text-align: center;
    white-space: nowrap;
  }

  .preset-picker {
    display: grid;
    grid-template-columns: minmax(9rem, 0.24fr) minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    padding: 0 clamp(1.25rem, 3.5cqi, 2.75rem) clamp(1.15rem, 2.4cqi, 1.75rem);
  }

  .preset-picker :global(.segmented-control) {
    min-width: 0;
  }

  .model-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.42fr) minmax(19rem, 0.72fr);
    min-height: 0;
    border-top: 1px solid var(--trochoid-border);
  }

  .stage-panel {
    position: relative;
    min-width: 0;
    padding: clamp(0.65rem, 2cqi, 1.4rem);
    background: color-mix(in srgb, var(--trochoid-stage-edge) 62%, transparent);
  }

  .stage-key {
    position: absolute;
    z-index: 2;
    top: clamp(1.1rem, 2.8cqi, 2rem);
    left: clamp(1.1rem, 2.8cqi, 2rem);
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem 0.8rem;
    max-width: calc(100% - 2.2rem);
    padding: 0.55rem 0.7rem;
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: 999px;
    background: rgb(6 10 18 / 0.74);
    backdrop-filter: blur(12px);
    color: #dbe6f2;
    font-size: clamp(0.7rem, 1.2cqi, 0.82rem);
    line-height: 1.2;
  }

  .key-item {
    display: inline-flex;
    align-items: center;
    gap: 0.34rem;
    white-space: nowrap;
  }

  .key-item i {
    width: 0.54rem;
    height: 0.54rem;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 10px currentColor;
  }

  .origin-key {
    color: var(--trochoid-origin);
  }
  .hand-key {
    color: var(--trochoid-hand);
  }
  .tip-key {
    color: var(--trochoid-tip);
  }

  .model-stage {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: clamp(18px, 2.2cqi, 28px);
    box-shadow: inset 0 0 70px rgb(0 0 0 / 0.42);
  }

  .coordinate-grid circle,
  .coordinate-grid line {
    fill: none;
    stroke: rgb(172 215 213 / 0.075);
    stroke-width: 1;
  }

  .coordinate-grid .axis {
    stroke: rgb(172 215 213 / 0.13);
  }

  .trace-ghost,
  .trace-drawn,
  .arm-orbit,
  .prop-orbit,
  .arm-vector,
  .prop-vector {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .trace-ghost {
    stroke: url(#trochoid-trace-gradient);
    stroke-width: 5;
    opacity: 0.24;
  }

  .trace-drawn {
    stroke: url(#trochoid-trace-gradient);
    stroke-width: 6;
  }

  .arm-orbit,
  .prop-orbit {
    stroke-width: 1.5;
    stroke-dasharray: 4 8;
  }

  .arm-orbit {
    stroke: color-mix(in srgb, var(--trochoid-arm) 43%, transparent);
  }
  .prop-orbit {
    stroke: color-mix(in srgb, var(--trochoid-prop) 50%, transparent);
  }

  .arm-vector,
  .prop-vector {
    stroke-width: 3;
  }

  .arm-vector {
    stroke: var(--trochoid-arm);
  }
  .prop-vector {
    stroke: var(--trochoid-prop);
  }

  .vector-label rect {
    fill: rgb(5 9 16 / 0.86);
    stroke: rgb(255 255 255 / 0.14);
  }

  .vector-label text {
    fill: #f8fafc;
    font-size: 16px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .point-node text {
    fill: #f8fafc;
    stroke: rgb(5 9 16 / 0.94);
    stroke-width: 5px;
    paint-order: stroke;
    font-size: 20px;
    font-weight: 800;
  }

  .point-node .node-halo {
    opacity: 0.18;
  }
  .point-node .node-core {
    stroke: #07101a;
    stroke-width: 3;
  }
  .origin-node .node-halo,
  .origin-node .node-core {
    fill: var(--trochoid-origin);
  }
  .hand-node .node-halo,
  .hand-node .node-core {
    fill: var(--trochoid-hand);
  }
  .tip-node .node-halo,
  .tip-node .node-core {
    fill: var(--trochoid-tip);
  }

  .controls {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: clamp(1.15rem, 2.7cqi, 2rem);
    border-left: 1px solid var(--trochoid-border);
    background: color-mix(in srgb, var(--trochoid-panel) 92%, transparent);
  }

  .control-intro p {
    margin: 0.45rem 0 1rem;
    color: var(--trochoid-muted);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .control-list {
    display: grid;
    gap: 0.28rem;
  }

  .parameter {
    --slider-color: var(--trochoid-trace-b);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3.2rem;
    align-items: center;
    column-gap: 0.75rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.065);
  }

  .parameter.arm-turns,
  .parameter.arm-radius {
    --slider-color: var(--trochoid-arm);
  }
  .parameter.prop-turns,
  .parameter.prop-radius {
    --slider-color: var(--trochoid-prop);
  }

  .parameter-name {
    display: flex;
    align-items: baseline;
    gap: 0.52rem;
    min-width: 0;
  }

  .parameter-name b {
    min-width: 1.55rem;
    color: var(--slider-color);
    font-size: 1.05rem;
  }

  .parameter-name small {
    overflow: hidden;
    color: var(--trochoid-muted);
    font-size: 0.82rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .parameter output,
  .progress-value {
    color: var(--trochoid-text);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .parameter input[type="range"] {
    grid-column: 1 / -1;
  }

  input[type="range"] {
    width: 100%;
    min-height: 44px;
    margin: 0;
    accent-color: var(--slider-color, var(--trochoid-trace-b));
    cursor: pointer;
  }

  input[type="range"]:focus-visible {
    outline: 2px solid var(--slider-color, var(--trochoid-trace-b));
    outline-offset: 2px;
    border-radius: 8px;
  }

  .instant-readout {
    margin-top: 1rem;
    padding: 0.85rem 0.9rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 13px;
    background: rgb(255 255 255 / 0.025);
  }

  .instant-readout dl {
    display: grid;
    gap: 0.38rem;
    margin: 0.62rem 0 0;
  }

  .instant-readout dl div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .instant-readout dt {
    color: var(--trochoid-muted);
    font-size: 0.8rem;
  }

  .instant-readout dd {
    margin: 0;
    color: var(--trochoid-text);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .transport {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 3rem;
    align-items: end;
    gap: 0.7rem;
    margin-top: auto;
    padding-top: 1.15rem;
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
      color-mix(in srgb, var(--trochoid-trace-b) 46%, transparent);
    border-radius: 11px;
    background: color-mix(in srgb, var(--trochoid-trace-b) 17%, transparent);
    color: color-mix(in srgb, var(--trochoid-trace-b) 74%, white);
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
    border-color: color-mix(in srgb, var(--trochoid-trace-b) 72%, transparent);
    background: color-mix(in srgb, var(--trochoid-trace-b) 24%, transparent);
    transform: translateY(-1px);
  }

  .play-button:focus-visible {
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
    margin-bottom: -0.35rem;
    color: var(--trochoid-muted);
    font-size: 0.72rem;
  }

  .cycle-scrubber input {
    --slider-color: var(--trochoid-trace-b);
  }

  @container (max-width: 55rem) {
    .model-grid {
      grid-template-columns: 1fr;
    }

    .controls {
      border-top: 1px solid var(--trochoid-border);
      border-left: 0;
    }

    .control-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 1.4rem;
    }

    .cycle-division {
      grid-column: 1 / -1;
    }

    .transport {
      margin-top: 0;
    }
  }

  @container (max-width: 39rem) {
    .model-header {
      flex-direction: column;
    }

    .notation {
      align-self: stretch;
    }

    .preset-picker {
      grid-template-columns: 1fr;
      gap: 0.65rem;
    }

    .control-list {
      grid-template-columns: 1fr;
    }

    .cycle-division {
      grid-column: auto;
    }
  }

  @container (max-width: 29rem) {
    .model-header,
    .controls {
      padding-inline: 1rem;
    }

    .equation,
    .preset-picker {
      margin-inline: 0;
      padding-inline: 1rem;
    }

    .equation {
      overflow-x: visible;
      white-space: normal;
    }

    .equation-formula {
      display: grid;
      gap: 0.25rem;
    }

    .equation-term {
      display: block;
    }

    .stage-panel {
      padding: 0.55rem;
    }

    .stage-key {
      position: static;
      max-width: none;
      margin-bottom: 0.5rem;
      border-radius: 12px;
      justify-content: center;
    }

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
