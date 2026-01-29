<!--
TKAGlyph.svelte - Modern Rune-Based TKA Glyph Component

Renders letters, turn indicators, and other TKA notation elements.
Uses pure runes instead of stores for reactivity.
-->
<script lang="ts" module>
  import { getLetterImagePath as getPath } from "../utils/letter-image-getter";
  import { Letter as LetterType } from "$lib/shared/foundation/domain/models/Letter";

  // ============================================================================
  // HMR-AWARE MODULE-LEVEL CACHES
  // ============================================================================
  // These caches are shared across ALL TKAGlyph instances to prevent redundant
  // SVG fetches. They're persisted across HMR to avoid mass network requests
  // when code changes trigger module reloads.
  //
  // Without HMR persistence, every TKAGlyph on screen would refetch its SVG
  // after any file change, causing 1000+ network requests and 20+ second delays.
  // ============================================================================

  // Restore caches from HMR data if available, otherwise create fresh
  const globalDimensionsCache: Map<string, { width: number; height: number }> =
    import.meta.hot?.data?.dimensionsCache ?? new Map();
  const globalSvgDataUrlCache: Map<string, string> =
    import.meta.hot?.data?.svgDataUrlCache ?? new Map();
  const globalLoadingPromises = new Map<
    string,
    Promise<{ width: number; height: number }>
  >(); // Not persisted - in-flight requests should restart

  // Persist caches before HMR disposal
  if (import.meta.hot) {
    import.meta.hot.dispose((data) => {
      data.dimensionsCache = globalDimensionsCache;
      data.svgDataUrlCache = globalSvgDataUrlCache;
    });
  }

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
   * Call this before animation starts to prevent flash on first render.
   * Caches both dimensions AND the SVG as a data URL for instant rendering.
   * Returns a promise that resolves when all letters are cached.
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
        // Already cached - skip
        if (
          globalDimensionsCache.has(letter) &&
          globalSvgDataUrlCache.has(letter)
        )
          return;

        // Already loading - wait for it
        if (globalLoadingPromises.has(letter)) {
          await globalLoadingPromises.get(letter);
          return;
        }

        // Load and cache
        const loadPromise = (async () => {
          try {
            const svgPath = getPath(letter as LetterType);
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

            // Cache dimensions
            globalDimensionsCache.set(letter, dims);

            // Cache SVG as data URL for instant rendering (no network request needed)
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
  import type { PictographData } from "../../shared/domain/models/PictographData";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import {
    getLetterImagePath,
    isDashLetter,
  } from "../utils/letter-image-getter";
  import { onMount, tick } from "svelte";
  import Dash from "./Dash.svelte";

  let {
    letter,
    x = 50, // Match legacy positioning exactly
    y = 800, // Match legacy positioning exactly
    pictographData = undefined,
    scale = 1, // Match legacy default scale
    visible = true,
    previewMode = false,
    onToggle = undefined,
    // Dark Mode override for export (when set, applies filter override)
    darkMode = undefined,
    // Disable scale-pulse animation on letter change (for animation canvas overlay)
    disableChangeAnimation = false,
  } = $props<{
    /** The letter to display */
    letter: string | null | undefined;
    /** Position X coordinate */
    x?: number;
    /** Position Y coordinate */
    y?: number;
    /** Full pictograph data for turn color interpretation */
    pictographData?: PictographData | null;
    /** Scale factor - match legacy behavior */
    scale?: number;
    /** Visibility control for fade effect */
    visible?: boolean;
    /** Preview mode: show at 50% opacity when off instead of hidden */
    previewMode?: boolean;
    /** Callback when glyph is clicked to toggle visibility */
    onToggle?: () => void;
    /** Dark Mode override for export. When set, applies filter override. */
    darkMode?: boolean;
    /** Disable scale-pulse animation when letter changes */
    disableChangeAnimation?: boolean;
  }>();

  // Letter dimensions state - match legacy behavior
  // Initialize with sensible defaults to prevent flash on first render
  // The actual dimensions will be loaded async and update if different
  let letterDimensions = $state({ width: 100, height: 100 });

  // Local SVG data URL for this component instance (avoids global state reactivity issues)
  let localSvgDataUrl = $state<string | null>(null);

  // Image source - uses local cached URL if available
  const imageSrc = $derived.by(() => {
    if (!letter) return "";
    // Use local cached URL if available, otherwise fall back to file path
    return localSvgDataUrl ?? getLetterImagePath(letter as Letter);
  });

  // Check if image is ready (has cached data URL)
  const imageReady = $derived(localSvgDataUrl !== null);

  // Load letter dimensions and SVG data URL using cache
  // Uses global cache to prevent duplicate fetches across all TKAGlyph instances
  async function loadLetterData(currentLetter: Letter) {
    if (!currentLetter) return;

    const cacheKey = currentLetter;

    // Check global cache first (fastest path) - sync access for instant render
    if (globalDimensionsCache.has(cacheKey)) {
      letterDimensions = globalDimensionsCache.get(cacheKey)!;
    }
    if (globalSvgDataUrlCache.has(cacheKey)) {
      // Already cached - set local state
      localSvgDataUrl = globalSvgDataUrlCache.get(cacheKey)!;
      return;
    }

    // Check if already loading (prevents duplicate concurrent fetches)
    if (globalLoadingPromises.has(cacheKey)) {
      await globalLoadingPromises.get(cacheKey);
      // After loading completes, grab from cache
      if (globalDimensionsCache.has(cacheKey)) {
        letterDimensions = globalDimensionsCache.get(cacheKey)!;
      }
      if (globalSvgDataUrlCache.has(cacheKey)) {
        localSvgDataUrl = globalSvgDataUrlCache.get(cacheKey)!;
      }
      return;
    }

    // Create loading promise for deduplication
    const loadPromise = (async () => {
      try {
        const svgPath = getLetterImagePath(currentLetter as Letter);
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

        // Cache dimensions
        globalDimensionsCache.set(cacheKey, dims);

        // Cache SVG as data URL for instant rendering
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

    // Update local state with cached URL
    if (globalSvgDataUrlCache.has(cacheKey)) {
      localSvgDataUrl = globalSvgDataUrlCache.get(cacheKey)!;
    }
  }

  // Load data when letter changes - reset local cache first
  $effect(() => {
    if (letter) {
      // Reset local URL when letter changes to avoid showing wrong letter briefly
      localSvgDataUrl = globalSvgDataUrlCache.get(letter) ?? null;
      // Then load if not already cached
      if (!localSvgDataUrl) {
        loadLetterData(letter as Letter);
      } else {
        // Also update dimensions from cache
        if (globalDimensionsCache.has(letter)) {
          letterDimensions = globalDimensionsCache.get(letter)!;
        }
      }
    }
  });

  // Derived state - check if we have a valid letter
  const hasLetter = $derived.by(() => {
    return letter != null && letter.trim() !== "";
  });

  // Check if letter dimensions are loaded
  const dimensionsLoaded = $derived.by(
    () => letterDimensions.width > 0 && letterDimensions.height > 0
  );

  // Check if this letter needs a separate dash rendered
  const showDash = $derived(isDashLetter(letter));

  // ============================================================================
  // LETTER CHANGE ANIMATION
  // ============================================================================
  // Track letter changes to trigger a subtle scale-pulse animation.
  // When the letter swaps, we briefly scale down then back up to draw
  // attention to the change without being jarring.

  let previousLetter = $state<string | null>(null);
  let isAnimatingChange = $state(false);

  // Center point for scale animation (so it pops "towards" the user, not from an edge)
  const centerX = $derived(letterDimensions.width / 2);
  const centerY = $derived(letterDimensions.height / 2);

  $effect(() => {
    const currentLetter = letter ?? null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    // Skip animation on initial mount (previousLetter is null)
    // Only animate when letter actually changes to a different value
    // Also skip if animation is disabled (e.g., in animation canvas overlay)
    if (
      !disableChangeAnimation &&
      previousLetter !== null &&
      currentLetter !== previousLetter &&
      currentLetter !== null
    ) {
      // Trigger the scale-pulse animation
      isAnimatingChange = true;

      // Remove the animation class after the animation completes (200ms)
      timeout = setTimeout(() => {
        isAnimatingChange = false;
      }, 200);
    }

    // Update previous letter for next comparison
    previousLetter = currentLetter;

    // Cleanup timeout if effect re-runs
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  });
</script>

<!-- TKA Glyph Group - only render when dimensions are loaded AND when visible
     NOTE: We check visibility here (not just CSS) because when exporting to SVG/image,
     CSS classes don't carry over - only the raw SVG markup is captured.
     Preview mode allows rendering at reduced opacity even when not visible.
     CRITICAL: When darkMode is explicitly set (for export), we apply inline style
     because CSS filter won't be captured in outerHTML. -->
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
    <!-- Inner group for scale animation - scales from center of letter -->
    <g
      class="letter-content"
      class:animating-change={isAnimatingChange}
      style="transform-origin: {centerX}px {centerY}px"
    >
      <!-- Main letter with exact legacy dimensions -->
      <!-- Uses cached data URL if available for instant rendering, otherwise falls back to file path -->
      <image
        x="0"
        y="0"
        href={imageSrc}
        width={letterDimensions.width}
        height={letterDimensions.height}
        preserveAspectRatio="xMinYMin meet"
        class="letter-image"
      />

      <!-- Dash for Type3/Type5 letters (rendered separately for dot centering) -->
      <!-- Note: Dash is inside this TKAGlyph group, so the filter: invert() handles dark mode -->
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
    /* Glyphs are rendered on top layer above arrows */
    z-index: 4;
    /* Beautiful fade in/out effect */
    opacity: 0;
    transition:
      opacity var(--duration-fast) ease-out,
      filter var(--duration-fast) ease-out;
  }

  /* Inner content group for scale animation - transform-origin is set inline based on letter dimensions */

  /* Subtle scale-pulse animation when letter changes - pops "towards" user */
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

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .letter-content.animating-change {
      animation: none;
    }
  }

  .tka-glyph.visible {
    opacity: 1;
  }

  /* Preview mode: show "off" state at 40% opacity instead of hidden */
  .tka-glyph.preview-mode:not(.visible) {
    opacity: 0.4;
  }

  .tka-glyph.interactive {
    cursor: pointer;
    pointer-events: auto;
  }

  /* When visible, maintain full opacity even on hover */
  .tka-glyph.visible.interactive:hover {
    opacity: 0.9;
  }

  /* When not visible in preview mode, dim on hover */
  .tka-glyph.preview-mode:not(.visible).interactive:hover {
    opacity: 0.5;
  }

  .letter-image {
    /* Smooth image rendering */
    image-rendering: optimizeQuality;
  }

  /* Dark mode: invert letter color for dark backgrounds */
  /* Uses CSS-first approach - triggered by .dark class on <html> element */
  :global(:root.dark) .tka-glyph {
    filter: invert(0.9);
  }

  /* Dark mode override (for export with darkMode=true) */
  .tka-glyph.dark-mode-override {
    filter: invert(0.9);
  }

  /* Light mode override (for export with darkMode=false) - overrides :root.dark */
  .tka-glyph.light-mode-override {
    filter: none !important;
  }
</style>
