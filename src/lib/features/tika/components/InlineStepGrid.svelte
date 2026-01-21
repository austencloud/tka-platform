<!--
  Inline Step Grid Component

  Renders a sequence broken down into individual pictographs with step labels.
  Shows each beat (including start position) as a static pictograph.

  Loading priority (production-ready):
  1. Static files in /static/pictographs/ (instant, works in production)
  2. IndexedDB cache (fast, browser-persisted)
  3. API generation (dev only, saves to static for future)
-->
<script lang="ts">
  import type { InlineStepGrid } from "../types";
  import { dev } from "$app/environment";
  import { tikaPictographCache } from "../services/implementations/TikaPictographCache";
  import {
    getStaticPictographPath,
    saveStaticPictograph,
    type PictographFileKey,
  } from "../services/implementations/StaticPictographWriter";

  // Props
  let {
    stepGrid,
  }: {
    stepGrid: InlineStepGrid;
  } = $props();

  // API size for image generation (consistent quality)
  const apiItemSize = 180;

  // State - map of stepNumber -> image URLs (static path or base64)
  let images = $state<Map<number, string>>(new Map());
  let loading = $state(true);
  let loadedCount = $state(0);

  // Generate cache key (includes grid mode)
  function getCacheKey(letter: string, variation: number, size: number): string {
    const gridMode = stepGrid.gridMode ?? "diamond";
    return `${letter}-${variation}-${size}-${gridMode}`;
  }

  // Build static file key
  function buildStaticKey(letter: string, variation: number): PictographFileKey {
    return {
      letter,
      variation,
      gridMode: (stepGrid.gridMode ?? "diamond") as "diamond" | "box",
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

  // Fetch all step images
  $effect(() => {
    fetchStepImages();
  });

  async function fetchStepImages() {
    loading = true;
    loadedCount = 0;
    const newImages = new Map<number, string>();
    const stepsToFetch: Array<{ stepNumber: number; letter: string; variation: number }> = [];

    // Step 1: Check static files first, then IndexedDB cache
    for (const step of stepGrid.steps) {
      const staticKey = buildStaticKey(step.letter, step.variation);

      // Priority 1: Static file
      const staticPath = await checkStaticFile(staticKey);
      if (staticPath) {
        newImages.set(step.stepNumber, staticPath);
        loadedCount++;
        continue;
      }

      // Priority 2: IndexedDB cache
      const cacheKey = getCacheKey(step.letter, step.variation, apiItemSize);
      const cached = await tikaPictographCache.get(cacheKey);
      if (cached) {
        newImages.set(step.stepNumber, `data:image/png;base64,${cached}`);
        loadedCount++;
        continue;
      }

      // Priority 3: Need to fetch from API
      stepsToFetch.push({
        stepNumber: step.stepNumber,
        letter: step.letter,
        variation: step.variation,
      });
    }

    // Update images immediately with cached/static results
    images = new Map(newImages);

    // In production, if items are missing, they simply won't load
    // Note: dev can be undefined in some contexts, so check explicitly for false
    if (dev === false && stepsToFetch.length > 0) {
      console.warn(
        `[InlineStepGrid] Missing ${stepsToFetch.length} pictographs in production:`,
        stepsToFetch.map((s) => `${s.letter}-${s.variation}`)
      );
      loading = false;
      return;
    }

    // If nothing to fetch, we're done
    if (stepsToFetch.length === 0) {
      loading = false;
      return;
    }

    // Step 2: Fetch missing steps from API (dev only) and save to static
    const BATCH_SIZE = 4;

    for (let i = 0; i < stepsToFetch.length; i += BATCH_SIZE) {
      const batch = stepsToFetch.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async ({ stepNumber, letter, variation }) => {
        try {
          const response = await fetch("/api/tika/pictograph", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              letter,
              variation,
              gridMode: stepGrid.gridMode ?? "diamond",
              options: {
                darkMode: true,
                size: apiItemSize,
                showTKA: true,
                showGrid: true,
              },
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
              console.log(`[InlineStepGrid] Saved to static: ${letter}-${variation}`);
            }
          }

          // Also cache in IndexedDB for this session
          const cacheKey = getCacheKey(letter, variation, apiItemSize);
          await tikaPictographCache.set(cacheKey, base64);

          return { stepNumber, imageUrl: `data:image/png;base64,${base64}` };
        } catch (e) {
          console.error(`[InlineStepGrid] Error fetching step ${stepNumber}:`, e);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Update images after each batch
      for (const result of batchResults) {
        if (result) {
          newImages.set(result.stepNumber, result.imageUrl);
          loadedCount++;
        }
      }

      images = new Map(newImages);
    }

    loading = false;
  }
</script>

<figure class="inline-step-grid">
  <div class="word-header">
    <span class="word-label">{stepGrid.word}</span>
    <span class="beat-count">{stepGrid.steps.length} beats</span>
  </div>

  <div class="steps-grid">
    {#each stepGrid.steps as step}
      {@const imageUrl = images.get(step.stepNumber)}
      <div class="step-item" class:is-start={step.stepNumber === 0}>
        <div class="step-label">{step.label}</div>
        <div class="pictograph-container">
          {#if imageUrl}
            <img src={imageUrl} alt="{step.label}: {step.letter}" />
          {:else}
            <div class="placeholder">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            </div>
          {/if}
        </div>
        <div class="step-letter">{step.letter}</div>
        <div class="step-positions">
          {step.startPosition} → {step.endPosition}
        </div>
      </div>
    {/each}
  </div>

  {#if stepGrid.caption}
    <figcaption class="grid-caption">{stepGrid.caption}</figcaption>
  {/if}

  {#if loading && loadedCount < stepGrid.steps.length}
    <div class="loading-indicator">
      Loading {loadedCount}/{stepGrid.steps.length} steps
    </div>
  {/if}
</figure>

<style>
  .inline-step-grid {
    margin: 12px 0;
    padding: 0;
    width: 100%;
  }

  .word-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .word-label {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.05em;
  }

  .beat-count {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    padding: 2px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 10px;
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    transition: border-color var(--duration-fast, 0.15s) ease;
  }

  .step-item:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .step-item.is-start {
    border-color: var(--theme-accent, #a855f7);
    border-width: 2px;
  }

  .step-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    padding: 2px 8px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.5));
    border-radius: 4px;
  }

  .step-item.is-start .step-label {
    background: var(--theme-accent, #a855f7);
    color: #ffffff;
  }

  .pictograph-container {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pictograph-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 6px;
  }

  .placeholder {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 20px;
  }

  .step-letter {
    font-size: 16px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .step-positions {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .grid-caption {
    margin-top: 12px;
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
    font-style: italic;
  }

  .loading-indicator {
    margin-top: 8px;
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    text-align: center;
  }

  /* Mobile: 2 columns */
  @media (max-width: 480px) {
    .steps-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .placeholder i {
      animation: none;
    }

    .step-item {
      transition: none;
    }
  }
</style>
