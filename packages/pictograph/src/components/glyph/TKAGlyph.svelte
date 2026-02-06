<!--
TKAGlyph.svelte - TKA Letter Component

Renders letters with exact scribe positioning (x=50, y=800, scale=1).
Uses module-level caches for SVG data URLs and dimensions.

Ported from scribe's TKAGlyph with config injection.
-->
<script lang="ts" module>
  import { getLetterImagePath as getPath } from "../../utils/letter-image-getter";

  // Module-level caches shared across all instances
  const globalDimensionsCache = new Map<string, { width: number; height: number }>();
  const globalSvgDataUrlCache = new Map<string, string>();
  const globalLoadingPromises = new Map<string, Promise<{ width: number; height: number }>>();

  /**
   * Get cached data URL for a letter, or null if not cached.
   */
  export function getCachedSvgDataUrl(letter: string): string | null {
    return globalSvgDataUrlCache.get(letter) ?? null;
  }

  /**
   * Get cached dimensions for a letter, or default if not cached.
   * Used by TurnsColumn to position turn numbers to the right of the letter.
   */
  export function getLetterDimensions(letter: string | null | undefined): {
    width: number;
    height: number;
  } {
    if (!letter) return { width: 100, height: 100 };
    return globalDimensionsCache.get(letter) ?? { width: 100, height: 100 };
  }

  /**
   * Preload letter SVGs for a list of letters.
   * Caches both dimensions AND the SVG as a data URL for instant rendering.
   */
  export async function preloadLetterDimensions(
    letters: (string | null | undefined)[]
  ): Promise<void> {
    const uniqueLetters = [
      ...new Set(
        letters.filter((l): l is string => l != null && l.trim() !== "")
      ),
    ];

    await Promise.all(
      uniqueLetters.map(async (letter) => {
        if (
          globalDimensionsCache.has(letter) &&
          globalSvgDataUrlCache.has(letter)
        )
          return;

        if (globalLoadingPromises.has(letter)) {
          await globalLoadingPromises.get(letter);
          return;
        }

        const loadPromise = (async () => {
          try {
            const svgPath = getPath(letter);
            const response = await fetch(svgPath);
            if (!response.ok) throw new Error(`Failed to fetch ${svgPath}`);

            const svgText = await response.text();
            const viewBoxMatch = svgText.match(
              /viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)"/i
            );

            const dims = viewBoxMatch
              ? {
                  width: parseFloat(viewBoxMatch[1] || "100"),
                  height: parseFloat(viewBoxMatch[2] || "100"),
                }
              : { width: 100, height: 100 };

            globalDimensionsCache.set(letter, dims);

            const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
            globalSvgDataUrlCache.set(letter, dataUrl);

            return dims;
          } catch (error) {
            console.error(
              `Failed to preload letter dimensions for ${letter}:`,
              error
            );
            return { width: 50, height: 50 };
          } finally {
            globalLoadingPromises.delete(letter);
          }
        })();

        globalLoadingPromises.set(letter, loadPromise);
        await loadPromise;
      })
    );
  }
</script>

