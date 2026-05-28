/**
 * Utility for rendering Pictograph component to SVG string
 *
 * This utility mounts a PictographContainer component to a hidden DOM container,
 * waits for it to render, then extracts the SVG string.
 *
 * ARCHITECTURE NOTES:
 * - Uses Svelte 5's mount() API for programmatic component instantiation
 * - Matches desktop approach of grabbing rendered view (QPainter.drawPixmap)
 * - Browser-only utility (requires DOM)
 */

import type { PictographData } from "../../pictograph/shared/domain/models/PictographData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { PropType } from "../../pictograph/prop/domain/enums/PropType";
import PictographContainer from "../../pictograph/shared/components/PictographContainer.svelte";
import { mount, tick, unmount } from "svelte";

/**
 * Visibility settings for pictograph rendering
 * When provided, these override the global visibility settings
 */
export interface PictographVisibilityOptions {
  showTKA?: boolean; // TKA Glyph includes turn numbers
  showTnD?: boolean;
  showElemental?: boolean;
  showPositions?: boolean;
  showReversals?: boolean;
  showNonRadialPoints?: boolean;
  /** Dark Mode - dark background, inverted grid, white text/outlines */
  darkMode?: boolean;
  /** Print Mode - pure white background for professional printing (overrides darkMode) */
  printMode?: boolean;
  /**
   * Explicit prop type for blue hand.
   * When provided, passed through to PictographPreparer to ensure consistency
   * during async rendering. Export/thumbnail rendering always provides this.
   */
  bluePropType?: PropType;
  /**
   * Explicit prop type for red hand.
   * When provided, passed through to PictographPreparer for consistency.
   */
  redPropType?: PropType;
  /**
   * Hand point visibility setting for grid rendering.
   * "all" shows all hand positions, "active" shows only active ones, "none" hides all.
   */
  handPointVisibility?: "all" | "active" | "none";
  /**
   * Whether to show the grid background.
   * When false, hides the entire grid (center, hand points, outer corners).
   */
  showGrid?: boolean;
  /**
   * When true, render only the base grid (center + outer corner points).
   * Hand points and layer 2 points are excluded - they're rendered in a separate layer.
   * Used by LayerCompositor for compositional caching.
   */
  baseGridOnly?: boolean;
  /** Render as hand path visualization (HAND props, float arrows, no TKA) */
  handPathMode?: boolean;
  /** Show blue motion (prop + arrow). When false, renderer skips blue entirely. Default: true. */
  showBlueMotion?: boolean;
  /** Show red motion (prop + arrow). When false, renderer skips red entirely. Default: true. */
  showRedMotion?: boolean;
}

/**
 * Render a Pictograph component to SVG string
 *
 * @param pictographData - StepData or PictographData to render
 * @param size - Size of the SVG viewBox (will be size x size)
 * @param stepNumber - Optional beat number to display (for export)
 * @param visibilityOptions - Optional visibility settings to override global defaults
 * @returns Promise<string> - SVG string ready to be converted to canvas
 */
