<!--
  The live stage integrates phase instead of evaluating position.

  The closed-path stage computes `angle = rate * u`, which is exact and right
  for a fixed ratio, and useless the moment the ratio can change: raising the
  rate would teleport the prop to wherever the new formula says it belongs at
  the current time. Here each hand carries its own accumulated angle and the
  ratio only sets how fast that angle grows, so retuning mid-flight changes the
  RATE and never the position. That is what happens when a spinner speeds a
  prop up, and it is the only version of this that survives being scrubbed
  while it plays.

  What that costs is the orientation. Land on a detent after scrubbing and the
  canonical shape draws at whatever orientation the hands happened to be in:
  same flower, rotated, and the first quarter of the trail still walking the
  old rate. Whether to keep that belongs to the caller, which is what
  `alignToken` is for. Theory bumps it on every settled ratio, so the shape on
  the canvas is always the one its tile drew.

  The trail keeps exactly one of the hand's own closed paths, and measures it
  in hand cycles rather than seconds. A wall clock cannot do that job: the same
  fourteen seconds is a whole 1:2 flower and three fifths of a 1:9 one, and it
  becomes a different fraction again on a 144Hz display. Counting cycles makes
  the window the same slice of the figure everywhere.

  Canvas rather than SVG: the trail is a live ring buffer redrawn every frame
  with a per-segment fade, which is thousands of DOM attribute writes a second
  as SVG and a few hundred cheap strokes as canvas.
