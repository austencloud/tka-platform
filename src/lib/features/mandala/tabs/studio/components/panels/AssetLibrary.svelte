<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { mandalaState } from "../../state/mandala-state.svelte";
  import { TKA_BLUE, TKA_RED } from "../../domain/models/mandala-config";
  import { onMount } from "svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  /** Path to the consolidated arrow sprite */
  const ARROW_SPRITE_PATH = "/images/arrows-sprite.svg";

  interface Props {
    onAssetSelect?: (
      assetType: string,
      motionType: string,
      color: string,
      svgData?: ParsedSvgData
    ) => void;
  }

  let { onAssetSelect }: Props = $props();

  // Tab state
  const activeTab = $derived(mandalaState.assetLibraryTab);
  const filter = $derived(mandalaState.assetLibraryFilter);

  // Motion type definitions
  const MOTION_TYPES = [
    { id: "pro", label: "Pro" },
    { id: "anti", label: "Anti" },
    { id: "static", label: "Static" },
    { id: "dash", label: "Dash" },
    { id: "float", label: "Float" },
  ] as const;

  // Turn values for arrows (float has none)
  const TURN_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

  // Generate all arrow variations (motion type + turn combinations)
  // Symbol IDs use format: {motionType}_{turns}_{orientation}
  interface ArrowVariation {
    id: string;
    symbolId: string; // Symbol ID in sprite
    motionType: string;
    motionLabel: string;
    turns: number | null;
    label: string;
  }

  const ALL_ARROW_VARIATIONS: ArrowVariation[] = MOTION_TYPES.flatMap(
    (motion): ArrowVariation[] => {
      if (motion.id === "float") {
        // Float is a special case - single symbol
        return [
          {
            id: "float",
            symbolId: "float",
            motionType: "float" as string,
            motionLabel: "Float",
            turns: null,
            label: "Float",
          },
        ];
      }
      // All other motion types have turn variations
      // Use radial orientation for mandala (from center outward)
      return TURN_VALUES.map((turn) => ({
        id: `${motion.id}_${turn}`,
        symbolId: `${motion.id}_${turn.toFixed(1)}_radial`,
        motionType: motion.id as string,
        motionLabel: motion.label,
        turns: turn as number | null,
        label: `${motion.label} ${turn}`,
      }));
    }
  );

  // Staff types - use actual staff SVGs
  const STAFF_TYPES = [
    { id: "staff", label: "Staff", path: "/images/props/buttons/staff.svg" },
  ] as const;

  // Color options
  const COLORS = [
    { id: "blue", color: TKA_BLUE, label: "Blue" },
    { id: "red", color: TKA_RED, label: "Red" },
  ] as const;

  let selectedColor = $state(TKA_BLUE);

  // Parsed SVG data structure
  interface ParsedSvgData {
    svgContent: string;
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  }

  // Symbol data from sprite
  interface SymbolData {
    viewBox: string;
    innerContent: string;
  }

  // Sprite cache - stores all arrow symbols
  let spriteSymbols = $state<Map<string, SymbolData>>(new Map());
  let spriteLoaded = $state(false);

  // Parsed SVG data cache - stores parsed viewBox/center per symbol
  let parsedSvgCache = $state<Map<string, ParsedSvgData>>(new Map());

  // Staff SVG cache
  let staffSvgCache = $state<Map<string, string>>(new Map());

  // CSS class to fill color mapping (parsed from sprite's style block)
  let cssClassToFill = $state<Map<string, string>>(new Map());

  /**
   * Parse CSS style block to extract class->fill color mappings
   * e.g., ".st0{fill:#2E3192;}" -> { "st0": "#2E3192" }
   */
  function parseStyleBlock(doc: Document, rawSvgText: string): Map<string, string> {
    const classToFill = new Map<string, string>();
    const fillRegex = /\.([a-zA-Z0-9_-]+)\s*\{\s*fill\s*:\s*(#[0-9A-Fa-f]{3,6})\s*;?\s*\}/g;

    // Try DOM-based parsing first
    const styleElements = doc.querySelectorAll("style");
    styleElements.forEach((style) => {
      const cssText = style.textContent || "";
      let match;
      while ((match = fillRegex.exec(cssText)) !== null) {
        if (match[1] && match[2]) {
          classToFill.set(match[1], match[2]);
        }
      }
    });

    // Fallback: parse style from raw text if DOM parsing found nothing
    if (classToFill.size === 0 && rawSvgText) {
      const styleMatch = rawSvgText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch && styleMatch[1]) {
        const cssText = styleMatch[1];
        fillRegex.lastIndex = 0; // Reset regex state
        let match;
        while ((match = fillRegex.exec(cssText)) !== null) {
          if (match[1] && match[2]) {
            classToFill.set(match[1], match[2]);
          }
        }
      }
    }

    return classToFill;
  }

  /**
   * Inline CSS fill classes as direct fill attributes
   * Replaces class="st0" with fill="#2E3192" based on the style block mapping
   */
  function inlineCssFills(content: string, classToFill: Map<string, string>): string {
    let result = content;

    classToFill.forEach((fillColor, className) => {
      // Replace class="className" with fill="color"
      const classRegex = new RegExp(`class="${className}"`, "g");
      result = result.replace(classRegex, `fill="${fillColor}"`);

      // Handle class='className' (single quotes)
      const classRegexSingle = new RegExp(`class='${className}'`, "g");
      result = result.replace(classRegexSingle, `fill="${fillColor}"`);
    });

    return result;
  }

  /**
   * Calculate bounding box from an SVG path d attribute
   */
  function getPathBounds(pathD: string): { minX: number; minY: number; maxX: number; maxY: number } {
    // Extract all numbers from the path, treating them as coordinates
    const numbers = pathD.match(/-?\d*\.?\d+/g) || [];
    const coords: number[] = numbers.map(Number);

    // Path commands that take coordinates (simplified - handles M, L, C, S, Q, T, A)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Simple approach: treat pairs of numbers as x,y coordinates
    for (let i = 0; i < coords.length - 1; i += 2) {
      const x = coords[i] ?? 0;
      const y = coords[i + 1] ?? 0;
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    // Fallback if no valid coordinates found
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };

    return { minX, minY, maxX, maxY };
  }

  /**
   * Load the arrow sprite and extract all arrow groups
   * The sprite uses <g id="..."> elements (groups) not <symbol> elements
   * CSS classes are inlined as fill attributes for color transformation to work
   */
  async function loadArrowSprite(): Promise<void> {
    if (spriteLoaded) return;

    try {
      const response = await fetch(ARROW_SPRITE_PATH);
      if (!response.ok) throw new Error(`Failed to fetch sprite: ${response.status}`);
      const spriteText = await response.text();

      // Parse sprite and extract groups with IDs (arrows are stored as <g id="...">)
      const doc = new DOMParser().parseFromString(spriteText, "image/svg+xml");

      // Parse CSS style block to get class->fill mappings
      // This inlines fills like .st0{fill:#2E3192;} so color transformation works
      const classToFill = parseStyleBlock(doc, spriteText);
      cssClassToFill = classToFill;

      // Select all direct child groups with IDs (these are our arrows)
      const groups = doc.querySelectorAll("svg > g[id]");

      const newSymbols = new Map<string, SymbolData>();

      groups.forEach((group) => {
        const id = group.getAttribute("id");
        if (!id) return;

        // Get all paths in this group to calculate bounds
        const paths = group.querySelectorAll("path");
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        paths.forEach((path) => {
          const d = path.getAttribute("d") || "";
          const bounds = getPathBounds(d);
          minX = Math.min(minX, bounds.minX);
          minY = Math.min(minY, bounds.minY);
          maxX = Math.max(maxX, bounds.maxX);
          maxY = Math.max(maxY, bounds.maxY);
        });

        // Add padding around the bounds
        const padding = 5;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = maxX + padding;
        maxY = maxY + padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // Create viewBox from calculated bounds
        const viewBox = `${minX} ${minY} ${width} ${height}`;

        // Inner content - inline CSS fills so color transformation works
        const rawContent = group.innerHTML.trim();
        const innerContent = inlineCssFills(rawContent, classToFill);

        newSymbols.set(id, { viewBox, innerContent });

        // Parse and cache dimensions for each group
        const parsed = parseSymbol(viewBox, innerContent);
        parsedSvgCache.set(id, parsed);
      });

      spriteSymbols = newSymbols;
      parsedSvgCache = new Map(parsedSvgCache); // trigger reactivity
      spriteLoaded = true;
    } catch (e) {
      console.error("Failed to load arrow sprite:", e);
    }
  }

  /**
   * Parse symbol data to extract viewBox and center
   */
  function parseSymbol(viewBoxAttr: string, innerContent: string): ParsedSvgData {
    const viewBoxValues = viewBoxAttr.split(/\s+/);
    const minX = parseFloat(viewBoxValues[0] || "0") || 0;
    const minY = parseFloat(viewBoxValues[1] || "0") || 0;
    let width = parseFloat(viewBoxValues[2] || "100") || 100;
    let height = parseFloat(viewBoxValues[3] || "100") || 100;

    // Detect tiny arrows (dash base) and scale them up
    const isTinyArrow = width < 50 && height < 50;
    let scaleFactor = 1;
    if (isTinyArrow) {
      const targetSize = 250;
      const currentSize = Math.max(width, height);
      scaleFactor = targetSize / currentSize;
      width = width * scaleFactor;
      height = height * scaleFactor;
    }

    // Get center point from symbol content (look for centerPoint element)
    // Default center is the middle of the viewBox
    let center = { x: width / 2, y: height / 2 };
    try {
      const doc = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${innerContent}</svg>`,
        "image/svg+xml"
      );
      const centerElement = doc.getElementById("centerPoint");
      if (centerElement) {
        // The centerPoint cx/cy are absolute coordinates, need to offset by viewBox minX/minY
        const rawCenterX = parseFloat(centerElement.getAttribute("cx") || "0");
        const rawCenterY = parseFloat(centerElement.getAttribute("cy") || "0");
        center = {
          x: (rawCenterX - minX) * scaleFactor,
          y: (rawCenterY - minY) * scaleFactor,
        };
      }
    } catch {
      // Use default center
    }

    return { svgContent: innerContent, viewBox: { width, height }, center };
  }

  /**
   * Get symbol content by ID
   */
  function getSymbolContent(symbolId: string): string {
    const symbol = spriteSymbols.get(symbolId);
    return symbol?.innerContent || "";
  }

  /**
   * Get parsed SVG data for a symbol
   */
  function getParsedSvg(symbolId: string): ParsedSvgData | undefined {
    return parsedSvgCache.get(symbolId);
  }

  /**
   * Apply color to SVG content
   * Handles both 3-digit and 6-digit hex colors in various formats
   */
  function colorSvg(svgText: string, color: string): string {
    if (!svgText) return "";

    // Replace fill colors with the selected color
    // Handle 3-digit and 6-digit hex in both quote styles and CSS format
    return svgText
      // fill="#XXXXXX" or fill="#XXX" (double quotes)
      .replace(/fill="#[0-9a-fA-F]{3,6}"/g, `fill="${color}"`)
      // fill='#XXXXXX' or fill='#XXX' (single quotes)
      .replace(/fill='#[0-9a-fA-F]{3,6}'/g, `fill='${color}'`)
      // fill:#XXXXXX or fill:#XXX (CSS style)
      .replace(/fill:\s*#[0-9a-fA-F]{3,6}/g, `fill:${color}`)
      // stroke="#XXXXXX" (double quotes)
      .replace(/stroke="#[0-9a-fA-F]{3,6}"/g, `stroke="${color}"`)
      // stroke='#XXXXXX' (single quotes)
      .replace(/stroke='#[0-9a-fA-F]{3,6}'/g, `stroke='${color}'`);
  }

  /**
   * Load staff SVG (still uses individual files)
   */
  async function loadStaffSvg(path: string): Promise<string> {
    if (staffSvgCache.has(path)) {
      return staffSvgCache.get(path)!;
    }
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to fetch ${path}`);
      const svgText = await response.text();
      staffSvgCache.set(path, svgText);
      staffSvgCache = new Map(staffSvgCache);
      return svgText;
    } catch (e) {
      console.error(`Failed to load SVG: ${path}`, e);
      return "";
    }
  }

  // Load sprite and staffs on mount
  onMount(() => {
    loadArrowSprite();
    // Load staff SVGs
    STAFF_TYPES.forEach((staff) => {
      loadStaffSvg(staff.path);
    });
  });

  function setTab(tab: "arrows" | "staffs") {
    mandalaState.setAssetLibraryTab(tab);
  }

  function setFilter(motionType: string | null) {
    mandalaState.setAssetLibraryFilter(motionType);
  }

  function handleAssetClick(
    assetType: string,
    motionType: string,
    turns: number | null,
    color: string,
    symbolId: string
  ) {
    const parsed = getParsedSvg(symbolId);
    if (parsed) {
      // Apply color to the SVG content before passing
      const coloredData: ParsedSvgData = {
        ...parsed,
        svgContent: colorSvg(parsed.svgContent, color),
      };
      onAssetSelect?.(assetType, motionType, color, coloredData);
    } else {
      onAssetSelect?.(assetType, motionType, color);
    }
  }

  // Filtered arrow variations based on motion type filter
  const displayedArrows = $derived(
    filter
      ? ALL_ARROW_VARIATIONS.filter((a) => a.motionType === filter)
      : ALL_ARROW_VARIATIONS
  );
