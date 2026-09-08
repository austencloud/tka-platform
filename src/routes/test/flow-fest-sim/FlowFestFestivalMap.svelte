<script lang="ts">
  import type {
    FlowFestBranchId,
    FlowFestRuntimeContract,
    FlowFestRuntimeZone,
  } from "../flow-fest-graybox/flow-fest-runtime-contract";
  import { createFlowFestCampPlan } from "./flow-fest-camp-plan";
  import {
    createFlowFestMinimapModel,
    flowFestMapHeadingDegrees,
    FLOW_FEST_MAP_VIEWPORT,
    projectFlowFestWorldPoint,
    type FlowFestMapPoint,
    type FlowFestMapViewport,
  } from "./flow-fest-minimap";

  interface Props {
    contract: FlowFestRuntimeContract | null;
    branch: FlowFestBranchId;
    player: { x: number; z: number };
    headingRadians: number;
    targetZone: FlowFestRuntimeZone | null;
    targetDistance: number | null;
  }

  let {
    contract,
    branch,
    player,
    headingRadians,
    targetZone,
    targetDistance,
  }: Props = $props();

  /**
   * How much ground each step shows, in metres across the frame. `null` is the
   * whole site. The default is a near step: a minimap exists to say what is
   * around you, and the whole 550 m site answers a different question that the
   * guide's survey view already answers better.
   */
  const ZOOM_STEPS = [
    { id: "site", metresAcross: null },
    { id: "wide", metresAcross: 320 },
    { id: "near", metresAcross: 160 },
    { id: "close", metresAcross: 80 },
  ] as const;
  const DEFAULT_ZOOM_INDEX = 2;

  /** Landmarks worth naming even when the whole site is in frame. */
  const MAJOR_LANDMARK_KINDS = new Set<string>([
    "camp",
    "check-in",
    "entrance",
    "parking-gate",
  ]);

  /**
   * Minimum separation between two labels, as a percentage of the frame. Two
   * landmarks closer than this print one label and two dots rather than a pile
   * of overlapping words.
   */
  const ZOOM_CHIP_PX = 28;
  /*
   * Enough to place a label's box without measuring it: the frame paints chrome
   * over the map, and a place name that lands under the zoom column or the
   * scale bar reads as a clipped word rather than a label.
   */
  const LABEL_LEAD_PX = 11;
  const LABEL_CHAR_PX = 6.4;
  const SCALE_STRIP_PX = 24;
  const LABEL_GAP_X = 24;
  const LABEL_GAP_Y = 8;

  const SCALE_BAR_CANDIDATES = [10, 20, 25, 50, 100, 200, 250, 500, 1000];

  let zoomIndex = $state(DEFAULT_ZOOM_INDEX);

  /*
   * The shared viewport normalises world x and z independently, which stretches
   * this site 21% east-west. A minimap whose whole job is "where am I relative
   * to that" cannot distort bearings, so the projection gets a viewport shaped
   * like the world: one scale on both axes, and a frame aspect to match.
   */
  const viewport = $derived.by<FlowFestMapViewport>(() => {
    if (!contract) return FLOW_FEST_MAP_VIEWPORT;
    const bounds = createFlowFestCampPlan(contract, branch).bounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldDepth = bounds.maxZ - bounds.minZ;
    const { width, padding } = FLOW_FEST_MAP_VIEWPORT;
    if (worldWidth <= 0 || worldDepth <= 0) return FLOW_FEST_MAP_VIEWPORT;
    const unitsPerMetre = (width - padding * 2) / worldWidth;
    return { width, height: unitsPerMetre * worldDepth + padding * 2, padding };
  });

  const model = $derived(
    contract ? createFlowFestMinimapModel(contract, branch, viewport) : null
  );

  /** Projected units per metre, identical on both axes by construction. */
  const unitsPerMetre = $derived(
    model
      ? (viewport.width - viewport.padding * 2) /
        Math.max(1e-6, model.bounds.maxX - model.bounds.minX)
      : 0
  );

  const frameAspect = $derived(viewport.width / viewport.height);

  let frameWidthPx = $state(0);
  let frameHeightPx = $state(0);


  const playerPoint = $derived(
    model ? projectFlowFestWorldPoint(player, model.bounds, viewport) : null
  );
  const targetPoint = $derived(
    model && targetZone
      ? projectFlowFestWorldPoint(targetZone.center, model.bounds, viewport)
      : null
  );
  const headingDegrees = $derived(flowFestMapHeadingDegrees(headingRadians));

  const view = $derived.by(() => {
    const wholeSite = {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    };
    const step = ZOOM_STEPS[zoomIndex];
    if (!step?.metresAcross || !playerPoint || unitsPerMetre <= 0) {
      return wholeSite;
    }
    const width = step.metresAcross * unitsPerMetre;
    const height = width / frameAspect;
    if (width >= viewport.width) return wholeSite;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return {
      x:
        Math.min(
          Math.max(playerPoint.x, halfWidth),
          viewport.width - halfWidth
        ) - halfWidth,
      y:
        Math.min(
          Math.max(playerPoint.y, halfHeight),
          viewport.height - halfHeight
        ) - halfHeight,
      width,
      height,
    };
  });

  const viewBox = $derived(
    [view.x, view.y, view.width, view.height]
      .map((value) => value.toFixed(2))
      .join(" ")
  );

  /** Percentage of the frame, so an HTML marker lands on its SVG geometry. */
  function framePercent(point: FlowFestMapPoint): {
    left: number;
    top: number;
  } {
    return {
      left: ((point.x - view.x) / view.width) * 100,
      top: ((point.y - view.y) / view.height) * 100,
    };
  }

  function inView(point: FlowFestMapPoint): boolean {
    return (
      point.x >= view.x &&
      point.x <= view.x + view.width &&
      point.y >= view.y &&
      point.y <= view.y + view.height
    );
  }

  const visibleLandmarks = $derived.by(() => {
    const placed: Array<{ left: number; top: number }> = [];
    return (model?.landmarks ?? [])
      .filter((landmark) => inView(landmark.point))
      .map((landmark) => ({
        ...landmark,
        placement: framePercent(landmark.point),
        distance: playerPoint
          ? Math.hypot(
              landmark.point.x - playerPoint.x,
              landmark.point.y - playerPoint.y
            )
          : 0,
      }))
      // Nearest first, so the labels that survive decluttering are the ones
      // describing where the player actually is.
      .sort((a, b) => a.distance - b.distance)
      .map((landmark) => {
        const eligible =
          zoomIndex >= 2 || MAJOR_LANDMARK_KINDS.has(landmark.kind);
        const collides = placed.some(
          (other) =>
            Math.abs(other.left - landmark.placement.left) < LABEL_GAP_X &&
            Math.abs(other.top - landmark.placement.top) < LABEL_GAP_Y
        );
        const anchorX = (landmark.placement.left / 100) * frameWidthPx;
        const anchorY = (landmark.placement.top / 100) * frameHeightPx;
        const labelPx = LABEL_LEAD_PX + landmark.label.length * LABEL_CHAR_PX;
        const flipped = landmark.placement.left > 62;
        const labelStart = flipped ? anchorX - labelPx : anchorX;
        const labelEnd = labelStart + labelPx;
        const fits =
          frameWidthPx <= 0 ||
          (labelStart >= 0 &&
            labelEnd <= frameWidthPx &&
            anchorY < frameHeightPx - SCALE_STRIP_PX &&
            !(
              labelEnd > frameWidthPx - (ZOOM_CHIP_PX + 11) &&
              anchorY > frameHeightPx - (ZOOM_CHIP_PX * 2 + 14)
            ));
        const named = eligible && !collides && fits;
        if (named) placed.push(landmark.placement);
        // A label near the right edge is drawn on the other side of its dot so
        // the frame clips the map rather than the place name.
        return { ...landmark, named, flipped };
      });
  });

  const playerPlacement = $derived(
    playerPoint ? framePercent(playerPoint) : null
  );

  /**
   * The destination as a marker rather than a sentence. In frame it is a ring
   * on the map; out of frame it becomes a chevron pinned to the edge you would
   * travel toward, which is the one thing a repeated text label cannot tell you.
   */
  const destination = $derived.by(() => {
    if (!targetPoint || !playerPoint) return null;
    if (inView(targetPoint)) {
      return {
        offscreen: false,
        placement: framePercent(targetPoint),
        angle: 0,
      };
    }
    const raw = framePercent(targetPoint);
    const from = framePercent(playerPoint);
    return {
      offscreen: true,
      placement: {
        left: Math.min(Math.max(raw.left, 8), 92),
        top: Math.min(Math.max(raw.top, 10), 90),
      },
      angle:
        (Math.atan2(raw.top - from.top, raw.left - from.left) * 180) / Math.PI +
        90,
    };
  });

  const scaleBar = $derived.by(() => {
    if (unitsPerMetre <= 0) return null;
    const metresAcross = view.width / unitsPerMetre;
    const metres =
      [...SCALE_BAR_CANDIDATES]
        .reverse()
        .find((candidate) => candidate / metresAcross <= 0.34) ??
      SCALE_BAR_CANDIDATES[0]!;
    return { metres, widthPercent: (metres / metresAcross) * 100 };
  });

  const canZoomOut = $derived(zoomIndex > 0);
  const canZoomIn = $derived(zoomIndex < ZOOM_STEPS.length - 1);
