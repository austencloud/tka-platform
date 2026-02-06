<!--
GridSvg.svelte - Grid Component with Beautiful Rotation Animation

Loads diamond grid and rotates it 45 deg with cumulative rotation.
Pure reactive approach - grid mode determines styling, rotation provides animation.

Ported from scribe's GridSvg with config injection replacing singletons.
-->
<script lang="ts">
  import { GridMode, GridLocation } from "@tka/types";
  import { getPictographConfig } from "../config/pictograph-context";

  let {
    gridMode = GridMode.DIAMOND,
    showNonRadialPoints = false,
    previewMode = false,
    visible = true,
    onLoaded,
    onError,
    onToggleNonRadial = undefined,
    // Dark Mode override for export (when set, applies inline colors)
    darkMode = undefined,
    // Hand point visibility control
    handPointVisibility = "all",
    activeLocations = undefined,
    // Grid rotation direction (scribe passes from global state, landing can default)
    gridRotationDirection = undefined,
  } = $props<{
    /** Grid mode - derived from motion data */
    gridMode?: GridMode;
    /** Show non-radial points (layer 2 diagonal points) */
    showNonRadialPoints?: boolean;
    /** Preview mode: show "off" elements at 40% opacity instead of hidden */
    previewMode?: boolean;
    /** Visibility control for fade effect */
    visible?: boolean;
    /** Called when grid is successfully loaded */
    onLoaded?: () => void;
    /** Called when grid loading fails */
    onError?: (error: string) => void;
    /** Callback when non-radial points are clicked to toggle visibility */
    onToggleNonRadial?: () => void;
    /** Dark Mode override for export. When set, applies inline colors. */
    darkMode?: boolean;
    /** Hand point visibility mode: "all" shows all, "active" shows only where props are */
    handPointVisibility?: "all" | "active";
    /** Locations where props are positioned (used when handPointVisibility="active") */
    activeLocations?: GridLocation[];
    /** Grid rotation direction for animation: 1 = clockwise, -1 = counter */
    gridRotationDirection?: number | "cw" | "ccw" | null;
  }>();

  const config = getPictographConfig();
  const basePath = config.assetBasePath;

  // Map hand point IDs to their grid locations
  const HAND_POINT_LOCATIONS: Record<string, GridLocation> = {
    // Diamond grid hand points
    n_diamond_hand_point: GridLocation.NORTH,
    e_diamond_hand_point: GridLocation.EAST,
    s_diamond_hand_point: GridLocation.SOUTH,
    w_diamond_hand_point: GridLocation.WEST,
    // Box grid hand points (for skewed mode)
    ne_box_hand_point: GridLocation.NORTHEAST,
    se_box_hand_point: GridLocation.SOUTHEAST,
    sw_box_hand_point: GridLocation.SOUTHWEST,
    nw_box_hand_point: GridLocation.NORTHWEST,
  };

  // State
  let hasError = $state(false);
  let errorMessage = $state<string | null>(null);
  let baseGridSvg = $state<string>("");

  // Track cumulative rotation for animation
  let cumulativeRotation = $state(0);
  let previousGridMode: GridMode | null = null;

  // Track which grid is currently loaded
  let loadedGridType = $state<"diamond" | "skewed" | null>(null);

  // Load the appropriate grid based on mode
  async function loadGrid(forMode: GridMode): Promise<void> {
    const needsSkewedGrid = forMode === GridMode.SKEWED;
    const gridFileName = needsSkewedGrid ? "skewed_grid" : "diamond_grid";
    const gridType = needsSkewedGrid ? "skewed" : "diamond";

    // Skip reload if we already have the right grid
    if (loadedGridType === gridType && baseGridSvg) return;

    try {
      const url = `${basePath}/images/grid/${gridFileName}.svg`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}`);
      baseGridSvg = await response.text();
      loadedGridType = gridType;
      onLoaded?.();
    } catch (error) {
      hasError = true;
      errorMessage = `Failed to load ${gridFileName}`;
      onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * Strip outer <svg> wrapper and convert to inner content.
   */
  function stripSvgWrapper(svgContent: string): string {
    let content = svgContent.replace(/<svg[^>]*>/i, "");
    content = content.replace(/<\/svg>/i, "");
    return content.trim();
  }

  // Styled grid content - reactively updates when gridMode or previewMode changes
  const styledGridSvg = $derived.by(() => {
    if (!baseGridSvg) return "";
    const unwrappedSvg = stripSvgWrapper(baseGridSvg);
    const effectiveShowNonRadial = previewMode ? false : showNonRadialPoints;
    const effectiveHandPointMode = previewMode ? "active" : handPointVisibility;
    return applyGridModeStyles(
      unwrappedSvg,
      gridMode,
      effectiveShowNonRadial,
      previewMode,
      darkMode,
      effectiveHandPointMode,
      activeLocations
    );
  });

  // Load grid on mount
  $effect(() => {
    loadGrid(gridMode);
  });

  // Reload grid if mode changes to/from SKEWED (different SVG needed)
  $effect(() => {
    const needsSkewed = gridMode === GridMode.SKEWED;
    const hasSkewed = loadedGridType === "skewed";
    if (needsSkewed !== hasSkewed) {
      loadGrid(gridMode);
    }
  });

  // Apply grid mode styling to SVG elements as inline attributes
  function applyGridModeStyles(
    svgContent: string,
    mode: GridMode,
    showNonRadial: boolean,
    isPreviewMode: boolean,
    exportDarkMode?: boolean,
    handPointMode: "all" | "active" = "all",
    activeHandLocations?: GridLocation[]
  ): string {
    // SKEWED mode: minimal processing
    if (mode === GridMode.SKEWED) {
      let modifiedSvg = svgContent;

      if (exportDarkMode !== undefined) {
        const gridColor = exportDarkMode === true ? "#d0d0d0" : "#000000";
        modifiedSvg = modifiedSvg.replace(/<style[\s\S]*?<\/style>/gi, "");
        modifiedSvg = modifiedSvg.replace(
          /(<(?:circle|path)[^>]*class="[^"]*(?:diamond|box)-points[^"]*"[^/>]*)(\/?>)/g,
          (match, opening, closing) => {
            let cleaned = opening.replace(/\s*fill="[^"]*"/g, "");
            cleaned = cleaned.replace(/\s*stroke="[^"]*"/g, "");
            return `${cleaned} fill="${gridColor}" stroke="${gridColor}"${closing}`;
          }
        );
        modifiedSvg = modifiedSvg.replace(
          /(<circle[^>]*id="center_point"[^/>]*)(\/?>)/g,
          (match, opening, closing) => {
            let cleaned = opening.replace(/\s*fill="[^"]*"/g, "");
            return `${cleaned} fill="${gridColor}"${closing}`;
          }
        );
      }

      if (handPointMode === "active" && activeHandLocations && activeHandLocations.length > 0) {
        modifiedSvg = applyHandPointFiltering(modifiedSvg, activeHandLocations, isPreviewMode);
      }

      return modifiedSvg;
    }

    const shouldInlineColors = exportDarkMode !== undefined;
    const gridColor = exportDarkMode === true ? "#d0d0d0" : "#000000";

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

    const strictPointIds = [
      "ne_diamond_layer2_point_strict",
      "se_diamond_layer2_point_strict",
      "sw_diamond_layer2_point_strict",
      "nw_diamond_layer2_point_strict",
      "n_diamond_hand_point_strict",
      "e_diamond_hand_point_strict",
      "s_diamond_hand_point_strict",
      "w_diamond_hand_point_strict",
    ];

    let modifiedSvg = svgContent;

    if (shouldInlineColors) {
      modifiedSvg = modifiedSvg.replace(/<style[\s\S]*?<\/style>/gi, "");
    }

    const fillOpacity = mode === GridMode.DIAMOND ? "1" : "0";
    const strokeOpacity = mode === GridMode.DIAMOND ? "0" : "1";

    for (const id of outerPointIds) {
      const circlePattern = new RegExp(
        `(<circle[^>]*id="${id}"[^/>]*)(/>)`,
        "g"
      );

      modifiedSvg = modifiedSvg.replace(
        circlePattern,
        (match, opening, closing) => {
          let cleaned = opening.replace(/\s*fill-opacity="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke-opacity="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke-width="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke-miterlimit="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*fill="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*stroke="[^"]*"/g, "");

          if (shouldInlineColors) {
            return `${cleaned} fill="${gridColor}" stroke="${gridColor}" fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" stroke-width="13" stroke-miterlimit="10"${closing}`;
          }

          return `${cleaned} fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" stroke-width="13" stroke-miterlimit="10"${closing}`;
        }
      );
    }

    const nonRadialOpacity = showNonRadial ? "1" : "0";

    for (const id of nonRadialPointIds) {
      const circlePattern = new RegExp(
        `(<circle[^>]*id="${id}"[^/>]*)(/>)`,
        "g"
      );

      modifiedSvg = modifiedSvg.replace(
        circlePattern,
        (match, opening, closing) => {
          let cleaned = opening.replace(/\s*opacity="[^"]*"/g, "");
          cleaned = cleaned.replace(/\s*fill="[^"]*"/g, "");

          if (shouldInlineColors) {
            if (showNonRadial) {
              return `${cleaned} fill="${gridColor}" opacity="1"${closing}`;
            } else {
              return `${cleaned} fill="none" opacity="0"${closing}`;
            }
          }

          if (isPreviewMode) {
            return `${cleaned}${closing}`;
          }
          return `${cleaned} opacity="${nonRadialOpacity}"${closing}`;
        }
      );
    }

    if (shouldInlineColors) {
      for (const id of strictPointIds) {
        const circlePattern = new RegExp(
          `(<circle[^>]*id="${id}"[^/>]*)(/>)`,
          "g"
        );

        modifiedSvg = modifiedSvg.replace(
          circlePattern,
          (match, opening, closing) => {
            let cleaned = opening.replace(/\s*fill="[^"]*"/g, "");
            return `${cleaned} fill="none"${closing}`;
          }
        );
      }
    }

    if (shouldInlineColors) {
      modifiedSvg = modifiedSvg.replace(
        /(<circle[^>]*class="[^"]*normal-hand-point[^"]*"[^/>]*)(\/?>)/g,
        (match, opening, closing) => {
          let cleaned = opening.replace(/\s*fill="[^"]*"/g, "");
          return `${cleaned} fill="${gridColor}"${closing}`;
        }
      );

      modifiedSvg = modifiedSvg.replace(
        /(<circle[^>]*id="center_point"[^/>]*)(\/?>)/g,
        (match, opening, closing) => {
          let cleaned = opening.replace(/\s*fill="[^"]*"/g, "");
          return `${cleaned} fill="${gridColor}"${closing}`;
        }
      );

      modifiedSvg = modifiedSvg.replace(
        /(<line[^/>]*)(\/?>)/g,
        (match, opening, closing) => {
          let cleaned = opening.replace(/\s*stroke="[^"]*"/g, "");
          return `${cleaned} stroke="${gridColor}"${closing}`;
        }
      );
    }

    if (handPointMode === "active" && activeHandLocations && activeHandLocations.length > 0) {
      modifiedSvg = applyHandPointFiltering(modifiedSvg, activeHandLocations, isPreviewMode);
    }

    return modifiedSvg;
  }

  /**
   * Filter hand points to only show those at active locations
   */
  function applyHandPointFiltering(svgContent: string, activeLocations: GridLocation[], isPreviewMode: boolean = false): string {
    let modifiedSvg = svgContent;
    const activeSet = new Set(activeLocations);

    for (const [pointId, location] of Object.entries(HAND_POINT_LOCATIONS)) {
      const isActive = activeSet.has(location);
      const circlePattern = new RegExp(
        `(<circle[^>]*id="${pointId}"[^/>]*)(/>)`,
        "g"
      );

      modifiedSvg = modifiedSvg.replace(
        circlePattern,
        (match, opening, closing) => {
          let cleaned = opening.replace(/\s*opacity="[^"]*"/g, "");

          if (isPreviewMode) {
            const stateClass = isActive ? "hand-point-active" : "hand-point-inactive";
            if (cleaned.includes('class="')) {
              cleaned = cleaned.replace(/class="([^"]*)"/, `class="$1 ${stateClass}"`);
            } else {
              if (!cleaned.includes('class=')) {
                cleaned = `${cleaned} class="${stateClass}"`;
              }
            }
            return `${cleaned}${closing}`;
          } else {
            const opacity = isActive ? "1" : "0";
            return `${cleaned} opacity="${opacity}"${closing}`;
          }
        }
      );
    }

    return modifiedSvg;
  }

  // Track the grid container element for animations
  let gridContainerElement = $state<SVGGElement | undefined>();

  // Cubic bezier easing function
  function cubicBezier(
    t: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number
  ): number {
    const cx = 3.0 * p1x;
    const bx = 3.0 * (p2x - p1x) - cx;
    const ax = 1.0 - cx - bx;

    const cy = 3.0 * p1y;
    const by = 3.0 * (p2y - p1y) - cy;
    const ay = 1.0 - cy - by;

    let x = t;
    for (let i = 0; i < 8; i++) {
      const z = ((ax * x + bx) * x + cx) * x - t;
      if (Math.abs(z) < 1e-7) break;
      const d = (3.0 * ax * x + 2.0 * bx) * x + cx;
      if (Math.abs(d) < 1e-7) break;
      x = x - z / d;
    }

    return ((ay * x + by) * x + cy) * x;
  }

  // Resolve direction to numeric multiplier
  function resolveDirection(): number {
    if (gridRotationDirection === "cw" || gridRotationDirection === 1) return 1;
    if (gridRotationDirection === "ccw" || gridRotationDirection === -1) return -1;
    return 1; // default clockwise
  }

  // Increment cumulative rotation by 45 deg with smooth animation
  $effect(() => {
    if (previousGridMode === null) {
      cumulativeRotation = gridMode === GridMode.BOX ? 45 : 0;
      previousGridMode = gridMode;
      return;
    }

    if (gridMode === previousGridMode) return;

    if (gridMode === GridMode.SKEWED || previousGridMode === GridMode.SKEWED) {
      cumulativeRotation = gridMode === GridMode.BOX ? 45 : 0;
      previousGridMode = gridMode;
      return;
    }

    const previousRotation = cumulativeRotation;
    const direction = resolveDirection();
    const newRotation = cumulativeRotation + 45 * direction;

    if (gridContainerElement) {
      const element = gridContainerElement;
      const startTime = performance.now();
      const duration = 200;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
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
          element.setAttribute("transform", `rotate(${newRotation}, 475, 475)`);
        }
      };

      requestAnimationFrame(animate);
    }

    cumulativeRotation = newRotation;
    previousGridMode = gridMode;
  });
