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

  // 2.67:1 to match the tile the panel gives us, supersampled ~1.5x so the
  // downscale to ~304px stays crisp.
  const WIDTH = 720;
  const HEIGHT = 270;

  /**
   * The preset radii were tuned against the production stage, which sits around
   * 900px wide. Scaling by the same ratio is what makes the tile honest: a
   * radius-62 halo covers the same fraction of this tile that it covers of the
   * real canvas. It also means a preset whose spikes run off the stage in the
   * app runs off the tile here too, which is information, not a framing bug.
   */
  const REFERENCE_STAGE_WIDTH = 900;
  const SCALE = WIDTH / REFERENCE_STAGE_WIDTH;

  /**
   * Every preset gets the SAME scene: two prop-coloured tips sweeping the same
   * arc for the same number of frames. The preset patch is the only variable,
   * so the tiles compare looks instead of comparing staged illustrations.
   */
  const FRAMES = 40;
  const CY = HEIGHT / 2;
  // Ends the sweep near the middle of the tile rather than at its right edge:
  // presets with no afterglow only ever show the final frame, so a path that
  // finishes far right leaves them stranded against the border.
  const X_LEFT = 60;
  const X_RIGHT = 480;
  const ARC_HEIGHT = 60;

  // The canonical prop blue/red. `prop-matched` presets resolve to these in the
  // app, so the tile has to show them rather than a flattering hand-picked hue.
  const BLUE = DEFAULT_EFFECTS_CONFIG.trails.blueColor;
  const RED = DEFAULT_EFFECTS_CONFIG.trails.redColor;

  /**
   * Both tips ride one open swoop, red trailing blue by a fixed phase - the way
   * two props actually travel, one behind the other on the same shape. Mirrored
   * or antipodal paths were tried first and both are wrong: they share
   * endpoints, so a long afterglow closes them into a ring or a lens, and the
   * tile ends up showing a geometric figure instead of the look. Red enters
   * from just off-frame, which is why its trail has no visible start.
   */
  const RED_PHASE_LAG = 0.28;

  function tipAt(t: number, tipIndex: number, color: string): BloomTipInput {
    return {
      x: X_LEFT + t * (X_RIGHT - X_LEFT),
      y: CY + ARC_HEIGHT * Math.sin(t * Math.PI),
      propIndex: tipIndex,
      tipIndex,
      color,
    };
  }

  function scene(frame: number): BloomTipInput[] {
    const progress = frame / (FRAMES - 1);
    return [
      tipAt(progress, 0, BLUE),
      tipAt(progress - RED_PHASE_LAG, 1, RED),
    ];
  }

  function drawStage(ctx: CanvasRenderingContext2D): void {
    const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#090b16");
    background.addColorStop(0.58, "#050712");
    background.addColorStop(1, "#020309");
    ctx.fillStyle = background;
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

    // Replay the whole sweep so afterglow and streak accumulate the way they do
    // during playback. The last frame is what the tile ends up showing.
    for (let frame = 0; frame < FRAMES; frame += 1) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      drawStage(ctx);
      renderer.render(ctx, params, scene(frame), SCALE);
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
