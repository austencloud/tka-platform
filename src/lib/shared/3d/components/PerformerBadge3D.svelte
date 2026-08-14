<script module lang="ts">
  import { CanvasTexture } from "three";

  const badgeTextures = new Map<string, CanvasTexture>();

  function getBadgeTexture(
    index: number,
    color: string,
    selected: boolean
  ): CanvasTexture {
    const key = `${index}:${color}:${selected ? "selected" : "plain"}`;
    const cached = badgeTextures.get(key);
    if (cached) return cached;

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), size / 2, size / 2);

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    badgeTextures.set(key, texture);
    return texture;
  }
</script>

<script lang="ts">
  import { T } from "@threlte/core";
  import { getPerformerColor } from "../constants/performer-colors";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    index: number;
    selected: boolean;
    allMode: boolean;
  }

  let { index, selected, allMode }: Props = $props();

  const color = $derived(getPerformerColor(index));
  const opacity = $derived(selected ? 1.0 : allMode ? 0.6 : 0.35);
  const badgeY = $derived(-userProportionsState.groundY + 0.15);

  const texture = $derived(getBadgeTexture(index, color, selected));
</script>

<T.Sprite
  position.y={badgeY}
  scale={[0.22, 0.22, 1]}
  material.map={texture}
  material.transparent={true}
  material.opacity={opacity}
  material.depthTest={false}
  renderOrder={999}
/>
