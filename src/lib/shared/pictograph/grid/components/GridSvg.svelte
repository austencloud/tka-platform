<!--
GridSvg.svelte - Grid Component with Beautiful Rotation Animation

Loads diamond grid and rotates it 45° with cumulative rotation.
Pure reactive approach - grid mode determines styling, rotation provides animation.
-->
<script lang="ts">
  import { GridMode } from "../domain/enums/grid-enums";
  import { resolve, TYPES } from "../../../inversify/di";
  import type { ISvgPreloader } from "../../shared/services/contracts/ISvgPreloader";
  import { getGridRotationDirection } from "../state/grid-rotation-state.svelte";

  let {
    gridMode = GridMode.DIAMOND,
    showNonRadialPoints = false,
    previewMode = false,
    onLoaded,
    onError,
    onToggleNonRadial = undefined,
  } = $props<{
    /** Grid mode - derived from motion data */
    gridMode?: GridMode;
    /** Show non-radial points (layer 2 diagonal points) */
    showNonRadialPoints?: boolean;
    /** Preview mode: show "off" elements at 40% opacity instead of hidden */
    previewMode?: boolean;
    /** Called when grid is successfully loaded */
    onLoaded?: () => void;
    /** Called when grid loading fails */
    onError?: (error: string) => void;
    /** Callback when non-radial points are clicked to toggle visibility */
    onToggleNonRadial?: () => void;
  }>();

  // State
  // NOTE: Grid colors are handled by CSS via :global(:root.dark ...) selectors
  // This allows smooth color transitions when dark mode toggles
  let hasError = $state(false);
  let errorMessage = $state<string | null>(null);
  let baseGridSvg = $state<string>("");

  // Track cumulative rotation for beautiful animation (ephemeral UI state)
  // Initialize to 0; $effect below sets correct initial value and handles changes
  let cumulativeRotation = $state(0);
  // Track previous gridMode for change detection (null = first render)
  let previousGridMode: GridMode | null = null;

  // Get SVG preload service
  const SvgPreloader = resolve(TYPES.ISvgPreloader) as ISvgPreloader;

  // Load diamond grid (we rotate it to create box appearance)
  async function loadGrid(): Promise<void> {
    try {
      const svgText = await SvgPreloader.getSvgContent("grid", "diamond_grid");
      baseGridSvg = svgText;
      onLoaded?.();
    } catch (error) {
      hasError = true;
      errorMessage = "Failed to load grid";
      onError?.(errorMessage);
      throw error;
    }
  }

  // Styled grid content - reactively updates when gridMode or previewMode changes
  // IMPORTANT: Does NOT depend on gridColor - CSS handles color transitions for smooth animation
  // In preview mode, we DON'T depend on showNonRadialPoints to avoid re-rendering (CSS handles opacity transitions)
  const styledGridSvg = $derived.by(() => {
    if (!baseGridSvg) return "";
    // In preview mode, always pass false for showNonRadial since CSS classes handle visibility
    // This prevents SVG re-rendering when toggling, allowing CSS transitions to work
    const effectiveShowNonRadial = previewMode ? false : showNonRadialPoints;
    return applyGridModeStyles(
      baseGridSvg,
      gridMode,
      effectiveShowNonRadial,
      previewMode
    );
  });

  // Load grid on mount
  loadGrid();

  // Apply grid mode styling directly to SVG elements as inline attributes
  // COLORS are handled by CSS with transitions - only structure/opacity is set inline
  // This allows smooth dark mode color transitions while maintaining correct exports
  function applyGridModeStyles(
    svgContent: string,
    mode: GridMode,
    showNonRadial: boolean,
    isPreviewMode: boolean
  ): string {
    const outerPointIds = [
      "n_diamond_outer_point",
      "e_diamond_outer_point",
      "s_diamond_outer_point",
      "w_diamond_outer_point",
    ];

    const nonRadialPointIds = [
      "ne_diamond_layer2_point",
      "se_diamond_layer2_point",
      "sw_diamond_layer2_point",
      "nw_diamond_layer2_point",
    ];

    let modifiedSvg = svgContent;

    // For outer points, set structural attributes (opacity values for mode switching)
    // Colors are handled by CSS for smooth dark mode transitions
    // Diamond mode: filled circles (fill visible, stroke hidden)
    // Box mode: outlined circles (fill hidden, stroke visible)
    const fillOpacity = mode === GridMode.DIAMOND ? "1" : "0";
    const strokeOpacity = mode === GridMode.DIAMOND ? "0" : "1";

    for (const id of outerPointIds) {
      const circlePattern = new RegExp(
        `(<circle[^>]*id="${id}"[^>]*)(/>)`,
        "g"
      );

      modifiedSvg = modifiedSvg.replace(
        circlePattern,
        (match, opening, closing) => {
          // Remove existing opacity and stroke attributes (not fill/stroke colors - CSS handles those)
          let cleaned = opening.replace(/\s*fill-opacity="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke-opacity="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke-width="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke-miterlimit="[^"]*"/g, "");

          // Add structural attributes - CSS handles fill/stroke colors
          return `${cleaned} fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" stroke-width="13" stroke-miterlimit="10"${closing}`;
        }
      );
    }

    // Set opacity for non-radial points based on visibility setting
    // In preview mode, DON'T set inline opacity - let CSS handle it for smooth transitions
    // Colors are handled by CSS for smooth dark mode transitions
    const nonRadialOpacity = showNonRadial ? "1" : "0";

    for (const id of nonRadialPointIds) {
      const circlePattern = new RegExp(
        `(<circle[^>]*id="${id}"[^>]*)(/>)`,
        "g"
      );

      modifiedSvg = modifiedSvg.replace(
        circlePattern,
        (match, opening, closing) => {
          // Remove any existing opacity attribute
          let cleaned = opening.replace(/\s*opacity="[^"]*"/g, "");

          // In preview mode, skip inline opacity to allow CSS transitions
          // Colors handled by CSS regardless
          if (isPreviewMode) {
            return `${cleaned}${closing}`;
          }
          return `${cleaned} opacity="${nonRadialOpacity}"${closing}`;
        }
      );
    }

    // Hand points and center point: CSS handles their colors via :global selectors
    // No inline color modification needed - CSS transitions will work

    // Lines: CSS handles their stroke colors via :global selectors
    // No inline stroke modification needed - CSS transitions will work

    return modifiedSvg;
  }

  // Track the grid container element for animations
  let gridContainerElement = $state<SVGGElement | undefined>();

  // Cubic bezier easing function - implements CSS cubic-bezier
  // Standard "ease" is cubic-bezier(0.25, 0.1, 0.25, 1.0)
  function cubicBezier(
    t: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number
  ): number {
    // Simple approximation for cubic bezier with x coordinates at 0 and 1
    // Using Newton-Raphson method for better accuracy
    const cx = 3.0 * p1x;
    const bx = 3.0 * (p2x - p1x) - cx;
    const ax = 1.0 - cx - bx;

    const cy = 3.0 * p1y;
    const by = 3.0 * (p2y - p1y) - cy;
    const ay = 1.0 - cy - by;

    // Solve for t given x using Newton-Raphson
    let x = t;
    for (let i = 0; i < 8; i++) {
      const z = ((ax * x + bx) * x + cx) * x - t;
      if (Math.abs(z) < 1e-7) break;
      const d = (3.0 * ax * x + 2.0 * bx) * x + cx;
      if (Math.abs(d) < 1e-7) break;
      x = x - z / d;
    }

    // Calculate y from solved t
    return ((ay * x + by) * x + cy) * x;
  }

  // Increment cumulative rotation by 45° with smooth animation whenever gridMode changes
  // Use global rotation direction to determine clockwise (+45) or counterclockwise (-45)
  $effect(() => {
    // First render - set initial rotation without animation
    if (previousGridMode === null) {
      cumulativeRotation = gridMode === GridMode.BOX ? 45 : 0;
      previousGridMode = gridMode;
      return;
    }

    // No change - do nothing
    if (gridMode === previousGridMode) return;

    const previousRotation = cumulativeRotation;
    const direction = getGridRotationDirection();
    const newRotation = cumulativeRotation + 45 * direction;

    // Animate rotation smoothly if element is available
    if (gridContainerElement) {
      // Capture element reference for use in animate callback
      const element = gridContainerElement;
      // Use requestAnimationFrame for smooth SVG transform animation
      const startTime = performance.now();
      const duration = 200; // ms - matches arrow/prop transition duration

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Standard CSS "ease" timing function: cubic-bezier(0.25, 0.1, 0.25, 1.0)
        // Matches the easing used by arrows and props
        const eased = cubicBezier(progress, 0.25, 0.1, 0.25, 1.0);

        const currentRotation =
          previousRotation + (newRotation - previousRotation) * eased;
        element.setAttribute(
          "transform",
          `rotate(${currentRotation}, 475, 475)`
        );

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure final value is exact
          element.setAttribute("transform", `rotate(${newRotation}, 475, 475)`);
        }
      };

      requestAnimationFrame(animate);
    }

    cumulativeRotation = newRotation;
    previousGridMode = gridMode;
  });
