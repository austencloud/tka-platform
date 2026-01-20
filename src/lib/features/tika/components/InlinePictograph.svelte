<!--
  Inline Pictograph Component

  Renders a single pictograph image inline within a message bubble.

  Loading priority (production-ready):
  1. Static files in /static/pictographs/ (instant, works in production)
  2. IndexedDB cache (fast, browser-persisted)
  3. API generation (dev only, saves to static for future)

  Uses responsive sizing when no explicit size is provided.
-->
<script lang="ts">
  import type { InlinePictograph } from "../types";
  import { dev } from "$app/environment";
  import { tikaPictographCache } from "../services/implementations/TikaPictographCache";
  import {
    getStaticPictographPath,
    saveStaticPictograph,
    type PictographFileKey,
  } from "../services/implementations/StaticPictographWriter";

  // Props - size is optional; when not provided, uses responsive CSS sizing
  let {
    pictograph,
    size,
  }: {
    pictograph: InlinePictograph;
    size?: number;
  } = $props();

  // API request size - use explicit size or high quality default for responsive display
  const apiSize = $derived(size ?? 280);

  // State
  let imageUrl = $state<string | null>(null);
  let loading = $state(true);
  let error = $state(false);

  // Generate cache key (includes grid mode for uniqueness)
  function getCacheKey(letter: string, variation: number, imageSize: number): string {
    const gridMode = pictograph.gridMode ?? "diamond";
    return `${letter}-${variation}-${imageSize}-${gridMode}`;
  }

  // Build static file key
  function buildStaticKey(letter: string, variation: number): PictographFileKey {
    return {
      letter,
      variation,
      gridMode: (pictograph.gridMode ?? "diamond") as "diamond" | "box",
    };
  }

  // Check if static file exists
  async function checkStaticFile(key: PictographFileKey): Promise<string | null> {
    const path = getStaticPictographPath(key);
    try {
      const response = await fetch(path, { method: "HEAD" });
      return response.ok ? path : null;
    } catch {
      return null;
    }
  }

  // Fetch pictograph on mount or when pictograph changes
  $effect(() => {
    fetchPictograph();
  });

  async function fetchPictograph() {
    loading = true;
    error = false;
    imageUrl = null;

    const variation = pictograph.variation ?? 0;
    const staticKey = buildStaticKey(pictograph.letter, variation);

    try {
      // Priority 1: Static file (instant, works in production)
      const staticPath = await checkStaticFile(staticKey);
      if (staticPath) {
        imageUrl = staticPath;
        loading = false;
        return;
      }

      // Priority 2: IndexedDB cache
      const cacheKey = getCacheKey(pictograph.letter, variation, apiSize);
      const cached = await tikaPictographCache.get(cacheKey);
      if (cached) {
        imageUrl = `data:image/png;base64,${cached}`;
        loading = false;
        return;
      }

      // Priority 3: API (dev only)
      if (!dev) {
        console.warn(`[InlinePictograph] Missing pictograph in production: ${pictograph.letter}-${variation}`);
        error = true;
        loading = false;
        return;
      }

      // Fetch from API
      const response = await fetch("/api/tika/pictograph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letter: pictograph.letter,
          variation,
          gridMode: pictograph.gridMode ?? "diamond",
          options: {
            darkMode: true,
            size: apiSize,
            showTKA: true,
            showGrid: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pictograph: ${response.status}`);
      }

      const data = await response.json();
      const base64 = data.imageBase64 as string;

      // Save to static directory for production (dev only)
      const saved = await saveStaticPictograph(staticKey, base64);
      if (saved) {
        console.log(`[InlinePictograph] Saved to static: ${pictograph.letter}-${variation}`);
      }

      // Also cache in IndexedDB for this session
      await tikaPictographCache.set(cacheKey, base64);

      imageUrl = `data:image/png;base64,${base64}`;
    } catch (e) {
      console.error(`[InlinePictograph] Error fetching ${pictograph.letter}:`, e);
      error = true;
    } finally {
      loading = false;
    }
  }
</script>

<figure
  class="inline-pictograph"
  class:responsive={!size}
  style={size ? `--size: ${size}px` : undefined}
>
  {#if loading}
    <div class="placeholder">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <span>{pictograph.letter}</span>
    </div>
  {:else if imageUrl}
    <img src={imageUrl} alt="Letter {pictograph.letter}" />
  {/if}

  {#if pictograph.label}
    <figcaption class="label {pictograph.label}">{pictograph.label}</figcaption>
  {/if}
</figure>

<style>
  .inline-pictograph {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin: 8px 4px;
    padding: 0;
  }

  .inline-pictograph img {
    width: var(--size, 120px);
    max-width: 40vw;
    height: auto;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .placeholder,
  .error-state {
    width: var(--size, 120px);
    max-width: 40vw;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  /* Responsive mode - single pictograph can be BIG */
  .inline-pictograph.responsive img,
  .inline-pictograph.responsive .placeholder,
  .inline-pictograph.responsive .error-state {
    width: clamp(180px, 50vw, 320px);
    max-width: none;
  }

  .error-state {
    color: var(--semantic-error, #ef4444);
  }

  .error-state i {
    font-size: 20px;
  }

  .error-state span {
    font-weight: 600;
    font-size: 16px;
  }

  .label {
    margin: 0;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .label.pro {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .label.anti {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .label.hybrid {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }

  /* Default label style */
  .label:not(.pro):not(.anti):not(.hybrid) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .inline-pictograph img,
    .placeholder,
    .error-state {
      max-width: 35vw;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .placeholder i {
      animation: none;
    }
  }
</style>