export async function renderPictographToSVG(
  pictographData: StepData | PictographData,
  size: number = 300,
  stepNumber?: number,
  visibilityOptions?: PictographVisibilityOptions
): Promise<string> {
  // Debug: Log visibility options being passed

  // Create hidden container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  container.style.opacity = "0";
  container.style.pointerEvents = "none";

  document.body.appendChild(container);

  try {
    // Prepare pictograph data with beat number if provided
    // IMPORTANT: Explicitly set stepNumber to undefined when not provided,
    // otherwise the original pictographData.stepNumber will be preserved
    const dataWithBeatNumber =
      stepNumber !== undefined
        ? { ...pictographData, stepNumber }
        : { ...pictographData, stepNumber: undefined };

    // Build props object explicitly (not using spread) to ensure visibility settings are passed
    const componentProps: Record<string, unknown> = {
      pictographData: dataWithBeatNumber,
      disableTransitions: true, // Disable container transitions for export
      disableContentTransitions: true, // Disable content transitions for export
    };

    // Add visibility settings explicitly if provided
    if (visibilityOptions) {
      componentProps.showTKA = visibilityOptions.showTKA; // TKA Glyph includes turn numbers
      componentProps.showTnD = visibilityOptions.showTnD;
      componentProps.showElemental = visibilityOptions.showElemental;
      componentProps.showPositions = visibilityOptions.showPositions;
      componentProps.showReversals = visibilityOptions.showReversals;
      componentProps.showNonRadialPoints =
        visibilityOptions.showNonRadialPoints;
      componentProps.darkMode = visibilityOptions.darkMode; // Dark Mode controls background/grid
      componentProps.printMode = visibilityOptions.printMode; // Print Mode: pure white background
      // Pass explicit prop types through to PictographPreparer for consistency during async rendering
      componentProps.bluePropTypeOverride = visibilityOptions.bluePropType;
      componentProps.redPropTypeOverride = visibilityOptions.redPropType;
      if (visibilityOptions.showBlueMotion !== undefined) {
        componentProps.showBlueMotion = visibilityOptions.showBlueMotion;
      }
      if (visibilityOptions.showRedMotion !== undefined) {
        componentProps.showRedMotion = visibilityOptions.showRedMotion;
      }
    }

    // Mount PictographContainer with explicit visibility settings
    const component = mount(PictographContainer, {
      target: container,
      props: componentProps,
    });

    // Wait for component to fully render
    await tick();

    // CRITICAL: Wait for pictograph services to initialize
    // Services (arrow lifecycle manager, prop loader, etc.) are resolved asynchronously
    // We must wait for initialization before arrows/props can be calculated
    await waitForServicesInitialized(container);

    // CRITICAL: Wait for arrow and prop calculations to complete
    // Arrows and props are calculated asynchronously in effects, and tick() doesn't wait for them
    // We need to poll until they are actually rendered in the DOM
    await waitForArrowsAndPropsCalculated(container, pictographData);

    // CRITICAL: Wait for external images (TKAGlyph letter images) to load
    // The TKAGlyph component uses <image> tags with external SVG references
    // We need to wait for these to load before capturing the SVG
    await waitForImagesLoaded(container);

    // Find the SVG element in the rendered component
    const svgElement = container.querySelector("svg");

    if (!svgElement) {
      throw new Error("Failed to find SVG element in rendered Pictograph");
    }

    // CRITICAL FIX: Calculate actual bounding box of SVG content
    // The viewBox is "0 0 950 950" but content may extend beyond these bounds
    const bbox = svgElement.getBBox();

    // Use the larger of the viewBox or actual content bounds
    const viewBoxWidth = Math.max(950, Math.ceil(bbox.x + bbox.width));
    const viewBoxHeight = Math.max(950, Math.ceil(bbox.y + bbox.height));

    // Set explicit size and viewBox to accommodate all content
    svgElement.setAttribute("width", size.toString());
    svgElement.setAttribute("height", size.toString());
    svgElement.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);

    // Extract SVG string
    const svgString = svgElement.outerHTML;

    // Clean up component
    void unmount(component);

    return svgString;
  } finally {
    // Always clean up container
    document.body.removeChild(container);
  }
}

/**
 * Wait for pictograph services to initialize
 * Services (ArrowLifecycleManager, PropSvgLoader, etc.) are resolved asynchronously
 * This must complete before arrow/prop calculations can begin
 */
