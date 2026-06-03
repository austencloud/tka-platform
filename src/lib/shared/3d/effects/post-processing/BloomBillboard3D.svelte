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
  import { Vector3, CanvasTexture, AdditiveBlending, SRGBColorSpace } from "three";
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

  // ───── Texture cache ───────────────────────────────────────────────
  // Keyed by the same tuple that determines gradient shape + color.
  // Module-level so multiple instances share the same cache.
  const textureCache = new Map<string, CanvasTexture>();

  function buildCacheKey(i: BloomIntent, propColor: string, idx: number): string {
    return `${i.colorMode}|${i.falloff}|${i.color}|${i.radius}|${i.palette.join(",")}|${propColor}|${idx}`;
  }

  function withAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    if (color.startsWith("#")) {
      let h = color.replace("#", "");
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const num = parseInt(h, 16);
      const r = (num >> 16) & 0xff;
      const g = (num >> 8) & 0xff;
      const b = num & 0xff;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (color.startsWith("hsl(") && !color.startsWith("hsla(")) {
      return `hsla${color.slice(3, -1)}, ${a})`;
    }
    return color;
  }

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

  function generateTexture(i: BloomIntent, baseColor: string): CanvasTexture {
    const size = 128;
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : (() => {
            const c = document.createElement("canvas");
            c.width = size;
            c.height = size;
            return c;
          })();
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) {
      // Worst-case fallback - return an empty texture; scene stays stable.
      return new CanvasTexture(canvas as HTMLCanvasElement);
    }
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = (a: number) => withAlpha(baseColor, a);
    const transparent = withAlpha(baseColor, 0);
    switch (i.falloff) {
      case "sharp":
        g.addColorStop(0, col(1));
        g.addColorStop(0.15, col(0.7));
        g.addColorStop(0.6, col(0.1));
        g.addColorStop(1, transparent);
        break;
      case "ring":
        g.addColorStop(0, transparent);
        g.addColorStop(0.45, col(0.2));
        g.addColorStop(0.7, col(1));
        g.addColorStop(0.9, col(0.3));
        g.addColorStop(1, transparent);
        break;
      case "smooth":
      default:
        g.addColorStop(0, col(1));
        g.addColorStop(0.4, col(0.5));
        g.addColorStop(1, transparent);
        break;
    }
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new CanvasTexture(canvas as HTMLCanvasElement);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Rainbow mode keeps its own texture handle since the baseColor drifts
  // every frame - we regenerate on a throttle rather than cache by key.
  let rainbowTexture: CanvasTexture | null = null;
  let lastRainbowUpdateMs = 0;
  const RAINBOW_UPDATE_INTERVAL_MS = 80; // ~12 fps on the hue

  const propColor = $derived(propIndex === 0 ? blueColor : redColor);

  // For non-rainbow modes, pick a stable texture via the cache.
  const stableTexture = $derived.by(() => {
    if (intent.colorMode === "rainbow") return null;
    const baseColor = pickBaseColor(intent, propColor, tipIndex, 0);
    const key = buildCacheKey(intent, propColor, tipIndex);
    let tex = textureCache.get(key);
    if (!tex) {
      tex = generateTexture(intent, baseColor);
      textureCache.set(key, tex);
    }
    return tex;
  });

  // Per-frame pulse factor + optional rainbow texture refresh.
  let pulseFactor = $state(1);
  useTask(() => {
    if (!enabled) return;
    const t = performance.now() / 1000;
    pulseFactor =
      1 -
      intent.pulse +
      intent.pulse * (0.5 + 0.5 * Math.sin(t * intent.pulseRate * Math.PI * 2));

    if (intent.colorMode === "rainbow") {
      const nowMs = t * 1000;
      if (nowMs - lastRainbowUpdateMs > RAINBOW_UPDATE_INTERVAL_MS || !rainbowTexture) {
        rainbowTexture?.dispose();
        rainbowTexture = generateTexture(intent, pickBaseColor(intent, propColor, tipIndex, t));
        lastRainbowUpdateMs = nowMs;
      }
    }
  });

  const activeTexture = $derived(
    intent.colorMode === "rainbow" ? rainbowTexture : stableTexture,
  );
  const opacity = $derived(Math.max(0, Math.min(1, intent.intensity * pulseFactor)));
  // Tuned so 28 px 2D ≈ 1.12 world units 3D.
  const spriteScale = $derived(intent.radius * 0.04);
</script>

{#if enabled && position && activeTexture && opacity > 0}
  <T.Sprite
    position={[position.x, position.y, position.z]}
    scale={[spriteScale, spriteScale, 1]}
  >
    <T.SpriteMaterial
      map={activeTexture}
      transparent
      opacity={opacity}
      blending={AdditiveBlending}
      depthWrite={false}
    />
  </T.Sprite>
{/if}
