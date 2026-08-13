<script lang="ts">
  /**
   * A camera-facing text label for one grid cell.
   *
   * Threlte's <Text> needs troika-three-text, which this project does not
   * install — it renders nothing and says nothing about why. Rather than add a
   * dependency for a test harness, this draws the label into a canvas and
   * puts it on a sprite. The texture stays local to this test-only label.
   */
  import { T } from "@threlte/core";
  import { CanvasTexture, SRGBColorSpace } from "three";

  interface Props {
    text: string;
    color: string;
    position: [number, number, number];
    /** World height of the label. Width follows the texture's aspect. */
    height?: number;
  }
  const { text, color, position, height = 0.72 }: Props = $props();

  const PAD = 24;
  const FONT_PX = 96;

  const texture = $derived.by(() => {
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return null;
    measure.font = `600 ${FONT_PX}px ui-sans-serif, system-ui, sans-serif`;
    const w = Math.ceil(measure.measureText(text).width) + PAD * 2;
    const h = FONT_PX + PAD * 2;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.font = `600 ${FONT_PX}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Dark halo first so the label stays readable over a bright effect.
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(4, 6, 12, 0.92)";
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return { tex, aspect: w / h };
  });
</script>

{#if texture}
  <T.Sprite position={position} scale={[height * texture.aspect, height, 1]}>
    <T.SpriteMaterial map={texture.tex} transparent depthWrite={false} />
  </T.Sprite>
{/if}
