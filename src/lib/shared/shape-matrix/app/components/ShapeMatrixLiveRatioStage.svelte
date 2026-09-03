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

  The consequence is worth stating plainly, because it is the interesting part.
  Land on a detent after scrubbing and you get the canonical shape at whatever
  orientation the hands happened to be in. Same flower, rotated. In a room that
  is exactly what decides which way a mandala points.

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
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { angleOf, PROP_LENGTH } from "$lib/shared/notation/qft/qft-model";

  interface Props {
    hands: LiveHand[];
    /** Milliseconds for one hand circle. */
    handPeriod?: number;
    /** Seconds of path kept behind the prop head. */
    trailSeconds?: number;
    paused?: boolean;
    /** Bumping this returns every accumulated phase to its start. */
    alignToken?: number;
  }

  let {
    hands,
    handPeriod = 2600,
    trailSeconds = 14,
    paused = false,
    alignToken = 0,
  }: Props = $props();

  const VIEW = 2.45;
  const TRAIL_CAPACITY = 1100;
  const TRAIL_BUCKETS = 26;

  interface HandRuntime {
    handAngle: number;
    propAngle: number;
    trail: Float32Array;
    head: number;
    length: number;
  }

  let canvas = $state<HTMLCanvasElement | null>(null);
  const runtimes = new Map<string, HandRuntime>();

  function runtimeFor(hand: LiveHand): HandRuntime {
    let runtime = runtimes.get(hand.id);
    if (!runtime) {
      runtime = {
        handAngle: angleOf(hand.handPhase),
        propAngle: angleOf(hand.handPhase + (hand.propPhase ?? 0)),
        trail: new Float32Array(TRAIL_CAPACITY * 2),
        head: 0,
        length: 0,
      };
      runtimes.set(hand.id, runtime);
    }
    return runtime;
  }

  function resetRuntime(hand: LiveHand, runtime: HandRuntime): void {
    runtime.handAngle = angleOf(hand.handPhase);
    runtime.propAngle = angleOf(hand.handPhase + (hand.propPhase ?? 0));
    runtime.head = 0;
    runtime.length = 0;
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
    runtime.trail[runtime.head * 2] = x;
    runtime.trail[runtime.head * 2 + 1] = y;
    runtime.head = (runtime.head + 1) % TRAIL_CAPACITY;
    runtime.length = Math.min(runtime.length + 1, TRAIL_CAPACITY);
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
      const trailPoints = Math.min(
        TRAIL_CAPACITY,
        Math.ceil((trailSeconds * 1000) / 16)
      );

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
        const headX = handX + Math.sin(runtime.propAngle) * PROP_LENGTH;
        const headY = handY - Math.cos(runtime.propAngle) * PROP_LENGTH;
        if (advance > 0 || runtime.length === 0) {
          pushPoint(runtime, headX, headY);
        }

        if (hand.radius > 0) {
          context.beginPath();
          context.arc(0, 0, hand.radius, 0, Math.PI * 2);
          context.setLineDash([0.055, 0.075]);
          context.lineWidth = 0.016;
          context.strokeStyle = "rgba(255, 255, 255, 0.18)";
          context.stroke();
          context.setLineDash([]);
        }

        const kept = Math.min(runtime.length, trailPoints);
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
              context.moveTo(runtime.trail[at * 2], runtime.trail[at * 2 + 1]);
            } else {
              context.lineTo(runtime.trail[at * 2], runtime.trail[at * 2 + 1]);
            }
          }
          context.globalAlpha = 0.08 + age * 0.86;
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

<canvas bind:this={canvas} class="live-stage" aria-hidden="true"></canvas>

<style>
  .live-stage {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