-->
<script module lang="ts">
  export interface LiveHand {
    id: string;
    /** Prop rotations per hand cycle. */
    rate: number;
    /** +1 pro (prop turns with the hand), -1 anti. */
    spinSign: 1 | -1;
    /** Hand radius in prop lengths. Zero parks the hand at the origin. */
    radius: number;
    color: string;
    /** Compass eighths the hand starts at, so two hands can be offset. */
    handPhase: number;
    /**
     * Which way the hand travels: +1 clockwise, -1 counter. This is the
     * direction half of a VTG mode, and no amount of phase can express it.
     */
    handSign?: 1 | -1;
    /**
     * Prop offset from the hand's own bearing, in eighths. Zero points the
     * prop out along the hand; 4 points it back in.
     */
    propPhase?: number;
    /**
     * Hand cycles this hand takes to return to its start — the denominator of
     * its ratio. The trail keeps exactly this much, so what is drawn is the
     * whole closed path and nothing older.
     */
    trailCycles: number;
    /**
     * The whole closed path, in stage units, drawn under the animation from
     * the first frame. Null while the rate sits between two ratios, where
     * there is no closed path to show.
     */
    guide?: ReadonlyArray<{ x: number; y: number }> | null;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { angleOf, PROP_LENGTH } from "$lib/shared/notation/qft/qft-model";
  import { ENGINE_GRID_RADIUS } from "$lib/shared/mandala/domain/mandala-constants";
  import { MANDALA_GUIDE_FLOOR_OPACITY } from "$lib/shared/mandala/domain/mandala-overlay-types";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  interface Props {
    hands: LiveHand[];
    /** Milliseconds for one hand circle. */
    handPeriod?: number;
    paused?: boolean;
    /** Bumping this returns every accumulated phase to its start. */
    alignToken?: number;
    /** Prop reach in hand-orbit radii, so the stick matches the real prop. */
    propReach?: number;
  }

  let {
    hands,
    handPeriod = 2600,
    paused = false,
    alignToken = 0,
    propReach = PROP_LENGTH,
  }: Props = $props();

  const VIEW = 2.45;

  /*
   * The pictograph grid, at the scale the hands are already drawn at.
   *
   * One stage unit is one hand-orbit radius, and the engine puts a hand point
   * at ENGINE_GRID_RADIUS inside a 950-unit box. That fixes the grid square
   * against the canvas exactly, with nothing measured: the two agree because
   * they are the same number, not because a layout pass made them agree.
   * Container units rather than JS, so it is right in the frame the canvas is
   * first sized in.
   */
  const GRID_VIEWBOX = 950;
  const GRID_SPAN = GRID_VIEWBOX / ENGINE_GRID_RADIUS / (VIEW * 2);
  const TRAIL_CAPACITY = 1100;
  const TRAIL_BUCKETS = 26;
  /*
   * Points spent on one closed path. Sampling per closure rather than per
   * frame is what keeps a nine-cycle flower inside the ring: a 144Hz display
   * would otherwise store two and a half times as many points for the same
   * shape and start dropping its own tail.
   */
  const TRAIL_SAMPLES = 900;

  interface HandRuntime {
    handAngle: number;
    propAngle: number;
    /** Hand cycles since the last restart. The trail ages against this. */
    cycles: number;
    /** x, y, and the cycle count the point was drawn at. */
    trail: Float32Array;
    head: number;
    length: number;
    lastSample: number;
  }

  let canvas = $state<HTMLCanvasElement | null>(null);
  const runtimes = new Map<string, HandRuntime>();

  function runtimeFor(hand: LiveHand): HandRuntime {
    let runtime = runtimes.get(hand.id);
    if (!runtime) {
      runtime = {
        handAngle: angleOf(hand.handPhase),
        propAngle: angleOf(hand.handPhase + (hand.propPhase ?? 0)),
        cycles: 0,
        trail: new Float32Array(TRAIL_CAPACITY * 3),
        head: 0,
        length: 0,
        lastSample: 0,
      };
      runtimes.set(hand.id, runtime);
    }
    return runtime;
  }

  function resetRuntime(hand: LiveHand, runtime: HandRuntime): void {
    runtime.handAngle = angleOf(hand.handPhase);
    runtime.propAngle = angleOf(hand.handPhase + (hand.propPhase ?? 0));
    runtime.cycles = 0;
    runtime.head = 0;
    runtime.length = 0;
    runtime.lastSample = 0;
  }

  /*
   * Canvas cannot read CSS custom properties. Handing `strokeStyle` a
   * `var(--dm-motion-blue, ...)` string is not an error either: the assignment
   * is silently ignored and the previous colour stays, which is how both hands
   * drew white. The values are theme-scoped, so resolve them at runtime rather
   * than hardcoding hexes, and re-read on a slow cadence so a theme change
   * reaches the canvas without a style read every frame.
   */
  const VAR_PATTERN = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^]*?)\s*)?\)$/;
  const colorCache = new Map<string, string>();
  let colorsResolvedAt = 0;

  function resolveColor(element: HTMLElement, color: string): string {
    const cached = colorCache.get(color);
    if (cached) return cached;
    const match = VAR_PATTERN.exec(color.trim());
    if (!match) {
      colorCache.set(color, color);
      return color;
    }
    const declared = getComputedStyle(element).getPropertyValue(match[1]).trim();
    const resolved = declared || match[2]?.trim() || "#ffffff";
    colorCache.set(color, resolved);
    return resolved;
  }

  function pushPoint(runtime: HandRuntime, x: number, y: number): void {
    runtime.trail[runtime.head * 3] = x;
    runtime.trail[runtime.head * 3 + 1] = y;
    runtime.trail[runtime.head * 3 + 2] = runtime.cycles;
    runtime.head = (runtime.head + 1) % TRAIL_CAPACITY;
    runtime.length = Math.min(runtime.length + 1, TRAIL_CAPACITY);
    runtime.lastSample = runtime.cycles;
  }

  /*
   * How much of the ring is still inside this hand's own closed path. Walking
   * back from the head is the same order of work as the stroke that follows,
   * and ages stored in cycles mean a pause does not age the trail.
   */
  function keptPoints(runtime: HandRuntime, closure: number): number {
    let kept = 0;
    while (kept < runtime.length) {
      const at = (runtime.head - 1 - kept + TRAIL_CAPACITY) % TRAIL_CAPACITY;
      if (runtime.cycles - runtime.trail[at * 3 + 2] > closure) break;
      kept += 1;
    }
    return kept;
  }

  onMount(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = performance.now();
    let appliedAlign = alignToken;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const element = canvas;
      const context = element?.getContext("2d");
      if (!element || !context) return;

      const dt = Math.min(now - last, 64);
      last = now;

      if (now - colorsResolvedAt > 1000) {
        colorsResolvedAt = now;
        colorCache.clear();
      }

      if (appliedAlign !== alignToken) {
        appliedAlign = alignToken;
        for (const hand of hands) resetRuntime(hand, runtimeFor(hand));
      }

      /*
       * Reduced motion holds the shape still rather than skipping the draw, so
       * whatever is already on screen stays readable.
       */
      const advance = paused || media.matches ? 0 : dt;
      const handTurns = advance / handPeriod;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = element.clientWidth;
      const cssHeight = element.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      const pixelWidth = Math.round(cssWidth * dpr);
      const pixelHeight = Math.round(cssHeight * dpr);
      if (element.width !== pixelWidth || element.height !== pixelHeight) {
        element.width = pixelWidth;
        element.height = pixelHeight;
      }

      const scale = Math.min(cssWidth, cssHeight) / (VIEW * 2);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      context.translate(cssWidth / 2, cssHeight / 2);
      context.scale(scale, scale);

      /*
       * The mandala first, whole, under everything else — the same floor the
       * Matrix drill lays under its live player, at the same opacity. Both
       * hands before either trail, so one hand's guide never lands on top of
       * the other hand's motion.
       */
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = MANDALA_GUIDE_FLOOR_OPACITY;
      context.lineWidth = 0.013;
      context.lineJoin = "round";
      for (const hand of hands) {
        const guide = hand.guide;
        if (!guide || guide.length < 2) continue;
        context.strokeStyle = resolveColor(element, hand.color);
        context.beginPath();
        context.moveTo(guide[0].x, guide[0].y);
        for (let i = 1; i < guide.length; i += 1) {
          context.lineTo(guide[i].x, guide[i].y);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";

      for (const hand of hands) {
        const runtime = runtimeFor(hand);
        const color = resolveColor(element, hand.color);
        /*
         * `spin` is relative to the hand, so a hand running counter-clockwise
         * carries its prospin prop counter-clockwise too. Without the hand's
         * sign on both terms, reversing one hand would silently convert its
         * prospin flower into an antispin one.
         */
        const handSign = hand.handSign ?? 1;
        runtime.cycles += handTurns;
        runtime.handAngle +=
          handTurns * Math.PI * 2 * handSign * (hand.radius > 0 ? 1 : 0);
        runtime.propAngle +=
          handTurns * Math.PI * 2 * hand.rate * hand.spinSign * handSign;

        /*
         * The model measures angles clockwise from straight up into a
         * y-grows-down frame, so a settled shape here is the same object the
         * index thumbnails draw. Standard-math cos/sin would silently mirror
         * and quarter-turn every path.
         */
        const handX = Math.sin(runtime.handAngle) * hand.radius;
        const handY = -Math.cos(runtime.handAngle) * hand.radius;
        const headX = handX + Math.sin(runtime.propAngle) * propReach;
        const headY = handY - Math.cos(runtime.propAngle) * propReach;
        const spacing = hand.trailCycles / TRAIL_SAMPLES;
        if (
          runtime.length === 0 ||
          (advance > 0 && runtime.cycles - runtime.lastSample >= spacing)
        ) {
          pushPoint(runtime, headX, headY);
        }

        const kept = keptPoints(runtime, hand.trailCycles);
        /*
         * Butt caps on the buckets. A round cap juts half a line-width past the
         * shared vertex, so two adjacent buckets double-cover it and additive
         * blending turns every seam into a bright bead. Butt ends meet exactly
         * at the vertex: no overlap, no gap.
         */
        context.lineCap = "butt";
        context.lineJoin = "round";
        /*
         * Two hands at alpha are 180 degrees apart, so any even-petal ratio
         * puts them on the SAME locus and the hand drawn second hides the
         * first entirely. Additive blending keeps that truthful: a path only
         * one hand walks stays blue or red, and a path they share lights up as
         * both at once instead of erasing one of them.
         */
        context.globalCompositeOperation = "lighter";
        context.strokeStyle = color;
        /*
         * Stroked in age buckets rather than one segment at a time. Under
         * additive blending a per-segment stroke doubles up wherever two round
         * caps meet, which beads a continuous path into a dotted line. A
         * bucket is a single polyline with real joins, so only the handful of
         * bucket seams overlap at all and the fade still reads as a gradient.
         */
        const buckets = Math.min(TRAIL_BUCKETS, Math.max(1, kept - 1));
        for (let b = 0; b < buckets; b += 1) {
          const start = Math.floor((b * (kept - 1)) / buckets);
          const end = Math.floor(((b + 1) * (kept - 1)) / buckets);
          if (end <= start) continue;
          const age = (b + 1) / buckets;
          context.beginPath();
          for (let i = start; i <= end; i += 1) {
            const at = (runtime.head - kept + i + TRAIL_CAPACITY) % TRAIL_CAPACITY;
            if (i === start) {
              context.moveTo(runtime.trail[at * 3], runtime.trail[at * 3 + 1]);
            } else {
              context.lineTo(runtime.trail[at * 3], runtime.trail[at * 3 + 1]);
            }
          }
          /*
           * A low floor, because the guide beneath it already holds the whole
           * flower. Without one the trail has to be the shape AND the
           * recency, and the two fight. With one it is free to read as a
           * bright head walking a drawing that is already there.
           */
          context.globalAlpha = 0.12 + age * 0.84;
          context.lineWidth = 0.016 + age * 0.026;
          context.stroke();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        context.lineCap = "round";

        context.beginPath();
        context.moveTo(handX, handY);
        context.lineTo(headX, headY);
        context.lineWidth = 0.042;
        context.strokeStyle = "rgba(255, 255, 255, 0.92)";
        context.stroke();

        context.beginPath();
        context.arc(handX, handY, 0.075, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 255, 255, 0.92)";
        context.fill();

        context.beginPath();
        context.arc(headX, headY, 0.155, 0, Math.PI * 2);
        context.globalAlpha = 0.28;
        context.fillStyle = color;
        context.fill();
        context.globalAlpha = 1;

        context.beginPath();
        context.arc(headX, headY, 0.1, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="live-frame" style={`--grid-span: ${GRID_SPAN};`} aria-hidden="true">
  <svg class="tka-grid" viewBox="0 0 {GRID_VIEWBOX} {GRID_VIEWBOX}">
    <!-- Every hand start lands on north, south, east or west, and every prop
         bearing with it, so diamond is the grid these paths are actually drawn
         on. `darkMode` is not about export here: it inlines the light grid
         colour, which is what this stage needs on its dark card whatever the
         page theme is doing. -->
    <GridSvg gridMode={GridMode.DIAMOND} darkMode={true} />
  </svg>
  <canvas bind:this={canvas} class="live-stage"></canvas>
</div>

<style>
  .live-frame {
    position: absolute;
    inset: 0;
    /* The grid square is a fixed multiple of the canvas's shorter side, which
       is the side the canvas scales itself from. */
    container-type: size;
  }

  .tka-grid {
    position: absolute;
    top: 50%;
    left: 50%;
    width: calc(min(100cqw, 100cqh) * var(--grid-span));
    aspect-ratio: 1;
    translate: -50% -50%;
    /* Scaffolding, not the subject. */
    opacity: 0.3;
  }

  .live-stage {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
