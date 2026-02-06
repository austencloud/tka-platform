<script lang="ts">
  /**
   * SkyGradient Primitive
   *
   * Sets the scene background to a gradient using a canvas texture.
   * This is more reliable than a mesh-based approach.
   */

  import { useThrelte } from "@threlte/core";
  import { CanvasTexture } from "three";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    /** Top color of gradient */
    topColor?: string;
    /** Bottom color of gradient */
    bottomColor?: string;
    /** Optional middle color for 3-stop gradient */
    midColor?: string;
  }

  let {
    topColor = "#1e1b4b",
    bottomColor = "#0a0a12",
    midColor,
  }: Props = $props();

  const { scene } = useThrelte();
  let texture: CanvasTexture | null = null;
  let originalBackground: typeof scene.current.background = null;

  function createGradientTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, topColor);
    if (midColor) {
      gradient.addColorStop(0.5, midColor);
    }
    gradient.addColorStop(1, bottomColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    return new CanvasTexture(canvas);
  }

  onMount(() => {
    // Store original background
    originalBackground = scene.current.background;

    // Create and set gradient texture
    texture = createGradientTexture();
    scene.current.background = texture;
  });

  onDestroy(() => {
    // Restore original background
    scene.current.background = originalBackground;
    texture?.dispose();
  });

  // Update when colors change
  $effect(() => {
    if (texture) {
      texture.dispose();
      texture = createGradientTexture();
      scene.current.background = texture;
    }
  });
</script>

<!-- No visual output - this sets scene.background directly -->