</script>

<div class="asset-library">
  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === "arrows"}
      onclick={() => setTab("arrows")}
    >
      {t('mandala_arrows')}
    </button>
    <button
      class="tab"
      class:active={activeTab === "staffs"}
      onclick={() => setTab("staffs")}
    >
      {t('mandala_staffs')}
    </button>
  </div>

  <!-- Color picker -->
  <div class="color-picker">
    {#each COLORS as colorOption (colorOption.id)}
      <button
        class="color-swatch"
        class:active={selectedColor === colorOption.color}
        style:background-color={colorOption.color}
        onclick={() => (selectedColor = colorOption.color)}
        title={colorOption.label}
      >
        {#if selectedColor === colorOption.color}
          <span class="check">✓</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Filter chips (for arrows) -->
  {#if activeTab === "arrows"}
    <div class="filter-chips">
      <button
        class="filter-chip"
        class:active={!filter}
        onclick={() => setFilter(null)}
      >
        {t('mandala_filter_all', { count: String(ALL_ARROW_VARIATIONS.length) })}
      </button>
      {#each MOTION_TYPES as motion (motion.id)}
        <button
          class="filter-chip"
          class:active={filter === motion.id}
          onclick={() => setFilter(filter === motion.id ? null : motion.id)}
        >
          {motion.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Asset grid -->
  <div class="asset-grid">
    {#if activeTab === "arrows"}
      {#each displayedArrows as arrow (arrow.id)}
        {@const symbolContent = getSymbolContent(arrow.symbolId)}
        {@const parsedData = getParsedSvg(arrow.symbolId)}
        <button
          class="asset-item"
          onclick={() =>
            handleAssetClick(
              "arrow",
              arrow.motionType,
              arrow.turns,
              selectedColor,
              arrow.symbolId
            )}
          draggable="true"
          ondragstart={(e) => {
            // Include parsed SVG data for proper rendering on drop
            const coloredContent = parsedData
              ? colorSvg(parsedData.svgContent, selectedColor)
              : "";
            e.dataTransfer?.setData(
              "application/json",
              JSON.stringify({
                type: "arrow",
                motionType: arrow.motionType,
                turns: arrow.turns,
                color: selectedColor,
                symbolId: arrow.symbolId,
                svgContent: coloredContent,
                viewBox: parsedData?.viewBox,
                center: parsedData?.center,
              })
            );
          }}
        >
          <div class="asset-preview">
            {#if symbolContent && spriteLoaded}
              <svg viewBox={spriteSymbols.get(arrow.symbolId)?.viewBox || "0 0 100 100"}>
                {@html colorSvg(symbolContent, selectedColor)}
              </svg>
            {:else}
              <ProgressRing percent={-1} size={24} strokeWidth={2} />
            {/if}
          </div>
          <span class="asset-label">{arrow.label}</span>
        </button>
      {/each}
    {:else}
      {#each STAFF_TYPES as staff (staff.id)}
        {@const svgContent = staffSvgCache.get(staff.path)}
        <button
          class="asset-item"
          onclick={() => handleAssetClick("staff", staff.id, null, selectedColor, staff.id)}
          draggable="true"
          ondragstart={(e) => {
            e.dataTransfer?.setData(
              "application/json",
              JSON.stringify({
                type: "staff",
                staffType: staff.id,
                color: selectedColor,
                path: staff.path,
                svgContent: svgContent ? colorSvg(svgContent, selectedColor) : "",
              })
            );
          }}
        >
          <div class="asset-preview">
            {#if svgContent}
              {@html colorSvg(svgContent, selectedColor)}
            {:else}
              <ProgressRing percent={-1} size={24} strokeWidth={2} />
            {/if}
          </div>
          <span class="asset-label">{staff.label}</span>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Instructions -->
  <div class="instructions">{t('mandala_drag_instruction')}</div>
</div>

<style>
  .asset-library {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--settings-radius-md, 8px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 4px;
  }

  .tab {
    flex: 1;
    padding: 8px 12px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .tab:hover {
    color: var(--theme-text, white);
  }

  .tab.active {
    background: var(--theme-accent, #4a9eff);
    color: white;
  }

  .color-picker {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .color-swatch {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) ease;
  }

  .color-swatch:hover {
    transform: scale(1.1);
  }

  .color-swatch.active {
    border-color: white;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }

  .check {
    color: white;
    font-size: 14px;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .filter-chip {
    padding: 4px 10px;
    font-size: var(--font-size-compact, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .filter-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, white);
  }

  .filter-chip.active {
    background: var(--theme-accent, #4a9eff);
    border-color: var(--theme-accent, #4a9eff);
    color: white;
  }

  .asset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 8px;
  }

  .asset-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 8px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: grab;
    transition: all var(--duration-fast) ease;
  }

  .asset-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .asset-item:active {
    cursor: grabbing;
    transform: translateY(0);
  }

  .asset-preview {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .asset-preview :global(svg) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .asset-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .instructions {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-style: italic;
  }

</style>