async function waitForServicesInitialized(
  container: HTMLElement
): Promise<void> {
  // Poll for signs that services are initialized
  // We can't directly access servicesInitialized flag, but we can detect when
  // the component is ready to render content
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max

  while (attempts < maxAttempts) {
    // Check if the SVG has any meaningful content (grid, etc.)
    const svg = container.querySelector("svg");
    const hasGrid = svg?.querySelector('.grid-svg, [class*="grid"]');

    // If we have a grid, the component is initialized enough to start rendering
    if (hasGrid) {
      // Debug logging disabled to prevent console flooding
      // console.log(
      //   `✅ Services initialized (detected after ${attempts * 100}ms)`
      // );

      // Give effects a moment to start running after service initialization
      await new Promise((resolve) => setTimeout(resolve, 150));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

}

/**
 * Wait for arrow and prop calculations to complete
 * Arrows and props are calculated asynchronously in Svelte effects, which tick() doesn't wait for
 * We poll the DOM until all expected elements are present, ensuring complete rendering
 */
async function waitForArrowsAndPropsCalculated(
  container: HTMLElement,
  pictographData: StepData | PictographData
): Promise<void> {
  // Check if this pictograph should have arrows or props
  const shouldHaveArrows =
    pictographData.motions.blue || pictographData.motions.red;

  if (!shouldHaveArrows) {
    // No motions = no arrows/props expected, return immediately
    return;
  }

  // Count expected arrows and props (blue and/or red)
  let expectedArrowCount = 0;
  let expectedPropCount = 0;
  if (pictographData.motions.blue) {
    expectedArrowCount++;
    expectedPropCount++;
  }
  if (pictographData.motions.red) {
    expectedArrowCount++;
    expectedPropCount++;
  }

  // Poll until arrows and props appear in DOM
  let attempts = 0;
  const maxAttempts = 100; // 10 seconds max (100ms intervals)

  // Debug logging disabled to prevent console flooding
  // console.log(
  //   `🔍 Waiting for ${expectedArrowCount} arrows and ${expectedPropCount} props...`
  // );

  while (attempts < maxAttempts) {
    // Look for arrow SVG elements (they have class "arrow-svg")
    const arrowGroups = container.querySelectorAll(".arrow-svg");

    // Look for prop SVG elements (they have class "prop-svg")
    const propGroups = container.querySelectorAll(".prop-svg");

    // Check if we have expected number of arrows and props
    const hasEnoughArrows = arrowGroups.length >= expectedArrowCount;
    const hasEnoughProps = propGroups.length >= expectedPropCount;

    if (attempts % 10 === 0 && attempts > 0) {
      // Debug logging disabled to prevent console flooding
      // console.log(
      //   `⏳ Still waiting... (${attempts * 100}ms) arrows: ${arrowGroups.length}/${expectedArrowCount}, props: ${propGroups.length}/${expectedPropCount}`
      // );
    }

    if (hasEnoughArrows && hasEnoughProps) {
      // Debug logging disabled to prevent console flooding
      // console.log(
      //   `✅ Arrows and props calculated (found ${arrowGroups.length} arrow groups, ${propGroups.length} prop groups after ${attempts * 100}ms)`
      // );
      return;
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  // Timeout - log warning but continue (better to have incomplete render than fail completely)
  const actualArrowGroups = container.querySelectorAll(".arrow-svg").length;
  const actualPropGroups = container.querySelectorAll(".prop-svg").length;
  console.warn(
    `⚠️ Arrow/prop calculation timeout after ${maxAttempts * 100}ms - ` +
      `expected ${expectedArrowCount} arrows (found ${actualArrowGroups} groups), ` +
      `expected ${expectedPropCount} props (found ${actualPropGroups} groups)`
  );

}

/**
 * Wait for all images in the container to load and TKA glyphs to render
 * This ensures TKA glyph images are fully loaded before capturing SVG
 */
async function waitForImagesLoaded(domContainer: HTMLElement): Promise<void> {
  // First, wait for TKA glyph elements to appear (they render conditionally)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max

  while (attempts < maxAttempts) {
    const tkaGlyphs = domContainer.querySelectorAll(".tka-glyph");
    const images = domContainer.querySelectorAll("image[href]");

    if (tkaGlyphs.length > 0 && images.length > 0) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  // Now wait for the actual images to load
  const images = domContainer.querySelectorAll("image[href]");

  if (images.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return;
  }

  // Use module singleton getter (only in browser contexts where this function runs)
  const { getGlyphCache } = await import("../getGlyphCache");
  const glyphCache = getGlyphCache();

  const imagePromises = Array.from(images).map(async (img) => {
    const imageElement = img as SVGImageElement;
    const href = imageElement.getAttribute("href");

    if (!href) {
      return;
    }

    try {
      // Use lazy-loading cache - fetches on-demand and caches automatically
      const dataUrl = await glyphCache.getOrLoadSvg(href);

      if (dataUrl) {
        imageElement.setAttribute("href", dataUrl);
      }
    } catch (error) {
      console.error(`❌ Error processing image:`, href, error);
    }
  });

  await Promise.all(imagePromises);

  // Small delay to ensure rendering is complete (reduced from 200ms since cache is instant)
  await new Promise((resolve) => setTimeout(resolve, 50));
}
