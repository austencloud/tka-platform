<!--
  Inline Gallery Component

  Renders multiple pictographs in a grid or row layout within a message bubble.

  Loading priority (production-ready):
  1. Static files in /static/pictographs/ (instant, works in production)
  2. IndexedDB cache (fast, browser-persisted)
  3. API generation (dev only, saves to static for future)

  Uses container queries for intelligent sizing based on item count.
-->
<script lang="ts">
  import type { InlineGallery } from "../types";
  import { dev } from "$app/environment";
  import { tikaPictographCache } from "../services/implementations/TikaPictographCache";
  import {
    getStaticPictographPath,
    saveStaticPictograph,
    type PictographFileKey,
  } from "../services/implementations/StaticPictographWriter";

  // Props - itemSize is optional; when not provided, uses responsive sizing
  let {
    gallery,
    itemSize,
  }: {
    gallery: InlineGallery;
    itemSize?: number;
  } = $props();

  // Calculate optimal API size based on item count (for image generation quality)
  const apiItemSize = $derived(() => {
    if (itemSize) return itemSize;
    const count = gallery.items.length;
    if (count <= 2) return 280; // Comparison: high quality
    if (count <= 4) return 200; // Small gallery
    return 150; // Large gallery
  });

  // State - map of "letter-variation" -> base64 images
  let images = $state<Map<string, string>>(new Map());

  // Generate image key for the Map (includes variation to handle multiple variations of same letter)
  function getImageKey(letter: string, variation: number): string {
    return `${letter}-${variation}`;
  }
  let loading = $state(true);
  let loadedCount = $state(0);

  // Generate cache key
  function getCacheKey(letter: string, variation: number, size: number): string {
    return `${letter}-${variation}-${size}`;
  }

  // Fetch all gallery images
  $effect(() => {
    fetchGalleryImages();
  });

  // Build cache key including grid mode and render context
  function buildCacheKey(letter: string, variation: number, size: number): string {
    const context = gallery.renderContext;
    const mode = gallery.gridMode ?? "diamond";
    const base = `${letter}-${variation}-${size}-${mode}`;
    if (context?.propType) {
      return `${base}-${context.propType}`;
    }
    return base;
  }

  /**
   * Build static file key for a pictograph.
   */
  function buildStaticKey(letter: string, variation: number): PictographFileKey {
    const context = gallery.renderContext;
    return {
      letter,
      variation,
      gridMode: (gallery.gridMode ?? "diamond") as "diamond" | "box",
      propType: context?.propType,
    };
  }

  /**
   * Check if a static pictograph file exists.
   * Note: HEAD requests don't work reliably in Vite dev (returns 200 for non-existent files)
   * Instead, we fetch the file and check Content-Type to verify it's actually an image.
   */
  async function checkStaticFile(key: PictographFileKey): Promise<string | null> {
    const path = getStaticPictographPath(key);
    try {
      const response = await fetch(path, { method: "GET" });
      if (!response.ok) return null;

      // Verify it's actually an image (not an HTML error page)
      const contentType = response.headers.get("Content-Type");
      if (!contentType?.startsWith("image/")) {
        return null;
      }

      return path;
    } catch {
      return null;
    }
  }

  async function fetchGalleryImages() {
    loading = true;
    loadedCount = 0;
    const newImages = new Map<string, string>();
    const itemsToFetch: Array<{ letter: string; variation: number }> = [];
    const fetchSize = apiItemSize();
    const context = gallery.renderContext;

    // Step 1: Check static files first (production path), then IndexedDB cache
    for (const item of gallery.items) {
      const variation = item.variation ?? 0;
      const staticKey = buildStaticKey(item.letter, variation);

      // Priority 1: Static file (instant, works in production)
      const staticPath = await checkStaticFile(staticKey);
      if (staticPath) {
        newImages.set(getImageKey(item.letter, variation), staticPath);
        loadedCount++;
        continue;
      }

      // Priority 2: IndexedDB cache
      const cacheKey = buildCacheKey(item.letter, variation, fetchSize);
      const cached = await tikaPictographCache.get(cacheKey);
      if (cached) {
        newImages.set(getImageKey(item.letter, variation), `data:image/png;base64,${cached}`);
        loadedCount++;
        continue;
      }

      // Priority 3: Need to fetch from API
      itemsToFetch.push({ letter: item.letter, variation });
    }

    // Update images immediately with cached/static results
    images = new Map(newImages);

    // In production, if items are missing, they simply won't load
    // (the API doesn't exist in production builds)
    // Note: dev can be undefined in some contexts, so check explicitly for false
    if (dev === false && itemsToFetch.length > 0) {
      console.warn(
        `[InlineGallery] Missing ${itemsToFetch.length} pictographs in production:`,
        itemsToFetch.map((i) => `${i.letter}-${i.variation}`)
      );
      loading = false;
      return;
    }

    // If nothing to fetch, we're done
    if (itemsToFetch.length === 0) {
      loading = false;
      return;
    }

    // Step 2: Fetch missing items from API (dev only) and save to static
    const BATCH_SIZE = 4;

    for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
      const batch = itemsToFetch.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async ({ letter, variation }) => {
        try {
          // Build options, applying renderContext for position-teaching mode
          const options: Record<string, unknown> = {
            darkMode: true,
            size: fetchSize,
            showTKA: true,
            showGrid: true,
          };

          // Apply render context for position-first teaching
          if (context) {
            if (context.propType) {
              options.bluePropType = context.propType;
              options.redPropType = context.propType;
            }
            if (context.hideArrows) {
              options.showBlueMotion = false;
              options.showRedMotion = false;
            }
          }

          const response = await fetch("/api/tika/pictograph", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              letter,
              variation,
              gridMode: gallery.gridMode ?? "diamond",
              options,
            }),
          });

          if (!response.ok) return null;

          const data = await response.json();
          const base64 = data.imageBase64 as string;

          // Save to static directory (dev only - builds static cache for production)
          if (dev) {
            const staticKey = buildStaticKey(letter, variation);
            const saved = await saveStaticPictograph(staticKey, base64);
            if (saved) {
              console.log(`[InlineGallery] Saved to static: ${letter}-${variation}`);
            }
          }

          // Also cache in IndexedDB for this session
          const cacheKey = buildCacheKey(letter, variation, fetchSize);
          await tikaPictographCache.set(cacheKey, base64);

          return { letter, variation, imageUrl: `data:image/png;base64,${base64}` };
        } catch (e) {
          console.error(`[InlineGallery] Error fetching ${letter}:`, e);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Update images after each batch
      for (const result of batchResults) {
        if (result) {
          newImages.set(getImageKey(result.letter, result.variation), result.imageUrl);
          loadedCount++;
        }
      }

      images = new Map(newImages);
    }

    loading = false;
  }
