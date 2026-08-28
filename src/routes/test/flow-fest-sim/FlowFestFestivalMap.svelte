<script lang="ts">
  import type {
    FlowFestBranchId,
    FlowFestRuntimeContract,
    FlowFestRuntimeZone,
  } from "../flow-fest-graybox/flow-fest-runtime-contract";
  import {
    createFlowFestMinimapModel,
    flowFestMapHeadingDegrees,
    FLOW_FEST_MAP_VIEWPORT,
    projectFlowFestWorldPoint,
  } from "./flow-fest-minimap";
  import type { FlowFestCampPlanLocation } from "./flow-fest-camp-plan";

  interface Props {
    contract: FlowFestRuntimeContract | null;
    branch: FlowFestBranchId;
    player: { x: number; z: number };
    headingRadians: number;
    targetZone: FlowFestRuntimeZone | null;
    targetDistance: number | null;
    currentArea: string;
    location: FlowFestCampPlanLocation | null;
  }

  let {
    contract,
    branch,
    player,
    headingRadians,
    targetZone,
    targetDistance,
    currentArea,
    location,
  }: Props = $props();

  const model = $derived(
    contract ? createFlowFestMinimapModel(contract, branch) : null
  );
  const playerPoint = $derived(
    model ? projectFlowFestWorldPoint(player, model.bounds) : null
  );
  const targetPoint = $derived(
    model && targetZone
      ? projectFlowFestWorldPoint(targetZone.center, model.bounds)
      : null
  );
  const headingDegrees = $derived(flowFestMapHeadingDegrees(headingRadians));
  const areaLabel = $derived(
    location?.label ??
      (currentArea === "loading"
        ? "Locating you"
        : currentArea === "transit"
          ? "Between landmarks"
          : currentArea.replaceAll("-", " "))
  );
  const targetLabel = $derived(
    targetZone?.label.replace(": no camping", "") ?? "Free explore"
  );
</script>