</script>

<section class="festival-map" aria-label="Campground minimap">
  <div
    class="map-frame"
    style:aspect-ratio={frameAspect}
    bind:clientWidth={frameWidthPx}
    bind:clientHeight={frameHeightPx}
  >
    <svg
      {viewBox}
      role="img"
      aria-label="North-up minimap centred on you, showing the public road, private drives, foot connectors, clearings, parking and your destination"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="flow-fest-map-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#132019"></stop>
          <stop offset="1" stop-color="#1d3023"></stop>
        </linearGradient>
      </defs>

      <rect
        class="map-ground"
        width={viewport.width}
        height={viewport.height}
      ></rect>

      {#if model}
        <g class="reference-regions" aria-hidden="true">
          {#each model.regions as region (region.id)}
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
          {#each model.zones as zone (zone.id)}
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
          {#each model.publicRoadPolylines as points, index (index)}
            <polyline class="road-casing" {points}></polyline>
            <polyline class="road-center" {points}></polyline>
          {/each}
        </g>

        <g class="internal-drives" aria-hidden="true">
          {#each model.internalDrivePolylines as points, index (index)}
            <polyline {points}></polyline>
          {/each}
        </g>

        <g class="connector-lines" aria-hidden="true">
          {#each model.connectorPolylines as points, index (index)}
            <polyline {points}></polyline>
          {/each}
        </g>
      {/if}
    </svg>

    <div class="markers" aria-hidden="true">
      {#each visibleLandmarks as landmark (landmark.id)}
        <span
          class="landmark {landmark.kind}"
          class:named={landmark.named}
          class:flipped={landmark.named && landmark.flipped}
          style:left={`${landmark.placement.left}%`}
          style:top={`${landmark.placement.top}%`}
        >
          <i></i>
          {#if landmark.named}<b>{landmark.label}</b>{/if}
        </span>
      {/each}

      {#if destination}
        <span
          class="destination"
          class:offscreen={destination.offscreen}
          style:left={`${destination.placement.left}%`}
          style:top={`${destination.placement.top}%`}
          style:rotate={destination.offscreen
            ? `${destination.angle}deg`
            : null}
        ></span>
      {/if}

      {#if playerPlacement}
        <span
          class="player"
          style:left={`${playerPlacement.left}%`}
          style:top={`${playerPlacement.top}%`}
        >
          <i style:rotate={`${headingDegrees}deg`}></i>
        </span>
      {/if}
    </div>

    <div class="north" aria-label="Map is fixed north-up">
      <i aria-hidden="true"></i>N
    </div>

    {#if scaleBar}
      <div class="scale" aria-hidden="true">
        <span style:inline-size={`${scaleBar.widthPercent}%`}></span>
        <b>{scaleBar.metres} m</b>
      </div>
    {/if}

    {#if targetZone && targetDistance !== null}
      <p
        class="range"
        aria-label={`Destination ${Math.round(targetDistance)} metres away`}
      >
        {Math.round(targetDistance)} m
      </p>
    {/if}

    <div class="zoom">
      <button
        type="button"
        aria-label="Zoom in"
        disabled={!canZoomIn}
        onclick={() =>
          (zoomIndex = Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1))}
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        disabled={!canZoomOut}
        onclick={() => (zoomIndex = Math.max(0, zoomIndex - 1))}
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</section>

<style>
  .festival-map {
    inline-size: var(--festival-map-width, 21rem);
    pointer-events: none;
  }

  .map-frame {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--sim-stroke);
    border-radius: 0.75rem;
    background: #132019;
    box-shadow: 0 0.9rem 2.4rem rgba(2, 7, 4, 0.32);
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
  .reference-regions polygon,
  .zone-footprints ellipse,
  .public-roads polyline,
  .internal-drives polyline,
  .connector-lines polyline {
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
  }

  .public-roads .road-casing {
    stroke: rgba(8, 12, 10, 0.88);
    stroke-width: 7;
  }

  .public-roads .road-center {
    stroke: #c8c5b8;
    stroke-width: 4;
  }

  .internal-drives polyline {
    stroke: rgba(208, 206, 188, 0.52);
    stroke-width: 2.4;
  }

  .connector-lines polyline {
    stroke: var(--sim-mint);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }

  /*
   * Every marker is HTML positioned as a percentage of the frame rather than
   * SVG geometry, so zooming changes how much ground is in frame without
   * changing how large a dot or a label is drawn.
   */
  .markers {
    position: absolute;
    inset: 0;
  }

  .markers > * {
    position: absolute;
    translate: -50% -50%;
  }

  .landmark {
    display: flex;
    align-items: center;
    gap: 0.26rem;
    white-space: nowrap;
  }

  .landmark.named {
    translate: -0.32rem -50%;
  }

  .landmark.named.flipped {
    flex-direction: row-reverse;
    translate: calc(-100% + 0.32rem) -50%;
  }

  .landmark i {
    flex: 0 0 auto;
    inline-size: 0.44rem;
    block-size: 0.44rem;
    border: 1px solid rgba(12, 18, 15, 0.9);
    border-radius: 50%;
    background: #dce6cf;
  }

  .landmark.camp i {
    background: var(--sim-mint);
  }

  .landmark.check-in i {
    background: var(--sim-accent);
  }

  .landmark.entrance i,
  .landmark.parking-gate i {
    background: #efb969;
  }

  .landmark.parking i {
    background: #9fc6dd;
  }

  .landmark.crop-field i {
    background: #d5ba70;
  }

  .landmark.buildings i,
  .landmark.clearing i {
    inline-size: 0.3rem;
    block-size: 0.3rem;
    background: rgba(226, 234, 215, 0.7);
  }

  .landmark b {
    color: #f4f7ea;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 660;
    letter-spacing: 0.005em;
    text-shadow:
      0 0 0.2rem rgba(9, 14, 11, 0.98),
      0 0 0.45rem rgba(9, 14, 11, 0.92);
  }

  .destination {
    inline-size: 0.9rem;
    block-size: 0.9rem;
    border: 0.12rem solid var(--sim-accent);
    border-radius: 50%;
    background: rgba(255, 180, 95, 0.18);
  }

  .destination.offscreen {
    inline-size: 0;
    block-size: 0;
    border: 0;
    border-inline: 0.42rem solid transparent;
    border-block-end: 0.72rem solid var(--sim-accent);
    border-radius: 0;
    background: none;
    filter: drop-shadow(0 0 0.2rem rgba(9, 14, 11, 0.9));
  }

  /*
   * A dark disc under the arrow so the player reads at a glance against pale
   * roads and dark woodland alike.
   */
  .player {
    display: grid;
    place-items: center;
    inline-size: 1.15rem;
    block-size: 1.15rem;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 50%;
    background: rgba(9, 14, 11, 0.82);
  }

  .player i {
    inline-size: 0;
    block-size: 0;
    border-inline: 0.26rem solid transparent;
    border-block-end: 0.58rem solid #ffffff;
    translate: 0 -0.06rem;
  }

  .north,
  .scale,
  .range,
  .zoom {
    position: absolute;
    color: #eef1e2;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-shadow: 0 0 0.28rem rgba(9, 14, 11, 0.95);
  }

  .north {
    inset-block-start: 0.32rem;
    inset-inline-start: 0.42rem;
    display: flex;
    align-items: center;
    gap: 0.24rem;
    color: var(--sim-accent);
  }

  .north i {
    inline-size: 0;
    block-size: 0;
    border-inline: 0.22rem solid transparent;
    border-block-end: 0.5rem solid var(--sim-accent);
  }

  .scale {
    inset-block-end: 0.32rem;
    inset-inline-start: 0.42rem;
    display: flex;
    align-items: center;
    gap: 0.32rem;
    inline-size: calc(100% - 3.1rem);
  }

  .scale span {
    block-size: 0.34rem;
    border: 1px solid rgba(240, 244, 230, 0.85);
    border-block-start: 0;
  }

  .scale b {
    font-weight: 640;
    font-variant-numeric: tabular-nums;
  }

  .range {
    inset-block-start: 0.32rem;
    inset-inline-end: 0.42rem;
    margin: 0;
    color: var(--sim-mint);
    font-variant-numeric: tabular-nums;
  }

  .zoom {
    inset-block-end: 0.3rem;
    inset-inline-end: 0.3rem;
    display: grid;
    gap: 0.2rem;
    pointer-events: auto;
  }

  .zoom button {
    position: relative;
    display: grid;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    min-inline-size: 0;
    min-block-size: 0;
    padding: 0;
    border: 1px solid rgba(240, 244, 230, 0.26);
    border-radius: 0.4rem;
    color: #eef1e2;
    background: rgba(10, 16, 12, 0.72);
    font-size: var(--font-size-compact, 0.75rem);
    cursor: pointer;
  }

  /*
   * The visible chip stays small so it does not cover the ground it sits on,
   * while the hit area meets the touch-target floor by extending past it.
   */
  .zoom button::after {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inline-size: var(--min-touch-target);
    block-size: var(--min-touch-target);
    translate: -50% -50%;
    content: "";
  }

  .zoom button:hover:not(:disabled),
  .zoom button:focus-visible {
    border-color: var(--sim-accent);
    color: var(--sim-accent);
    outline: none;
  }

  .zoom button:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