</script>

<g
  bind:this={gridContainerElement}
  class="grid-container"
  class:visible
  class:box-mode={gridMode === GridMode.BOX}
  class:skewed-mode={gridMode === GridMode.SKEWED}
  class:show-non-radial={showNonRadialPoints}
  class:hide-inactive-hand-points={handPointVisibility === "active"}
  class:preview-mode={previewMode}
  class:interactive-non-radial={onToggleNonRadial !== undefined}
  class:dark-mode-override={darkMode === true}
  class:light-mode-override={darkMode === false}
  data-grid-mode={gridMode}
  transform="rotate({cumulativeRotation}, 475, 475)"
>
  {#if !hasError && styledGridSvg}
    <g class="grid-layer">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html styledGridSvg}
    </g>

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
    opacity: 0;
    transition: opacity var(--duration-fast, 150ms) ease-out;
  }

  .grid-container.visible {
    opacity: 1;
  }

  .grid-container.preview-mode:not(.visible) {
    opacity: 0.4;
  }

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
      fill-opacity 150ms ease-out,
      stroke-opacity 150ms ease-out,
      fill 150ms ease-out,
      stroke 150ms ease-out;
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

  /* Non-radial points */
  :global(#ne_diamond_layer2_point),
  :global(#se_diamond_layer2_point),
  :global(#sw_diamond_layer2_point),
  :global(#nw_diamond_layer2_point) {
    fill: #000;
    opacity: 0;
    transition:
      opacity 150ms ease-out,
      fill 150ms ease-out;
  }

  :global(:root.dark #ne_diamond_layer2_point),
  :global(:root.dark #se_diamond_layer2_point),
  :global(:root.dark #sw_diamond_layer2_point),
  :global(:root.dark #nw_diamond_layer2_point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  :global(.grid-container.show-non-radial #ne_diamond_layer2_point),
  :global(.grid-container.show-non-radial #se_diamond_layer2_point),
  :global(.grid-container.show-non-radial #sw_diamond_layer2_point),
  :global(.grid-container.show-non-radial #nw_diamond_layer2_point) {
    opacity: 1;
  }

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

  :global(.grid-container.interactive-non-radial #ne_diamond_layer2_point),
  :global(.grid-container.interactive-non-radial #se_diamond_layer2_point),
  :global(.grid-container.interactive-non-radial #sw_diamond_layer2_point),
  :global(.grid-container.interactive-non-radial #nw_diamond_layer2_point) {
    cursor: pointer;
  }

  .non-radial-click-overlay {
    cursor: pointer;
  }

  .non-radial-click-overlay:focus-visible {
    outline: 2px solid var(--primary-color, #6366f1);
    outline-offset: 2px;
  }

  :global(.normal-hand-point) {
    transition:
      fill 150ms ease-out,
      opacity 150ms ease-out;
  }

  :global(.hand-point-active),
  :global(.hand-point-inactive) {
    opacity: 1;
  }

  :global(.grid-container.hide-inactive-hand-points .hand-point-inactive) {
    opacity: 0.4;
  }

  :global(:root.dark .normal-hand-point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  :global(#center_point) {
    fill: #000;
    transition: fill var(--duration-fast, 150ms) ease-out;
  }

  :global(:root.dark #center_point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  :global(.grid-container line) {
    stroke: #000;
    transition: stroke var(--duration-fast, 150ms) ease-out;
  }

  :global(:root.dark .grid-container line) {
    stroke: var(--dm-grid-color, #d0d0d0);
  }

  /* ====================================================================
     EXPORT MODE OVERRIDES
   ==================================================================== */

  :global(.grid-container.light-mode-override #n_diamond_outer_point),
  :global(.grid-container.light-mode-override #e_diamond_outer_point),
  :global(.grid-container.light-mode-override #s_diamond_outer_point),
  :global(.grid-container.light-mode-override #w_diamond_outer_point) {
    fill: #000000;
    stroke: #000000;
  }

  :global(.grid-container.light-mode-override #ne_diamond_layer2_point),
  :global(.grid-container.light-mode-override #se_diamond_layer2_point),
  :global(.grid-container.light-mode-override #sw_diamond_layer2_point),
  :global(.grid-container.light-mode-override #nw_diamond_layer2_point) {
    fill: #000000;
  }

  :global(.grid-container.light-mode-override .normal-hand-point) {
    fill: #000000;
  }

  :global(.grid-container.light-mode-override #center_point) {
    fill: #000000;
  }

  :global(.grid-container.light-mode-override line) {
    stroke: #000000;
  }

  :global(.grid-container.dark-mode-override #n_diamond_outer_point),
  :global(.grid-container.dark-mode-override #e_diamond_outer_point),
  :global(.grid-container.dark-mode-override #s_diamond_outer_point),
  :global(.grid-container.dark-mode-override #w_diamond_outer_point) {
    fill: #d0d0d0;
    stroke: #d0d0d0;
  }

  :global(.grid-container.dark-mode-override #ne_diamond_layer2_point),
  :global(.grid-container.dark-mode-override #se_diamond_layer2_point),
  :global(.grid-container.dark-mode-override #sw_diamond_layer2_point),
  :global(.grid-container.dark-mode-override #nw_diamond_layer2_point) {
    fill: #d0d0d0;
  }

  :global(.grid-container.dark-mode-override .normal-hand-point) {
    fill: #d0d0d0;
  }

  :global(.grid-container.dark-mode-override #center_point) {
    fill: #d0d0d0;
  }

  :global(.grid-container.dark-mode-override line) {
    stroke: #d0d0d0;
  }

  /* ====================================================================
     SKEWED MODE
   ==================================================================== */

  :global(.grid-container.skewed-mode #n_diamond_outer_point),
  :global(.grid-container.skewed-mode #e_diamond_outer_point),
  :global(.grid-container.skewed-mode #s_diamond_outer_point),
  :global(.grid-container.skewed-mode #w_diamond_outer_point) {
    fill: #000;
    stroke: #000;
    stroke-width: 1;
  }

  :global(.grid-container.skewed-mode .box-outer-ring) {
    fill: none;
    stroke: #000;
    stroke-width: 13;
    stroke-miterlimit: 10;
  }

  :global(.grid-container.skewed-mode #center_point) {
    fill: #000;
  }

  :global(.grid-container.skewed-mode .normal-hand-point) {
    fill: #000;
  }

  :global(:root.dark .grid-container.skewed-mode #n_diamond_outer_point),
  :global(:root.dark .grid-container.skewed-mode #e_diamond_outer_point),
  :global(:root.dark .grid-container.skewed-mode #s_diamond_outer_point),
  :global(:root.dark .grid-container.skewed-mode #w_diamond_outer_point) {
    fill: var(--dm-grid-color, #d0d0d0);
    stroke: var(--dm-grid-color, #d0d0d0);
  }

  :global(:root.dark .grid-container.skewed-mode .box-outer-ring) {
    stroke: var(--dm-grid-color, #d0d0d0);
  }

  :global(:root.dark .grid-container.skewed-mode #center_point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  :global(:root.dark .grid-container.skewed-mode .normal-hand-point) {
    fill: var(--dm-grid-color, #d0d0d0);
  }

  :global(.grid-container.skewed-mode.light-mode-override #n_diamond_outer_point),
  :global(.grid-container.skewed-mode.light-mode-override #e_diamond_outer_point),
  :global(.grid-container.skewed-mode.light-mode-override #s_diamond_outer_point),
  :global(.grid-container.skewed-mode.light-mode-override #w_diamond_outer_point),
  :global(.grid-container.skewed-mode.light-mode-override #center_point),
  :global(.grid-container.skewed-mode.light-mode-override .normal-hand-point) {
    fill: #000000;
  }

  :global(.grid-container.skewed-mode.light-mode-override .box-outer-ring) {
    stroke: #000000;
  }

  :global(.grid-container.skewed-mode.dark-mode-override #n_diamond_outer_point),
  :global(.grid-container.skewed-mode.dark-mode-override #e_diamond_outer_point),
  :global(.grid-container.skewed-mode.dark-mode-override #s_diamond_outer_point),
  :global(.grid-container.skewed-mode.dark-mode-override #w_diamond_outer_point),
  :global(.grid-container.skewed-mode.dark-mode-override #center_point),
  :global(.grid-container.skewed-mode.dark-mode-override .normal-hand-point) {
    fill: #d0d0d0;
  }

  :global(.grid-container.skewed-mode.dark-mode-override .box-outer-ring) {
    stroke: #d0d0d0;
  }
</style>
