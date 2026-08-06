<script module lang="ts">
  import { CanvasTexture, SRGBColorSpace } from "three";
  import type { BloomIntent } from "$lib/shared/effects/domain/effects-config";

  // The radial mask is independent of hue and radius. Sharing one white mask
  // per falloff lets SpriteMaterial tint it without baking a texture per tip
  // (or, in rainbow mode, per animation frame).
  const textureCache = new Map<BloomIntent["falloff"], CanvasTexture>();

  function withAlpha(alpha: number): string {
    return `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha))})`;
  }

  function getRadialTexture(falloff: BloomIntent["falloff"]): CanvasTexture {
    const cached = textureCache.get(falloff);
    if (cached) return cached;

    const size = 128;
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : (() => {
            const element = document.createElement("canvas");
            element.width = size;
            element.height = size;
            return element;
          })();
    const context = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    const texture = new CanvasTexture(canvas as HTMLCanvasElement);
    texture.colorSpace = SRGBColorSpace;

    if (context) {
      const center = size / 2;
      const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center,
      );
      switch (falloff) {
        case "sharp":
          gradient.addColorStop(0, withAlpha(1));
          gradient.addColorStop(0.15, withAlpha(0.7));
          gradient.addColorStop(0.6, withAlpha(0.1));
          gradient.addColorStop(1, withAlpha(0));
          break;
        case "ring":
          gradient.addColorStop(0, withAlpha(0));
          gradient.addColorStop(0.45, withAlpha(0.2));
          gradient.addColorStop(0.7, withAlpha(1));
          gradient.addColorStop(0.9, withAlpha(0.3));
          gradient.addColorStop(1, withAlpha(0));
          break;
        case "smooth":
        default:
          gradient.addColorStop(0, withAlpha(1));
          gradient.addColorStop(0.4, withAlpha(0.5));
          gradient.addColorStop(1, withAlpha(0));
          break;
      }
      context.clearRect(0, 0, size, size);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      texture.needsUpdate = true;
    }

    textureCache.set(falloff, texture);
    return texture;
  }
</script>

<script lang="ts">
  /**
   * BloomBillboard3D - per-tip radial halation sprite.
   *
   * The 3D sibling of the Canvas2D per-tip bloom overlay. Renders one
   * camera-facing sprite per tip with a procedural radial-gradient
   * texture (generated off-DOM via OffscreenCanvas/HTMLCanvasElement and
   * cached by parameter tuple). Additive blending + depthWrite=false so
   * overlapping halos brighten where tips cluster.
   *
   * Pulse modulation is time-based via `performance.now()` inside a
   * useTask loop - halos breathe regardless of playback state, matching
   * the 2D implementation.
   *
   * Unmounts the legacy fullscreen-post-process `BloomEffect.svelte`;
   * that file stays on disk for Phase 3 cleanup.
   */

  import { T, useTask } from "@threlte/core";
  import { Vector3, AdditiveBlending, type SpriteMaterial } from "three";
  import type { BloomIntent } from "$lib/shared/effects/domain/effects-config";

  interface Props {
    /** World-space position of this tip. null = hidden. */
    position: Vector3 | null;
    /** Global tip index 0..3 - used for palette cycling. */
    tipIndex: number;
    /** 0 = blue prop, 1 = red prop. Used for prop-matched colorMode. */
    propIndex: 0 | 1;
    /** Hex for the blue prop (trail color) - used for prop-matched colorMode. */
    blueColor: string;
    /** Hex for the red prop (trail color) - used for prop-matched colorMode. */
    redColor: string;
    /** Live bloom intent. */
    intent: BloomIntent;
    /** Gates mounting. */
    enabled: boolean;
  }

  let {
    position,
    tipIndex,
    propIndex,
    blueColor,
    redColor,
    intent,
    enabled,
  }: Props = $props();

  function pickBaseColor(i: BloomIntent, propColor: string, idx: number, t: number): string {
    switch (i.colorMode) {
      case "prop-matched":
        return propColor;
      case "rainbow":
        return `hsl(${(t * 60) % 360}, 80%, 60%)`;
      case "palette":
        if (i.palette.length === 0) return i.color;
        return i.palette[idx % i.palette.length]!;
      case "solid":
      default:
        return i.color;
    }
  }

  const propColor = $derived(propIndex === 0 ? blueColor : redColor);
  const radialTexture = $derived(getRadialTexture(intent.falloff));
  const stableColor = $derived(pickBaseColor(intent, propColor, tipIndex, 0));
  let material = $state.raw<SpriteMaterial>();

  // Mutate the material in place so pulse and rainbow animation never enter
  // Svelte's render loop or allocate GPU textures/materials per frame.
  useTask(() => {
    if (!enabled || !material) return;
    const t = performance.now() / 1000;
    const pulseFactor =
      1 -
      intent.pulse +
      intent.pulse * (0.5 + 0.5 * Math.sin(t * intent.pulseRate * Math.PI * 2));
    material.opacity = Math.max(0, Math.min(1, intent.intensity * pulseFactor));
    if (intent.colorMode === "rainbow") {
      material.color.set(pickBaseColor(intent, propColor, tipIndex, t));
    } else {
      material.color.set(stableColor);
    }
  });

  // Tuned so 28 px 2D ≈ 1.12 world units 3D.
  const spriteScale = $derived(intent.radius * 0.04);
</script>

{#if enabled && position}
  <T.Sprite
    position={[position.x, position.y, position.z]}
    scale={[spriteScale, spriteScale, 1]}
  >
    <T.SpriteMaterial
      bind:ref={material}
      map={radialTexture}
      color={stableColor}
      transparent
      opacity={intent.intensity}
      blending={AdditiveBlending}
      depthWrite={false}
    />
  </T.Sprite>
{/if}