<script lang="ts">
  import {
    getLetterImagePath,
    isDashLetter,
  } from "../../utils/letter-image-getter";
  import Dash from "../Dash.svelte";

  let {
    letter,
    x = 50,
    y = 800,
    pictographData = undefined,
    scale = 1,
    visible = true,
    previewMode = false,
    onToggle = undefined,
    darkMode = undefined,
    disableChangeAnimation = false,
  } = $props<{
    letter: string | null | undefined;
    x?: number;
    y?: number;
    pictographData?: any;
    scale?: number;
    visible?: boolean;
    previewMode?: boolean;
    onToggle?: () => void;
    darkMode?: boolean;
    disableChangeAnimation?: boolean;
  }>();

  let letterDimensions = $state({ width: 100, height: 100 });
  let localSvgDataUrl = $state<string | null>(null);

  const imageSrc = $derived.by(() => {
    if (!letter) return "";
    return localSvgDataUrl ?? getLetterImagePath(letter);
  });

  const imageReady = $derived(localSvgDataUrl !== null);

  async function loadLetterData(currentLetter: string) {
    if (!currentLetter) return;

    const cacheKey = currentLetter;

    if (globalDimensionsCache.has(cacheKey)) {
      letterDimensions = globalDimensionsCache.get(cacheKey)!;
    }
    if (globalSvgDataUrlCache.has(cacheKey)) {
      localSvgDataUrl = globalSvgDataUrlCache.get(cacheKey)!;
      return;
    }

    if (globalLoadingPromises.has(cacheKey)) {
      await globalLoadingPromises.get(cacheKey);
      if (globalDimensionsCache.has(cacheKey)) {
        letterDimensions = globalDimensionsCache.get(cacheKey)!;
      }
      if (globalSvgDataUrlCache.has(cacheKey)) {
        localSvgDataUrl = globalSvgDataUrlCache.get(cacheKey)!;
      }
      return;
    }

    const loadPromise = (async () => {
      try {
        const svgPath = getLetterImagePath(currentLetter);
        const response = await fetch(svgPath);
        if (!response.ok)
          throw new Error(`Failed to fetch ${svgPath}: ${response.status}`);

        const svgText = await response.text();
        const viewBoxMatch = svgText.match(
          /viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)"/i
        );

        let dims: { width: number; height: number };
        if (!viewBoxMatch) {
          dims = { width: 100, height: 100 };
        } else {
          dims = {
            width: parseFloat(viewBoxMatch[1] || "100"),
            height: parseFloat(viewBoxMatch[2] || "100"),
          };
        }

        globalDimensionsCache.set(cacheKey, dims);

        const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
        globalSvgDataUrlCache.set(cacheKey, dataUrl);

        return dims;
      } catch (error) {
        console.error(
          `Failed to load letter data for ${currentLetter}:`,
          error
        );
        return { width: 50, height: 50 };
      } finally {
        globalLoadingPromises.delete(cacheKey);
      }
    })();

    globalLoadingPromises.set(cacheKey, loadPromise);
    letterDimensions = await loadPromise;

    if (globalSvgDataUrlCache.has(cacheKey)) {
      localSvgDataUrl = globalSvgDataUrlCache.get(cacheKey)!;
    }
  }

  $effect(() => {
    if (letter) {
      localSvgDataUrl = globalSvgDataUrlCache.get(letter) ?? null;
      if (!localSvgDataUrl) {
        loadLetterData(letter);
      } else {
        if (globalDimensionsCache.has(letter)) {
          letterDimensions = globalDimensionsCache.get(letter)!;
        }
      }
    }
  });

  const hasLetter = $derived.by(() => {
    return letter != null && letter.trim() !== "";
  });

  const dimensionsLoaded = $derived.by(
    () => letterDimensions.width > 0 && letterDimensions.height > 0
  );

  const showDash = $derived(isDashLetter(letter));

  // Letter change animation
  let previousLetter = $state<string | null>(null);
  let isAnimatingChange = $state(false);

  const centerX = $derived(letterDimensions.width / 2);
  const centerY = $derived(letterDimensions.height / 2);

  $effect(() => {
    const currentLetter = letter ?? null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (
      !disableChangeAnimation &&
      previousLetter !== null &&
      currentLetter !== previousLetter &&
      currentLetter !== null
    ) {
      isAnimatingChange = true;
      timeout = setTimeout(() => {
        isAnimatingChange = false;
      }, 200);
    }

    previousLetter = currentLetter;

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  });
</script>

{#if hasLetter && dimensionsLoaded && (visible || previewMode)}
  <g
    class="tka-glyph"
    class:visible={visible && imageReady}
    class:preview-mode={previewMode}
    class:interactive={onToggle !== undefined}
    class:dark-mode-override={darkMode === true}
    class:light-mode-override={darkMode === false}
    style={darkMode === true ? "filter: invert(0.9)" : darkMode === false ? "filter: none" : undefined}
    data-letter={letter}
    transform="translate({x}, {y}) scale({scale})"
    onclick={onToggle}
    {...onToggle
      ? {
          role: "button",
          tabindex: 0,
          "aria-label": "Toggle TKA letter visibility",
        }
      : {}}
  >
    <g
      class="letter-content"
      class:animating-change={isAnimatingChange}
      style="transform-origin: {centerX}px {centerY}px"
    >
      <image
        x="0"
        y="0"
        href={imageSrc}
        width={letterDimensions.width}
        height={letterDimensions.height}
        preserveAspectRatio="xMinYMin meet"
        class="letter-image"
      />

      {#if showDash}
        <Dash
          letterWidth={letterDimensions.width}
          letterHeight={letterDimensions.height}
          {visible}
          {previewMode}
        />
      {/if}
    </g>
  </g>
{/if}

<style>
  .tka-glyph {
    z-index: 4;
    opacity: 0;
    transition:
      opacity var(--duration-fast, 150ms) ease-out,
      filter var(--duration-fast, 150ms) ease-out;
  }

  @keyframes letter-change-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.91);
    }
    100% {
      transform: scale(1);
    }
  }

  .letter-content.animating-change {
    animation: letter-change-pulse 180ms ease-in-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .letter-content.animating-change {
      animation: none;
    }
  }

  .tka-glyph.visible {
    opacity: 1;
  }

  .tka-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .tka-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  .tka-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  .tka-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  .letter-image {
    image-rendering: optimizeQuality;
  }

  :global(:root.dark) .tka-glyph {
    filter: invert(0.9);
  }

  .tka-glyph.dark-mode-override {
    filter: invert(0.9);
  }

  .tka-glyph.light-mode-override {
    filter: none !important;
  }
</style>
