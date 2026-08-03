<script lang="ts">
  import type { CAPSegment, TrochoidFrame, TrochoidPoint } from "@caps/domain";

  let {
    trace,
    segmentTraces,
    segments,
    frame,
    junctions,
    progress,
    layer,
    notation,
    curveName,
  }: {
    trace: TrochoidPoint[];
    segmentTraces: TrochoidPoint[][];
    segments: CAPSegment[];
    frame: TrochoidFrame;
    junctions: TrochoidPoint[];
    progress: number;
    layer: "trace" | "assembly" | "mechanism";
    notation: string;
    curveName: string;
  } = $props();

  const VIEWBOX_SIZE = 700;
  const CENTER = VIEWBOX_SIZE / 2;
  const UNIT_SCALE = 118;
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
  const FRAGMENT_COLORS = ["#38bdf8", "#f472b6", "#fbbf24"];

  const tracePath = $derived(toSvgPath(trace));
  const segmentPaths = $derived(segmentTraces.map(toSvgPath));
  const shoulder = $derived(project(frame.shoulder));
  const hand = $derived(project(frame.hand));
  const tip = $derived(project(frame.tip));
  const armLabel = $derived(vectorLabel(shoulder, hand));
  const propLabel = $derived(vectorLabel(hand, tip));
  const activeSegment = $derived.by(() => {
    const frameWithSegment = frame as TrochoidFrame & { segmentIndex?: number };
    return segments[frameWithSegment.segmentIndex ?? 0] ?? segments[0]!;
  });
  const junctionPositions = $derived(junctions.map(project));
  const fragmentProgress = $derived.by(() => {
    const totalDuration = segments.reduce((sum, segment) => sum + segment.d, 0);
    const elapsed = progress * totalDuration;
    let cursor = 0;
    return segments.map((segment) => {
      const value = Math.min(1, Math.max(0, (elapsed - cursor) / segment.d));
      cursor += segment.d;
      return value;
    });
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
</script>

<div class="stage-panel">
  <div class="stage-shell">
    {#if layer === "assembly"}
      <div class="stage-key assembly-key" aria-hidden="true">
        <span style="--key-color: {FRAGMENT_COLORS[0]}"
          ><i></i>Fragment one</span
        >
        <span style="--key-color: {FRAGMENT_COLORS[1]}"
          ><i></i>Fragment two</span
        >
        <span><i class="join-dot"></i>Join</span>
      </div>
    {:else if layer === "mechanism"}
      <div class="stage-key" aria-hidden="true">
        <span class="origin-key"><i></i>O shoulder</span>
        <span class="hand-key"><i></i>M hand</span>
        <span class="tip-key"><i></i>E prop tip</span>
      </div>
    {/if}

    <svg
      class="model-stage"
      viewBox="0 0 {VIEWBOX_SIZE} {VIEWBOX_SIZE}"
      role="img"
      aria-label="{curveName}, {notation}. The prop tip E traces the curve. {layer ===
      'mechanism'
        ? 'The O, M, and E construction is visible.'
        : layer === 'assembly'
          ? 'The joined fragments are shown in separate colors.'
          : 'Only the trace and moving prop tip are shown.'}"
    >
      <defs>
        <radialGradient id="caps-stage-wash" cx="50%" cy="48%" r="64%">
          <stop offset="0%" stop-color="var(--construction-stage-center)" />
          <stop offset="100%" stop-color="var(--construction-stage-edge)" />
        </radialGradient>
        <linearGradient
          id="caps-trace-gradient"
          x1="8%"
          y1="12%"
          x2="92%"
          y2="88%"
        >
          <stop offset="0%" stop-color="var(--construction-trace-a)" />
          <stop offset="52%" stop-color="var(--construction-trace-b)" />
          <stop offset="100%" stop-color="var(--construction-trace-c)" />
        </linearGradient>
        <filter
          id="caps-trace-glow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge
            ><feMergeNode in="blur" /><feMergeNode
              in="SourceGraphic"
            /></feMerge
          >
        </filter>
        <filter
          id="caps-node-glow"
          x="-120%"
          y="-120%"
          width="340%"
          height="340%"
        >
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge
            ><feMergeNode in="blur" /><feMergeNode
              in="SourceGraphic"
            /></feMerge
          >
        </filter>
        <marker
          id="caps-arm-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--construction-arm)" />
        </marker>
        <marker
          id="caps-prop-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--construction-prop)" />
        </marker>
      </defs>

      <rect
        width={VIEWBOX_SIZE}
        height={VIEWBOX_SIZE}
        rx="34"
        fill="url(#caps-stage-wash)"
      />

      {#if layer === "mechanism"}
        <g class="coordinate-grid" aria-hidden="true">
          {#each RINGS as radius (radius)}<circle
              cx={CENTER}
              cy={CENTER}
              r={radius}
            />{/each}
          {#each SPOKES as spoke, index (index)}<line {...spoke} />{/each}
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
      {/if}

      {#if layer === "assembly"}
        {#each segmentPaths as path, index (index)}
          <path
            class="trace-ghost fragment"
            d={path}
            style="--fragment-color: {FRAGMENT_COLORS[index]}"
          />
          <path
            class="trace-drawn fragment"
            d={path}
            pathLength="1"
            stroke-dasharray="{Math.max(fragmentProgress[index] ?? 0, 0.001)} 1"
            style="--fragment-color: {FRAGMENT_COLORS[index]}"
            filter="url(#caps-trace-glow)"
          />
        {/each}
      {:else}
        <path class="trace-ghost" d={tracePath} />
        <path
          class="trace-drawn"
          d={tracePath}
          pathLength="1"
          stroke-dasharray="{Math.max(progress, 0.001)} 1"
          filter="url(#caps-trace-glow)"
        />
      {/if}

      {#if layer === "assembly" || layer === "mechanism"}
        {#each junctionPositions as junction, index (index)}
          <g
            class="junction-node"
            transform="translate({junction.x} {junction.y})"
            aria-hidden="true"
          >
            <circle r="13" />
            {#if layer === "mechanism"}<text x="17" y="5">join {index + 1}</text
              >{/if}
          </g>
        {/each}
      {/if}

      {#if layer === "mechanism"}
        <circle
          class="arm-orbit"
          cx={shoulder.x}
          cy={shoulder.y}
          r={activeSegment.rho1 * UNIT_SCALE}
        />
        <circle
          class="prop-orbit"
          cx={hand.x}
          cy={hand.y}
          r={activeSegment.rho2 * UNIT_SCALE}
        />
        <line
          class="arm-vector"
          x1={shoulder.x}
          y1={shoulder.y}
          x2={hand.x}
          y2={hand.y}
          marker-end="url(#caps-arm-arrow)"
        />
        <line
          class="prop-vector"
          x1={hand.x}
          y1={hand.y}
          x2={tip.x}
          y2={tip.y}
          marker-end="url(#caps-prop-arrow)"
        />

        <g
          class="vector-label"
          transform="translate({armLabel.x} {armLabel.y})"
        >
          <rect x="-19" y="-14" width="38" height="28" rx="12" /><text>ρ₁</text>
        </g>
        <g
          class="vector-label"
          transform="translate({propLabel.x} {propLabel.y})"
        >
          <rect x="-19" y="-14" width="38" height="28" rx="12" /><text>ρ₂</text>
        </g>

        <g
          class="point-node origin-node"
          transform="translate({shoulder.x} {shoulder.y})"
        >
          <circle class="node-halo" r="17" /><circle
            class="node-core"
            r="7"
          /><text x="16" y="-14">O</text>
        </g>
        <g
          class="point-node hand-node"
          transform="translate({hand.x} {hand.y})"
        >
          <circle class="node-halo" r="19" /><circle
            class="node-core"
            r="8"
          /><text x="17" y="-15">M</text>
        </g>
      {/if}

      <g class="point-node tip-node" transform="translate({tip.x} {tip.y})">
        <circle class="node-halo" r="23" filter="url(#caps-node-glow)" />
        <circle class="node-core" r="9" />
        <text x="18" y="-16">E</text>
      </g>
    </svg>
  </div>
</div>

<style>
  .stage-panel {
    display: grid;
    place-items: start center;
    min-width: 0;
    padding: clamp(0.65rem, 1.6cqi, 1.25rem);
    background: color-mix(
      in srgb,
      var(--construction-stage-edge) 62%,
      transparent
    );
  }

  .stage-shell {
    position: relative;
    inline-size: min(100%, 72dvh, 1040px);
    aspect-ratio: 1;
  }

  .stage-key {
    position: absolute;
    z-index: 2;
    top: clamp(0.8rem, 2cqi, 1.5rem);
    left: clamp(0.8rem, 2cqi, 1.5rem);
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem 0.8rem;
    max-width: calc(100% - 1.6rem);
    padding: 0.55rem 0.7rem;
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: 999px;
    background: rgb(6 10 18 / 0.74);
    backdrop-filter: blur(12px);
    color: #dbe6f2;
    font-size: clamp(0.7rem, 0.65rem + 0.22cqi, 0.82rem);
  }

  .stage-key span {
    display: inline-flex;
    align-items: center;
    gap: 0.34rem;
    color: var(--key-color, inherit);
    white-space: nowrap;
  }

  .stage-key i {
    width: 0.54rem;
    height: 0.54rem;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 10px currentColor;
  }

  .stage-key .join-dot {
    border: 2px solid currentColor;
    background: transparent;
  }

  .stage-key .origin-key {
    color: var(--construction-origin);
  }
  .stage-key .hand-key {
    color: var(--construction-hand);
  }
  .stage-key .tip-key {
    color: var(--construction-tip);
  }

  .model-stage {
    display: block;
    width: 100%;
    height: 100%;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: clamp(1rem, 1rem + 0.7cqi, 1.75rem);
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
    stroke: url(#caps-trace-gradient);
    stroke-width: 5;
    opacity: 0.24;
  }
  .trace-drawn {
    stroke: url(#caps-trace-gradient);
    stroke-width: 6;
  }
  .trace-ghost.fragment,
  .trace-drawn.fragment {
    stroke: var(--fragment-color);
  }

  .arm-orbit,
  .prop-orbit {
    stroke-width: 1.5;
    stroke-dasharray: 4 8;
  }
  .arm-orbit {
    stroke: color-mix(in srgb, var(--construction-arm) 43%, transparent);
  }
  .prop-orbit {
    stroke: color-mix(in srgb, var(--construction-prop) 50%, transparent);
  }
  .arm-vector,
  .prop-vector {
    stroke-width: 3;
  }
  .arm-vector {
    stroke: var(--construction-arm);
  }
  .prop-vector {
    stroke: var(--construction-prop);
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

  .point-node text,
  .junction-node text {
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
    fill: var(--construction-origin);
  }
  .hand-node .node-halo,
  .hand-node .node-core {
    fill: var(--construction-hand);
  }
  .tip-node .node-halo,
  .tip-node .node-core {
    fill: var(--construction-tip);
  }
  .junction-node circle {
    fill: rgb(5 9 16 / 0.78);
    stroke: #fbbf24;
    stroke-width: 3;
  }
  .junction-node text {
    font-size: 15px;
  }

  @container (max-width: 32rem) {
    .stage-key {
      position: static;
      max-width: none;
      margin-bottom: 0.5rem;
      border-radius: 0.75rem;
      justify-content: center;
    }
    .stage-shell {
      aspect-ratio: auto;
    }
    .model-stage {
      aspect-ratio: 1;
    }
  }
</style>