</script>

<!-- Grid Container - Rotates cumulatively by 45° each time -->
<g
  bind:this={gridContainerElement}
  class="grid-container"
  class:box-mode={gridMode === GridMode.BOX}
  class:show-non-radial={showNonRadialPoints}
  class:preview-mode={previewMode}
  class:interactive-non-radial={onToggleNonRadial !== undefined}
  data-grid-mode={gridMode}
  transform="rotate({cumulativeRotation}, 475, 475)"
>
  {#if !hasError && styledGridSvg}
    <g class="grid-layer">
      {@html styledGridSvg}
    </g>

    <!-- Clickable overlay for non-radial points -->
    {#if onToggleNonRadial}
      <g
        class="non-radial-click-overlay"
        onclick={onToggleNonRadial}
        onkeydown={(e) =>
          e.key === "Enter" || e.key === " " ? onToggleNonRadial?.() : null}
        role="button"
        tabindex="0"
        aria-label="Toggle non-radial points visibility"
      >
        <!-- Invisible clickable areas over each non-radial point -->
        <circle cx="730" cy="220" r="30" fill="transparent" />
        <circle cx="730" cy="730" r="30" fill="transparent" />
        <circle cx="220" cy="730" r="30" fill="transparent" />
        <circle cx="220" cy="220" r="30" fill="transparent" />
      </g>
    {/if}
  {/if}
</g>

<style>
  .grid-container {
    z-index: 1;
  }

  /* Note: CSS transitions don't work with SVG transform attributes.
     To add smooth rotation animations in the future, we would need to use:
     - SMIL animations (<animateTransform>)
     - JavaScript-based animations
     - Web Animations API
     For now, grid rotation changes are instant (which is fine for export). */

  /* Outer points - animate opacity for smooth morph */
  :global(#n_diamond_outer_point),
  :global(#e_diamond_outer_point),
  :global(#s_diamond_outer_point),
  :global(#w_diamond_outer_point) {
    fill: #000;
    stroke: #000;
    stroke-width: 13;
    stroke-miterlimit: 10;
    transition:
      fill-opacity 0.2s ease,
      stroke-opacity 0.2s ease,
      fill 0.2s ease,
      stroke 0.2s ease;
  }

  /* Dark mode - outer points use light color */
  :global(:root.dark #n_diamond_outer_point),
  :global(:root.dark #e_diamond_outer_point),
  :global(:root.dark #s_diamond_outer_point),
  :global(:root.dark #w_diamond_outer_point) {
    fill: var(--dm-grid-color, #d0d0d0);
    stroke: var(--dm-grid-color, #d0d0d0);
  }

  /* Diamond mode - filled circles */
  :global(.grid-container:not(.box-mode) #n_diamond_outer_point),
  :global(.grid-container:not(.box-mode) #e_diamond_outer_point),
  :global(.grid-container:not(.box-mode) #s_diamond_outer_point),
  :global(.grid-container:not(.box-mode) #w_diamond_outer_point) {
    fill-opacity: 1;
    stroke-opacity: 0;
  }

  /* Box mode - outlined circles */
  :global(.grid-container.box-mode #n_diamond_outer_point),
  :global(.grid-container.box-mode #e_diamond_outer_point),
  :global(.grid-container.box-mode #s_diamond_outer_point),
  :global(.grid-container.box-mode #w_diamond_outer_point) {
    fill-opacity: 0;
    stroke-opacity: 1;
  }

  /* Non-radial points - layer 2 diagonal points */
  :global(#ne_diamond_layer2_point),
  :global(#se_diamond_layer2_point),
  :global(#sw_diamond_layer2_point),
  :global(#nw_diamond_layer2_point) {
    fill: #000;
    opacity: 0;
    transition:
      opacity 0.2s ease,
      fill 0.2s ease;
  }

  /* Dark mode - non-radial points use light color */
  :global(:root.dark #ne_diamond_layer2_point),
  :global(:root.dark #se_diamond_layer2_point),
  :global(:root.dark #sw_diamond_layer2_point),
  :global(:root.dark #nw_diamond_layer2_point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  /* Show non-radial points when enabled */
  :global(.grid-container.show-non-radial #ne_diamond_layer2_point),
  :global(.grid-container.show-non-radial #se_diamond_layer2_point),
  :global(.grid-container.show-non-radial #sw_diamond_layer2_point),
  :global(.grid-container.show-non-radial #nw_diamond_layer2_point) {
    opacity: 1;
  }

  /* Preview mode: show "off" non-radial points at 40% opacity instead of hidden */
  :global(
    .grid-container.preview-mode:not(.show-non-radial) #ne_diamond_layer2_point
  ),
  :global(
    .grid-container.preview-mode:not(.show-non-radial) #se_diamond_layer2_point
  ),
  :global(
    .grid-container.preview-mode:not(.show-non-radial) #sw_diamond_layer2_point
  ),
  :global(
    .grid-container.preview-mode:not(.show-non-radial) #nw_diamond_layer2_point
  ) {
    opacity: 0.4;
  }

  /* Interactive non-radial points - show cursor pointer */
  :global(.grid-container.interactive-non-radial #ne_diamond_layer2_point),
  :global(.grid-container.interactive-non-radial #se_diamond_layer2_point),
  :global(.grid-container.interactive-non-radial #sw_diamond_layer2_point),
  :global(.grid-container.interactive-non-radial #nw_diamond_layer2_point) {
    cursor: pointer;
  }

  /* Click overlay for non-radial points */
  .non-radial-click-overlay {
    cursor: pointer;
  }

  /* Focus styles for accessibility */
  .non-radial-click-overlay:focus-visible {
    outline: 2px solid var(--primary-color, #6366f1);
    outline-offset: 2px;
  }

  /* Hand points - use currentColor by default */
  /* Note: strict-hand-point is NOT styled here - it remains fill:none (hidden) as defined in SVG */
  :global(.normal-hand-point) {
    transition: fill 150ms ease-out;
  }

  /* Dark mode - normal hand points use light color */
  /* Note: strict-hand-point is intentionally excluded - it stays hidden in pictograph */
  :global(:root.dark .normal-hand-point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  /* Center point */
  :global(#center_point) {
    fill: #000;
    transition: fill 150ms ease-out;
  }

  /* Dark mode - center point uses light color */
  :global(:root.dark #center_point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  /* Strict layer 2 points - intentionally NOT styled for dark mode
     These remain fill:none (hidden) as defined in the SVG.
     Strict points are only used for animation mode, not pictograph display. */

  /* Lines between grid points */
  :global(.grid-container line) {
    stroke: #000;
    transition: stroke 0.2s ease;
  }

  /* Dark mode - lines use light color */
  :global(:root.dark .grid-container line) {
    stroke: var(--dm-grid-color, #d0d0d0);
  }
</style>
