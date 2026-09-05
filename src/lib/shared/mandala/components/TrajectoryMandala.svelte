<script lang="ts">
  import type { ProjectedTrajectorySet } from "../domain/trajectory-types";
  import { paintTrajectoryMandala } from "../services/trajectory-mandala-renderer";

  let {
    trajectories,
    throughBeat,
    viewBoxSize = 950,
    strokeWidth = 2,
  }: {
    trajectories: ProjectedTrajectorySet;
    throughBeat: number;
    viewBoxSize?: number;
    strokeWidth?: number;
  } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let size = $state(0);

  $effect(() => {
    if (!canvas) return;
    const element = canvas;
    const updateSize = () => {
      size = Math.max(
        1,
        Math.round(element.clientWidth * window.devicePixelRatio)
      );
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  });

  $effect(() => {
    if (!canvas || !size) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    paintTrajectoryMandala(context, trajectories, {
      pixelSize: size,
      viewBoxSize,
      throughBeat,
      strokeWidth,
    });
  });
</script>

<canvas
  bind:this={canvas}
  width={size}
  height={size}
  role="img"
  aria-label="Mandala traced by the prop tips"
  data-mandala-layer-count={trajectories.layers.length}
  data-mandala-beat={throughBeat}
></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