<section class="festival-map" aria-label="Whole campground map">
  <header>
    <div class="map-title">
      <span>Whole campground</span>
      <strong>{areaLabel}</strong>
    </div>
    <div class="north" aria-label="Map is fixed north-up">
      <i aria-hidden="true"></i>
      <span>N</span>
    </div>
  </header>

  <div class="map-frame">
    <svg
      viewBox={`0 0 ${FLOW_FEST_MAP_VIEWPORT.width} ${FLOW_FEST_MAP_VIEWPORT.height}`}
      role="img"
      aria-label="North-up campground map with the official public road, interpreted private drives, Austen-traced foot connectors, clearings, entrances, parking, the south cornfield, your position and facing, and the current destination"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="flow-fest-map-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#132019"></stop>
          <stop offset="1" stop-color="#1d3023"></stop>
        </linearGradient>
        <filter
          id="flow-fest-map-player-glow"
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>
          <feMerge>
            <feMergeNode in="blur"></feMergeNode>
            <feMergeNode in="SourceGraphic"></feMergeNode>
          </feMerge>
        </filter>
      </defs>

      <rect class="map-ground" width="640" height="340" rx="18"></rect>

      {#if model}
        <g class="reference-regions" aria-hidden="true">
          {#each model.regions as region}
            {#if region.shape === "ellipse" && region.point && region.radiusX && region.radiusY}
              <ellipse
                class:woodland={region.kind === "woodland"}
                class:clearing={region.kind === "clearing"}
                class:parking-field={region.kind === "parking-field"}
                cx={region.point.x}
                cy={region.point.y}
                rx={region.radiusX}
                ry={region.radiusY}
              ></ellipse>
            {:else if region.polygon}
              <polygon
                class:crop-field={region.kind === "crop-field"}
                points={region.polygon}
              ></polygon>
            {/if}
          {/each}
        </g>

        <g class="zone-footprints" aria-hidden="true">
          {#each model.zones as zone}
            <ellipse
              class:selected={zone.selected}
              class:middle={zone.id === "middle-earth-zone"}
              class:parking={zone.id === "west-upper-parking-zone"}
              cx={zone.point.x}
              cy={zone.point.y}
              rx={zone.radiusX}
              ry={zone.radiusY}
            ></ellipse>
          {/each}
        </g>

        <g class="public-roads" aria-hidden="true">
          {#each model.publicRoadPolylines as points}
            <polyline class="road-casing" {points}></polyline>
            <polyline class="road-center" {points}></polyline>
          {/each}
          <text
            x={model.publicRoadLabelPoint.x}
            y={model.publicRoadLabelPoint.y - 9}>Camden College Corner Rd</text
          >
        </g>

        <g class="internal-drives" aria-hidden="true">
          {#each model.internalDrivePolylines as points}
            <polyline {points}></polyline>
          {/each}
        </g>

        <g class="connector-lines" aria-hidden="true">
          {#each model.connectorPolylines as points}
            <polyline {points}></polyline>
          {/each}
        </g>

        {#if playerPoint && targetPoint}
          <circle
            class="target-ring"
            cx={targetPoint.x}
            cy={targetPoint.y}
            r="14"
          ></circle>
        {/if}

        <g class="landmarks">
          {#each model.landmarks as landmark}
            <g
              class:camp={landmark.kind === "camp"}
              class:gate={landmark.kind === "check-in"}
              class:entrance={landmark.kind === "entrance" ||
                landmark.kind === "parking-gate"}
              class:parking={landmark.kind === "parking"}
              class:crop={landmark.kind === "crop-field"}
              class:secondary={landmark.kind === "buildings" ||
                landmark.kind === "clearing"}
              transform={`translate(${landmark.point.x} ${landmark.point.y})`}
            >
              <circle r="6"></circle>
              <text x="11" y="4">{landmark.label}</text>
            </g>
          {/each}
        </g>

        {#if playerPoint}
          <circle
            class="player-position-ring"
            cx={playerPoint.x}
            cy={playerPoint.y}
            r="13"
          ></circle>
          <g
            class="player-marker"
            filter="url(#flow-fest-map-player-glow)"
            transform={`translate(${playerPoint.x} ${playerPoint.y}) rotate(${headingDegrees})`}
          >
            <polygon points="0,-15 8,10 0,6 -8,10"></polygon>
          </g>
          <text class="you-label" x={playerPoint.x + 14} y={playerPoint.y - 13}
            >YOU</text
          >
        {/if}

        <g class="scale-bar" transform="translate(28 310)" aria-hidden="true">
          <path
            d={`M0 0 V-5 M0 0 H${model.scaleBarPixels} M${model.scaleBarPixels} 0 V-5`}
          ></path>
          <text x={model.scaleBarPixels / 2} y="16">100 m</text>
        </g>
      {/if}
    </svg>
  </div>

  <footer>
    <div class="target-copy">
      <span>Destination</span>
      <strong>{targetLabel}</strong>
    </div>
    {#if targetZone && targetDistance !== null}
      <strong class="target-distance">{Math.round(targetDistance)} m</strong>
    {/if}
  </footer>
  <p class="map-source">
    ODOT road · 2023 public-domain NAIP · Austen's traces
  </p>
</section>

<style>
  .festival-map {
    container-type: inline-size;
    display: grid;
    gap: 0.55rem;
    inline-size: var(--festival-map-width, clamp(22rem, 25vw, 29rem));
    padding: 0.78rem;
    border: 1px solid var(--sim-stroke);
    border-radius: 1rem;
    color: var(--sim-text);
    background: var(--sim-panel-strong);
    box-shadow: 0 1.2rem 3rem rgba(2, 7, 4, 0.28);
    pointer-events: none;
  }

  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .map-title {
    display: grid;
    min-inline-size: 0;
  }

  .map-title span,
  footer span {
    color: var(--sim-muted);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .map-title strong {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 760;
    text-transform: capitalize;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .north {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--sim-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 850;
  }

  .north i {
    inline-size: 0;
    block-size: 0;
    border-inline: 0.28rem solid transparent;
    border-block-end: 0.65rem solid var(--sim-accent);
  }

  .map-frame {
    aspect-ratio: 640 / 340;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.7rem;
    background: #132019;
  }

  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }

  .map-ground {
    fill: url(#flow-fest-map-ground);
  }

  .reference-regions ellipse,
  .reference-regions polygon {
    vector-effect: non-scaling-stroke;
  }

  .reference-regions .woodland {
    fill: rgba(8, 19, 12, 0.4);
    stroke: rgba(95, 137, 92, 0.18);
    stroke-width: 1;
  }

  .reference-regions .clearing {
    fill: rgba(166, 190, 129, 0.08);
    stroke: rgba(190, 215, 148, 0.24);
    stroke-width: 1.2;
  }

  .reference-regions .parking-field {
    fill: rgba(138, 167, 187, 0.1);
    stroke: rgba(178, 205, 220, 0.24);
    stroke-width: 1.2;
  }

  .reference-regions .crop-field {
    fill: rgba(181, 153, 78, 0.14);
    stroke: rgba(221, 190, 104, 0.34);
    stroke-width: 1.2;
  }

  .zone-footprints ellipse {
    fill: rgba(196, 229, 140, 0.05);
    stroke: rgba(196, 229, 140, 0.22);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .zone-footprints ellipse.middle {
    fill: rgba(255, 180, 95, 0.07);
    stroke: rgba(255, 180, 95, 0.34);
  }

  .zone-footprints ellipse.parking {
    fill: rgba(188, 209, 221, 0.08);
    stroke: rgba(188, 209, 221, 0.3);
  }

  .zone-footprints ellipse.selected {
    fill: rgba(103, 207, 171, 0.13);
    stroke: var(--sim-mint);
    stroke-width: 2;
  }

  .public-roads polyline,
  .internal-drives polyline,
  .connector-lines polyline {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .public-roads .road-casing {
    stroke: rgba(8, 12, 10, 0.88);
    stroke-width: 9;
  }

  .public-roads .road-center {
    stroke: #c8c5b8;
    stroke-width: 5.5;
  }

  .public-roads text {
    fill: #e3e0d4;
    font:
      720 11px/1 Inter,
      ui-sans-serif,
      system-ui,
      sans-serif;
    letter-spacing: 0.03em;
    paint-order: stroke;
    stroke: rgba(12, 18, 15, 0.95);
    stroke-width: 4px;
  }

  .internal-drives polyline {
    stroke: rgba(208, 206, 188, 0.52);
    stroke-width: 3.2;
  }

  .connector-lines polyline {
    stroke: var(--sim-mint);
    stroke-width: 3;
    stroke-dasharray: 7 5;
  }

  .target-ring {
    fill: rgba(255, 180, 95, 0.12);
    stroke: var(--sim-accent);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .landmarks circle {
    fill: #dce6cf;
    stroke: #132019;
    stroke-width: 2.5;
    vector-effect: non-scaling-stroke;
  }

  .landmarks .camp circle {
    fill: var(--sim-mint);
  }

  .landmarks .gate circle {
    fill: var(--sim-accent);
  }

  .landmarks .entrance circle {
    fill: #efb969;
  }

  .landmarks .parking circle {
    fill: #9fc6dd;
  }

  .landmarks .crop circle {
    fill: #d5ba70;
  }

  .landmarks .secondary circle {
    r: 4px;
    fill: rgba(226, 234, 215, 0.72);
  }

  .landmarks text,
  .you-label {
    fill: #f4f6e9;
    font:
      760 12px/1 Inter,
      ui-sans-serif,
      system-ui,
      sans-serif;
    paint-order: stroke;
    stroke: rgba(12, 18, 15, 0.96);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .player-position-ring {
    fill: rgba(255, 255, 255, 0.08);
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .player-marker polygon {
    fill: #ffffff;
    stroke: #15251b;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .you-label {
    fill: #ffffff;
    font-size: 11px;
    letter-spacing: 0.08em;
  }

  .scale-bar path {
    fill: none;
    stroke: rgba(244, 246, 233, 0.75);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .scale-bar text {
    fill: rgba(244, 246, 233, 0.78);
    font:
      700 10px/1 Inter,
      ui-sans-serif,
      system-ui,
      sans-serif;
    text-anchor: middle;
  }

  footer {
    min-block-size: 1.55rem;
  }

  .target-copy {
    display: grid;
    min-inline-size: 0;
  }

  .target-copy strong {
    overflow: hidden;
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .target-distance {
    flex: none;
    color: var(--sim-accent);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .map-source {
    margin: -0.15rem 0 0;
    color: color-mix(in srgb, var(--sim-muted) 78%, transparent);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.2;
  }

  @container (max-width: 22rem) {
    .festival-map {
      gap: 0.35rem;
      padding: 0.55rem;
    }

    .map-title strong,
    footer,
    .target-distance {
      font-size: var(--font-size-compact, 0.75rem);
    }

    .landmarks text {
      font-size: 11px;
    }

    .landmarks .secondary text {
      display: none;
    }

    .map-source {
      display: none;
    }
  }
</style>
