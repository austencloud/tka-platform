<script lang="ts">
  import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
  import {
    Bloom2DRenderer,
    type BloomTipInput,
  } from "$lib/shared/effects/renderers/bloom-2d-renderer";
  import { resolveBloom2D } from "$lib/shared/effects/translators/canvas2d-translator";
  import type { EffectPreset } from "../presets/types";

  interface Props {
    preset: EffectPreset<"bloom">;
    active?: boolean;
  }

  const { preset, active = false }: Props = $props();
  let canvas: HTMLCanvasElement;

  const WIDTH = 480;
  const HEIGHT = 180;
  // Standalone optical study: the preset is the subject.
  const COMET_FRAMES = 40;

  function lightSource(x: number, y: number, color: string): BloomTipInput {
    return { x, y, tipIndex: 0, propIndex: 0, color };
  }

  function scene(frame: number): BloomTipInput[] {
    if (preset.id === "bloom-comet") {
      const progress = frame / (COMET_FRAMES - 1);
      const x = 62 + progress * 356;
      const y = 130 - progress * 72 - Math.sin(progress * Math.PI) * 25;
      return [lightSource(x, y, "#fbbf24")];
    }

    if (preset.id === "bloom-supernova") {
      return [lightSource(WIDTH / 2, HEIGHT / 2, "#dbeafe")];
    }

    return [lightSource(WIDTH / 2, HEIGHT / 2, "#e0e7ff")];
  }

  function drawStage(ctx: CanvasRenderingContext2D): void {
    const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#090b16");
    background.addColorStop(0.58, "#050712");
    background.addColorStop(1, "#020309");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const pool = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      0,
      WIDTH / 2,
      HEIGHT / 2,
      210
    );
    pool.addColorStop(0, "rgba(96, 112, 168, 0.1)");
    pool.addColorStop(1, "rgba(2, 3, 9, 0)");
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new Bloom2DRenderer();
    const intent = {
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      ...(preset.patch ?? {}),
    };
    const params = resolveBloom2D(intent);
    const frameCount = preset.id === "bloom-comet" ? COMET_FRAMES : 1;
    const scale = preset.id === "bloom-halo" ? 1.08 : 0.9;

    for (let frame = 0; frame < frameCount; frame += 1) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      drawStage(ctx);
      renderer.render(ctx, params, scene(frame), scale);
    }

    return () => renderer.dispose();
  });
</script>

<div class="bloom-thumbnail" class:active aria-hidden="true">
  <canvas bind:this={canvas} width={WIDTH} height={HEIGHT}></canvas>
</div>

<style>
  .bloom-thumbnail {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: #050712;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .bloom-thumbnail.active {
    border-color: color-mix(
      in srgb,
      var(--card-accent, #f472b6) 50%,
      transparent
    );
  }
</style>
