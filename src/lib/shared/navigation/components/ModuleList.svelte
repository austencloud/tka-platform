<!--
  ModuleList - Module switching UI component (2026 Premium Compact Grid)

  Displays a compact 2-column grid of available modules for quick selection.
  Optimized for mobile viewports - all modules visible without scrolling.

  Features:
  - Compact 2-column grid layout - fits all modules in viewport
  - Module-specific gradient colors extracted from icon HTML
  - Premium glassmorphic card design with layered backgrounds
  - Icon-focused design with labels (no descriptions for compactness)
  - Active state with subtle glow border
  - Touch-optimized tap targets
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { ModuleDefinition, ModuleId } from "../domain/types";
  import type { HapticFeedback } from "../../application/services/haptic-feedback";
import { inboxState } from "$lib/shared/inbox/state/inbox-state.svelte";
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  // Reactive locale for re-rendering translations
  const locale = $derived(getReactiveLocale());

  let {
    currentModule,
    modules = [],
    onModuleSelect,
  } = $props<{
    currentModule: ModuleId;
    modules: ModuleDefinition[];
    onModuleSelect?: (moduleId: ModuleId) => void;
  }>();

  let hapticService: HapticFeedback;

  // Track drag state to prevent clicks during swipe gestures
  let dragState = $state<{
    isDragging: boolean;
    startY: number;
    startTime: number;
  }>({
    isDragging: false,
    startY: 0,
    startTime: 0,
  });

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Filter to main modules and dev modules - static order from module-definitions.ts
  // Settings is accessed via account footer, not shown in module grid
  const mainModules = $derived(
    modules.filter((m: ModuleDefinition) => m.isMain)
  );
  const devModules = $derived(
    modules.filter((m: ModuleDefinition) => !m.isMain && m.id !== "settings")
  );

  // Determine grid layout class based on module count
  // This enables adaptive layouts that fill space better with fewer modules
  const gridLayoutClass = $derived(() => {
    const count = mainModules.length;
    if (count <= 3) return "layout-few"; // Large cells, single column or row
    if (count === 4) return "layout-quad"; // 2×2 grid with larger cells
    if (count === 5) return "layout-five"; // Asymmetric 3+2 or 2+3
    if (count === 6) return "layout-six"; // Balanced 2×3 or 3×2
    return "layout-many"; // Default compact grid for 7+
  });

  /**
   * 🎨 Extract primary color from module icon HTML
   * Parses gradient/color values from icon SVG or inline styles
   * Falls back to purple gradient if no color found
   */
  function extractModuleColor(iconHtml: string): string {
    // Try to find gradient color in SVG or inline styles
    const gradientMatch = iconHtml.match(/stop-color[:\s=]\s*["']?([#\w]+)/);
    if (gradientMatch?.[1]) return gradientMatch[1];

    // Match inline style color (e.g., style="color: var(--semantic-warning);")
    const colorMatch = iconHtml.match(/color[:\s=]\s*["']?([#\w]+)/);
    if (colorMatch?.[1]) return colorMatch[1];

    // Default fallback gradient color
    return "#667eea";
  }

  function handlePointerDown(event: PointerEvent | MouseEvent) {
    dragState.isDragging = false;
    dragState.startY = event.clientY;
    dragState.startTime = Date.now();
  }

  function handlePointerMove(event: PointerEvent | MouseEvent) {
    const deltaY = Math.abs(event.clientY - dragState.startY);
    // If moved more than 10px vertically, consider it a drag
    if (deltaY > 10) {
      dragState.isDragging = true;
    }
  }

  function handleModuleClick(
    moduleId: ModuleId,
    event: PointerEvent | MouseEvent,
    isDisabled: boolean = false
  ) {
    // Don't trigger click for disabled modules
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // If user was dragging, don't trigger the click
    if (dragState.isDragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // If the pointer was down for more than 300ms and moved, likely a drag
    const duration = Date.now() - dragState.startTime;
    const deltaY = Math.abs(event.clientY - dragState.startY);
    if (duration > 300 && deltaY > 5) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    hapticService?.trigger("selection");
    onModuleSelect?.(moduleId);
  }


  /**
   * Get badge count for a module
   * Currently unused - notifications are shown in inbox drawer
   */
  function getModuleBadgeCount(_moduleId: ModuleId): number {
    return 0;
  }

  /**
   * Format badge count for display
   */
  function formatBadgeCount(count: number): string {
    if (count > 99) return "99+";
    return count.toString();
  }
</script>

<!-- Main Modules Section - Adaptive Grid based on module count -->
<section class="module-section" data-module-count={mainModules.length}>
  <h3 class="section-title">Modules</h3>
  {#key locale}
  <div class="module-grid {gridLayoutClass()}">
    {#each mainModules as module, index}
      {@const moduleColor = module.color || extractModuleColor(module.icon)}
      {@const isActive = currentModule === module.id}
      {@const isDisabled = module.disabled ?? false}
      {@const badgeCount = getModuleBadgeCount(module.id)}

      <button
        class="module-cell"
        class:active={isActive}
        class:disabled={isDisabled}
        class:has-badge={badgeCount > 0}
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onclick={(e) => handleModuleClick(module.id, e, isDisabled)}
        style="--module-color: {moduleColor}; --stagger-index: {index};"
        aria-disabled={isDisabled}
        disabled={isDisabled}
      >
        <!-- Premium layered background -->
        <div class="cell-background"></div>
        <div class="cell-glow"></div>

        <!-- Content layer -->
        <div class="cell-content">
          <span class="cell-icon">{@html module.icon}</span>
          <span class="cell-label">{t(module.labelKey)}</span>

          <!-- Unread badge -->
          {#if badgeCount > 0}
            <span class="unread-badge" aria-label="{badgeCount} unread">
              {formatBadgeCount(badgeCount)}
            </span>
          {/if}

          <!-- Disabled badge or active indicator -->
          {#if isDisabled && module.disabledMessage}
            <div class="cell-badge">{module.disabledMessage}</div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
  {/key}
</section>

<!-- Developer/Admin Modules Section -->
{#if devModules.length > 0}
  <section class="module-section dev-section">
    <h3 class="section-title">Developer</h3>
    {#key locale}
    <div class="module-grid dev-grid">
      {#each devModules as module}
        {@const moduleColor = module.color || extractModuleColor(module.icon)}
        {@const isActive = currentModule === module.id}
        {@const isDisabled = module.disabled ?? false}

        <button
          class="module-cell"
          class:active={isActive}
          class:disabled={isDisabled}
          onpointerdown={handlePointerDown}
          onpointermove={handlePointerMove}
          onclick={(e) => handleModuleClick(module.id, e, isDisabled)}
          style="--module-color: {moduleColor};"
          aria-disabled={isDisabled}
          disabled={isDisabled}
        >
          <!-- Premium layered background -->
          <div class="cell-background"></div>
          <div class="cell-glow"></div>

          <!-- Content layer -->
          <div class="cell-content">
            <span class="cell-icon">{@html module.icon}</span>
            <span class="cell-label">{t(module.labelKey)}</span>

            <!-- Disabled badge -->
            {#if isDisabled && module.disabledMessage}
              <div class="cell-badge">{module.disabledMessage}</div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
    {/key}
  </section>
{/if}

<style>
  /* ============================================================================
     2026 PREMIUM COMPACT GRID DESIGN
     Optimized for mobile - all modules visible without scrolling
     ============================================================================ */

  .module-section {
    margin-bottom: 16px; /* Compact section spacing */
    display: flex;
    flex-direction: column;
  }

  /* Main modules section fills available space */
  .module-section:first-child {
    flex: 1;
    min-height: 0;
  }

  .module-section:last-child {
    margin-bottom: 0;
  }

  .dev-section {
    padding-top: 20px; /* More space before dev section */
    border-top: 1px solid var(--theme-stroke);
  }

  .section-title {
    margin: 0 0 16px 4px; /* More space before grid for better visual hierarchy */
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--theme-text-dim);
  }

  /* ============================================================================
     2-COLUMN GRID LAYOUT - Compact to fit all modules
     ============================================================================ */
  .module-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px; /* Compact spacing to fit more modules */
    flex: 1;
    min-height: 0;
    align-content: start; /* Align content to top to allow scrolling */
    grid-auto-rows: minmax(72px, auto); /* Min row height with auto expansion */
  }

  /* Developer grid - full width for any number of items */
  .dev-grid {
    grid-template-columns: repeat(2, 1fr);
    flex: 0; /* Don't grow dev section */
  }

  /* Single item in dev grid expands to full width */
  .dev-grid .module-cell:only-child {
    grid-column: 1 / -1;
  }

  /* ============================================================================
     MODULE CELL - COMPACT CARD DESIGN (Fluid Responsive)
     Uses clamp() for truly fluid sizing across all viewports
     ============================================================================ */
  .module-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* Reduced min-height to fit more modules: min 72px, preferred 10vh, max 120px */
    min-height: clamp(72px, 10vh, 120px);
    height: 100%; /* Fill the grid cell to expand vertically */
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 14px;
    color: var(--theme-text, var(--theme-text));
    cursor: pointer;
    text-align: center;
    overflow: hidden;
    isolation: isolate;

    /* Staggered entrance animation */
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    animation: cellEntrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: calc(var(--stagger-index, 0) * 50ms + 100ms);

    /* Smooth transitions for interactions */
    transition:
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.2s ease;
  }

  @keyframes cellEntrance {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Layered Background System - With prominent module-colored accent */
  .cell-background {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--module-color) 18%, rgba(255, 255, 255, 0.06)) 0%,
      color-mix(in srgb, var(--module-color) 8%, rgba(255, 255, 255, 0.02)) 100%
    );
    border: 1px solid
      color-mix(in srgb, var(--module-color) 25%, var(--theme-stroke));
    border-radius: 16px; /* Match parent border-radius */
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }

  .cell-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 25%,
      var(--module-color, #667eea) 0%,
      transparent 60%
    );
    opacity: 0.1; /* Prominent default glow */
    transition: opacity var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
    mix-blend-mode: screen;
  }

  /* Content Layer */
  .cell-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px; /* Compact spacing */
    padding: 12px 8px; /* Reduced padding for compact design */
    width: 100%;
    height: 100%;
    z-index: 2;
  }

  /* ============================================================================
     HOVER STATES - Enhanced with module color
     ============================================================================ */
  .module-cell:hover .cell-background {
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--module-color) 20%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--module-color) 10%, rgba(255, 255, 255, 0.03))
        100%
    );
    border-color: color-mix(
      in srgb,
      var(--module-color) 35%,
      rgba(255, 255, 255, 0.12)
    );
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--module-color) 18%, transparent);
  }

  .module-cell:hover .cell-glow {
    opacity: 0.12;
  }

  .module-cell:hover {
    transform: scale(1.02);
  }

  /* ============================================================================
     ACTIVE STATE - Current module is visually prominent
     Larger, brighter, with a subtle breathing pulse
     ============================================================================ */
  .module-cell.active {
    transform: scale(1.05);
    z-index: 2;
  }

  .module-cell.active .cell-background {
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--module-color) 25%, rgba(255, 255, 255, 0.08)) 0%,
      color-mix(in srgb, var(--module-color) 15%, rgba(255, 255, 255, 0.03)) 100%
    );
    border-color: color-mix(in srgb, var(--module-color) 50%, rgba(255, 255, 255, 0.2));
    border-width: 2px;
    box-shadow:
      0 0 20px color-mix(in srgb, var(--module-color) 25%, transparent),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .module-cell.active .cell-glow {
    opacity: 0.18;
    animation: activeGlowPulse 3s ease-in-out infinite;
  }

  @keyframes activeGlowPulse {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.22; }
  }

  .module-cell.active .cell-icon {
    transform: scale(1.1);
  }

  .module-cell.active .cell-label {
    font-weight: 700;
  }

  /* ============================================================================
     ICON STYLING - Compact sizing for dense grid
     ============================================================================ */
  .cell-icon {
    /* Compact icons: min 24px, preferred 3.5vh, max 36px */
    font-size: clamp(24px, 3.5vh, 36px);
    width: clamp(36px, 5vh, 44px);
    height: clamp(36px, 5vh, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .module-cell:hover .cell-icon {
    transform: scale(1.1);
  }

  /* Icon shadow and glow - subtle */
  .cell-icon :global(svg),
  .cell-icon :global(i) {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .module-cell.active .cell-icon :global(svg),
  .module-cell.active .cell-icon :global(i) {
    filter: drop-shadow(
      0 0 6px color-mix(in srgb, var(--module-color) 35%, transparent)
    );
  }

  /* ============================================================================
     LABEL STYLING - Compact sizing for dense grid
     ============================================================================ */
  .cell-label {
    /* Compact labels: min 11px, preferred 1.6vh, max 14px */
    font-size: clamp(11px, 1.6vh, 14px);
    font-weight: 600;
    color: var(--theme-text);
    letter-spacing: 0.01em;
    line-height: 1.2;
    transition: color var(--duration-normal) ease;
  }

  .module-cell.active .cell-label {
    color: var(--theme-text);
  }

  /* ============================================================================
     DISABLED BADGE
     ============================================================================ */
  .cell-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim, var(--theme-text-dim));
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    letter-spacing: 0.4px;
    z-index: 3;
  }

  /* ============================================================================
     UNREAD BADGE (for inbox module)
     ============================================================================ */
  .unread-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: var(--semantic-error, var(--semantic-error));
    border-radius: 9px;
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 600;
    line-height: 18px;
    text-align: center;
    box-shadow: 0 2px 4px var(--theme-shadow);
    animation: badgePop var(--duration-emphasis) ease;
    z-index: 3;
  }

  @keyframes badgePop {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  /* ============================================================================
     PRESS/ACTIVE INTERACTION
     ============================================================================ */
  .module-cell:active {
    transform: scale(0.96);
  }

  /* ============================================================================
     DISABLED STATE
     ============================================================================ */
  .module-cell.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .module-cell.disabled:hover {
    transform: none;
  }

  .module-cell.disabled:hover .cell-background {
    background: linear-gradient(
      145deg,
      var(--theme-card-hover-bg) 0%,
      var(--theme-card-bg) 100%
    );
    border-color: var(--theme-stroke, var(--theme-stroke));
  }

  .module-cell.disabled:hover .cell-glow {
    opacity: 0;
  }

  .module-cell.disabled:hover .cell-icon {
    transform: none;
  }

  /* ============================================================================
     ADAPTIVE LAYOUTS - Based on module count
     Modules expand to fill space when there are fewer of them
     ============================================================================ */

  /* Few modules (1-3): Large cells, vertically centered */
  .module-grid.layout-few {
    grid-template-columns: 1fr;
    gap: 16px;
    align-content: center;
    justify-content: center;
  }

  .module-grid.layout-few .module-cell {
    min-height: clamp(100px, 18vh, 160px);
    max-width: 400px;
    margin: 0 auto;
    width: 100%;
  }

  /* Quad layout (4 modules): 2×2 grid with larger cells */
  .module-grid.layout-quad {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    align-content: center;
  }

  .module-grid.layout-quad .module-cell {
    min-height: clamp(100px, 20vh, 180px);
  }

  /* Five modules: 2×2 + 1 centered, or 3+2 on wider screens */
  .module-grid.layout-five {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    align-content: center;
  }

  .module-grid.layout-five .module-cell {
    min-height: clamp(90px, 16vh, 150px);
  }

  /* Center the 5th item (odd one out) */
  .module-grid.layout-five .module-cell:nth-child(5) {
    grid-column: 1 / -1;
    max-width: calc(50% - 7px);
    justify-self: center;
  }

  /* Six modules: 2×3 grid with balanced sizing */
  .module-grid.layout-six {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 14px;
    align-content: stretch;
  }

  .module-grid.layout-six .module-cell {
    min-height: clamp(85px, 14vh, 140px);
  }

  /* Many modules (7+): Compact default layout */
  .module-grid.layout-many {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    align-content: start;
  }

  /* ============================================================================
     RESPONSIVE - Wider screen adaptations for each layout
     ============================================================================ */
  @media (min-width: 400px) {
    /* Few modules on wide screens: horizontal row */
    .module-grid.layout-few {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }

    .module-grid.layout-few .module-cell {
      min-height: clamp(120px, 25vh, 200px);
      max-width: none;
    }

    /* Quad on wide screens: stays 2×2 but larger */
    .module-grid.layout-quad {
      gap: 20px;
    }

    .module-grid.layout-quad .module-cell {
      min-height: clamp(120px, 25vh, 200px);
    }

    /* Five modules on wide: 3+2 layout */
    .module-grid.layout-five {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .module-grid.layout-five .module-cell {
      min-height: clamp(100px, 18vh, 160px);
    }

    /* 4th and 5th items span to center the bottom row */
    .module-grid.layout-five .module-cell:nth-child(4) {
      grid-column: 1 / 2;
      justify-self: end;
      width: calc(100% + 8px);
      margin-right: -8px;
    }

    .module-grid.layout-five .module-cell:nth-child(5) {
      grid-column: 2 / 4;
      max-width: none;
      width: calc(100% + 8px);
      margin-left: -8px;
      justify-self: start;
    }

    /* Six modules on wide: 3×2 grid */
    .module-grid.layout-six {
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 16px;
    }

    .module-grid.layout-six .module-cell {
      min-height: clamp(100px, 18vh, 160px);
    }

    /* Many modules: 3 columns */
    .module-grid.layout-many {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* ============================================================================
     WIDESCREEN DEVICES (Z-Fold unfolded, tablets)
     Use 4 columns to reduce row count and prevent vertical stretching
     ============================================================================ */
  @media (min-width: 700px) and (min-height: 500px) {
    .section-title {
      margin: 0 0 8px 4px;
    }

    .dev-section {
      padding-top: 10px;
    }

    .module-section {
      margin-bottom: 10px;
    }

    /* Force 4 columns on all layout variants to reduce row count */
    .module-grid,
    .module-grid.layout-few,
    .module-grid.layout-quad,
    .module-grid.layout-five,
    .module-grid.layout-six,
    .module-grid.layout-many {
      flex: 0 1 auto;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: auto;
      align-content: start;
      gap: 10px;
    }

    /* Reset the 400px five-module centering hacks for 4-col layout */
    .module-grid.layout-five .module-cell:nth-child(4),
    .module-grid.layout-five .module-cell:nth-child(5) {
      grid-column: auto;
      max-width: none;
      width: 100%;
      margin: 0;
      justify-self: auto;
    }

    .module-grid .module-cell {
      min-height: 72px;
      max-height: 88px;
    }

    .module-grid .cell-icon {
      font-size: clamp(22px, 2.8vw, 32px);
      width: clamp(32px, 4vw, 44px);
      height: clamp(32px, 4vw, 44px);
    }

    .module-grid .cell-label {
      font-size: clamp(11px, 1.3vw, 14px);
    }
  }

  /* ============================================================================
     LANDSCAPE MOBILE - Optimize for horizontal space
     ============================================================================ */
  @media (max-height: 500px) and (orientation: landscape) {
    .module-grid.layout-few,
    .module-grid.layout-quad,
    .module-grid.layout-five,
    .module-grid.layout-six {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      max-width: none;
    }

    .module-grid .module-cell {
      min-height: clamp(70px, 12vh, 100px);
    }
  }

  /* ============================================================================
     TALL SCREENS (tablets in portrait) - Use vertical space
     ============================================================================ */
  @media (min-height: 800px) {
    .module-grid.layout-few .module-cell,
    .module-grid.layout-quad .module-cell {
      min-height: clamp(140px, 20vh, 220px);
    }

    .module-grid.layout-five .module-cell,
    .module-grid.layout-six .module-cell {
      min-height: clamp(120px, 16vh, 180px);
    }
  }

  /* ============================================================================
     SCALED CONTENT FOR LARGER CELLS
     Icons and labels grow proportionally with cell size
     ============================================================================ */
  .module-grid.layout-few .cell-icon,
  .module-grid.layout-quad .cell-icon {
    font-size: clamp(32px, 5vh, 48px);
    width: clamp(48px, 7vh, 64px);
    height: clamp(48px, 7vh, 64px);
  }

  .module-grid.layout-few .cell-label,
  .module-grid.layout-quad .cell-label {
    font-size: clamp(14px, 2vh, 18px);
  }

  .module-grid.layout-five .cell-icon,
  .module-grid.layout-six .cell-icon {
    font-size: clamp(28px, 4vh, 40px);
    width: clamp(40px, 6vh, 56px);
    height: clamp(40px, 6vh, 56px);
  }

  .module-grid.layout-five .cell-label,
  .module-grid.layout-six .cell-label {
    font-size: clamp(13px, 1.8vh, 16px);
  }

  /* Restore compact sizing for landscape mobile */
  @media (max-height: 500px) and (orientation: landscape) {
    .module-grid .cell-icon {
      font-size: clamp(24px, 3.5vh, 32px);
      width: clamp(32px, 5vh, 40px);
      height: clamp(32px, 5vh, 40px);
    }

    .module-grid .cell-label {
      font-size: clamp(11px, 1.5vh, 13px);
    }
  }

  /* ============================================================================
     ACCESSIBILITY & REDUCED MOTION
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .module-cell {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }

    .module-cell,
    .cell-background,
    .cell-glow,
    .cell-icon {
      transition: none !important;
    }

    .module-cell:hover,
    .module-cell:active {
      transform: none !important;
    }

    .module-cell.active {
      transform: none !important;
    }

    .module-cell.active .cell-glow {
      animation: none !important;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .cell-background {
      background: var(
        --theme-card-hover-bg,
        rgba(255, 255, 255, 0.15)
      ) !important;
      border: 2px solid var(--theme-stroke-strong) !important;
    }

    .module-cell.active .cell-background {
      background: var(
        --theme-card-hover-bg,
        rgba(255, 255, 255, 0.25)
      ) !important;
      border: 2px solid white !important;
    }
  }

  /* Focus styles for keyboard navigation */
  .module-cell:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 60%, transparent);
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .unread-badge {
      animation: none;
    }
  }
</style>
