<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    deriveFrameMath,
    renderMandalaFrameToCanvas,
    type MandalaFrameSpec,
    type MandalaGeometryCache,
  } from "$lib/shared/mandala/services/mandala-frame-renderer";
  import { PRESET_COLORS } from "$lib/shared/mandala/domain/mandala-palette";

  interface Props {
    sequence: SequenceData;
    /** Composition time, so the undulation phase follows the playhead. */
    sourceTimeSeconds: number;
    bluePropType?: string;
    redPropType?: string;
  }

  let {
    sequence,
    sourceTimeSeconds,
    bluePropType,
    redPropType,
  }: Props = $props();

  // The mandala's own viewer defaults, so a post looks like what the Art pane
  // shows: arc paths, aurora flow, a 5-second breath, a quarter turn per
  // reference period. These are the MandalaViewerController field defaults —
  // Post Studio has no mandala controls yet, and inventing different numbers
  // here would make the post disagree with the viewer it came from.
  const RESOLUTION = 1080;
  const FPS = 30;
  const REPS = 3;
  const PRESET = PRESET_COLORS.aurora;

  let canvas = $state<HTMLCanvasElement | null>(null);
  const geometryCache: MandalaGeometryCache = new Map();

  const spec = $derived<MandalaFrameSpec>({
    // Steps arrive as Svelte proxies or domain instances; the renderer walks
    // them as plain data, and a proxy read per path segment is measurable.
    steps: $state.snapshot(sequence.steps) as readonly unknown[] as readonly any[],
    bluePropType,
    redPropType,
    show: "both",
    pathShape: "arc",
    lineWeight: 2.5,
    bgColor: PRESET.bg,
    resolution: RESOLUTION,
    period: 5,
    reps: REPS,
    fps: FPS,
    rangeMax: 250,
    rotation: 90,
    morphColors: PRESET.morph,
    solidPair: null,
  });

  const math = $derived(deriveFrameMath(spec));

  $effect(() => {
    // A new sequence or a new spec invalidates every cached undulation phase.
    spec;
    geometryCache.clear();
  });

  $effect(() => {
    const target = canvas;
    if (!target || spec.steps.length === 0) return;
    const ctx = target.getContext("2d");
    if (!ctx) return;

    const frame =
      Math.round(sourceTimeSeconds * FPS) % Math.max(1, math.totalFrames);
    renderMandalaFrameToCanvas(
      // The frame renderer is written against the worker's OffscreenCanvas
      // context; the two 2D contexts are structurally identical for every call
      // it makes, and the on-DOM path is the only way to preview one live.
      ctx as unknown as OffscreenCanvasRenderingContext2D,
      spec,
      math,
      frame < 0 ? frame + math.totalFrames : frame,
      geometryCache
    );
  });
</script>

<canvas
  bind:this={canvas}
  width={RESOLUTION}
  height={RESOLUTION}
  aria-hidden="true"
></canvas>

<style>
  canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