</script>

<figure
  class="inline-gallery"
  class:row={gallery.layout === "row"}
  class:grid={gallery.layout === "grid"}
  class:responsive={!itemSize}
  class:comparison={!itemSize && gallery.items.length <= 2}
  class:small-gallery={!itemSize && gallery.items.length > 2 && gallery.items.length <= 4}
  class:large-gallery={!itemSize && gallery.items.length > 4}
>
  <div class="gallery-items" style={itemSize ? `--item-size: ${itemSize}px` : undefined}>
    {#each gallery.items as item}
      {@const imageUrl = images.get(getImageKey(item.letter, item.variation ?? 0))}
      <div class="gallery-item">
        {#if imageUrl}
          <img src={imageUrl} alt="Letter {item.letter}" />
        {:else}
          <div class="placeholder">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          </div>
        {/if}
        {#if item.label}
          <span class="item-label {item.label}">{item.label}</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if gallery.caption}
    <figcaption class="gallery-caption">{gallery.caption}</figcaption>
  {/if}

  {#if loading && loadedCount < gallery.items.length}
    <div class="loading-indicator">
      Loading {loadedCount}/{gallery.items.length}
    </div>
  {/if}
</figure>

<style>
  .inline-gallery {
    margin: 8px 0;
    padding: 0;
    width: 100%;
  }

  /* Row layout - horizontal scrollable */
  .inline-gallery.row .gallery-items {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  /* Grid layout - responsive grid */
  .inline-gallery.grid .gallery-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--item-size, 100px), 1fr));
    gap: 8px;
    max-width: 100%;
  }

  .gallery-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    transition: border-color var(--duration-fast, 0.15s) ease;
  }

  .gallery-item:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .gallery-item img {
    width: var(--item-size, 100px);
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }

  .placeholder {
    width: var(--item-size, 100px);
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 16px;
  }

  /* ========================================
     Responsive sizing (when no explicit itemSize)
     Uses larger sizes to fill available space
     ======================================== */

  /* Comparison: 2 items - BIG side by side */
  .inline-gallery.comparison .gallery-items {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
  }

  .inline-gallery.comparison .gallery-item img,
  .inline-gallery.comparison .placeholder {
    width: clamp(180px, 45vw, 320px);
  }

  /* Small gallery: 3-4 items - fit all in one row when possible */
  .inline-gallery.small-gallery .gallery-items {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: 8px;
  }

  .inline-gallery.small-gallery .gallery-item img,
  .inline-gallery.small-gallery .placeholder {
    width: clamp(80px, 20vw, 140px);
  }

  /* On narrow screens, allow wrapping to 2x2 */
  @media (max-width: 480px) {
    .inline-gallery.small-gallery .gallery-items {
      flex-wrap: wrap;
    }
    .inline-gallery.small-gallery .gallery-item img,
    .inline-gallery.small-gallery .placeholder {
      width: clamp(70px, 40vw, 120px);
    }
  }

  /* Large gallery: 5+ items - 4 column grid */
  .inline-gallery.large-gallery .gallery-items {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .inline-gallery.large-gallery .gallery-item img,
  .inline-gallery.large-gallery .placeholder {
    width: 100%;
  }

  .item-label {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .item-label.pro {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent);
    color: var(--semantic-success, #22c55e);
    border: 1px solid color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
  }

  .item-label.anti {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    color: var(--semantic-error, #ef4444);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
  }

  .item-label.hybrid {
    background: color-mix(in srgb, var(--semantic-info, #a855f7) 20%, transparent);
    color: var(--semantic-info, #a855f7);
    border: 1px solid color-mix(in srgb, var(--semantic-info, #a855f7) 40%, transparent);
  }

  /* Default label */
  .item-label:not(.pro):not(.anti):not(.hybrid) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .gallery-caption {
    margin-top: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
    font-style: italic;
  }

  .loading-indicator {
    margin-top: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    text-align: center;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .inline-gallery.grid .gallery-items {
      grid-template-columns: repeat(3, 1fr);
    }

    .gallery-item img,
    .placeholder {
      width: 100%;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .placeholder i {
      animation: none;
    }

    .gallery-item {
      transition: none;
    }
  }
</style>
