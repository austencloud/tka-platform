<script lang="ts">
  import { mandalaState } from "../../state/mandala-state.svelte";
  import { TKA_BLUE, TKA_RED } from "../../domain/models/mandala-config";
  import { onMount } from "svelte";

  interface Props {
    onAssetSelect?: (
      assetType: string,
      motionType: string,
      color: string
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
  interface ArrowVariation {
    id: string;
    motionType: string;
    motionLabel: string;
    turns: number | null;
    label: string;
    path: string;
  }

  const ALL_ARROW_VARIATIONS: ArrowVariation[] = MOTION_TYPES.flatMap(
    (motion): ArrowVariation[] => {
      if (motion.id === "float") {
        // Float has no turn variations
        return [
          {
            id: "float",
            motionType: "float" as string,
            motionLabel: "Float",
            turns: null,
            label: "Float",
            path: "/images/arrows/float.svg",
          },
        ];
      }
      // All other motion types have turn variations
      return TURN_VALUES.map((turn) => ({
        id: `${motion.id}_${turn}`,
        motionType: motion.id as string,
        motionLabel: motion.label,
        turns: turn as number | null,
        label: `${motion.label} ${turn}`,
        path: `/images/arrows/${motion.id}/from_radial/${motion.id}_${turn.toFixed(1)}.svg`,
      }));
    }
  );

  // Staff types - use actual staff SVGs
  const STAFF_TYPES = [
    { id: "staff", label: "Staff", path: "/images/props/staff.svg" },
  ] as const;

  // Color options
  const COLORS = [
    { id: "blue", color: TKA_BLUE, label: "Blue" },
    { id: "red", color: TKA_RED, label: "Red" },
  ] as const;

  let selectedColor = $state(TKA_BLUE);

  // SVG cache
  let arrowSvgCache = $state<Map<string, string>>(new Map());
  let staffSvgCache = $state<Map<string, string>>(new Map());

  // Load an SVG and cache it
  async function loadSvg(
    path: string,
    cache: Map<string, string>,
    updateCache: (m: Map<string, string>) => void
  ): Promise<string> {
    if (cache.has(path)) {
      return cache.get(path)!;
    }
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to fetch ${path}`);
      const svgText = await response.text();
      cache.set(path, svgText);
      updateCache(new Map(cache)); // trigger reactivity
      return svgText;
    } catch (e) {
      console.error(`Failed to load SVG: ${path}`, e);
      return "";
    }
  }

  // Convenience wrappers
  function loadArrowSvg(path: string) {
    return loadSvg(path, arrowSvgCache, (m) => (arrowSvgCache = m));
  }

  function loadStaffSvg(path: string) {
    return loadSvg(path, staffSvgCache, (m) => (staffSvgCache = m));
  }

  // Apply color to SVG
  function colorSvg(svgText: string, color: string): string {
    if (!svgText) return "";
    // Replace fill colors with the selected color
    // TKA arrows use #2e3192 (blue) and #ed1c24 (red) as base colors
    return svgText
      .replace(/fill="#[0-9a-fA-F]{6}"/g, `fill="${color}"`)
      .replace(/fill='#[0-9a-fA-F]{6}'/g, `fill='${color}'`)
      .replace(/stroke="#[0-9a-fA-F]{6}"/g, `stroke="${color}"`)
      .replace(/stroke='#[0-9a-fA-F]{6}'/g, `stroke='${color}'`);
  }

  // Load all SVGs on mount
  onMount(() => {
    // Load ALL arrow variation SVGs
    ALL_ARROW_VARIATIONS.forEach((arrow) => {
      loadArrowSvg(arrow.path);
    });
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
    color: string
  ) {
    onAssetSelect?.(assetType, motionType, color);
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
      Arrows
    </button>
    <button
      class="tab"
      class:active={activeTab === "staffs"}
      onclick={() => setTab("staffs")}
    >
      Staffs
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
        All ({ALL_ARROW_VARIATIONS.length})
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
        {@const svgContent = arrowSvgCache.get(arrow.path)}
        <button
          class="asset-item"
          onclick={() =>
            handleAssetClick(
              "arrow",
              arrow.motionType,
              arrow.turns,
              selectedColor
            )}
          draggable="true"
          ondragstart={(e) => {
            e.dataTransfer?.setData(
              "application/json",
              JSON.stringify({
                type: "arrow",
                motionType: arrow.motionType,
                turns: arrow.turns,
                color: selectedColor,
                path: arrow.path,
              })
            );
          }}
        >
          <div class="asset-preview">
            {#if svgContent}
              {@html colorSvg(svgContent, selectedColor)}
            {:else}
              <span class="loading-indicator">...</span>
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
          onclick={() => handleAssetClick("staff", staff.id, null, selectedColor)}
          draggable="true"
          ondragstart={(e) => {
            e.dataTransfer?.setData(
              "application/json",
              JSON.stringify({
                type: "staff",
                staffType: staff.id,
                color: selectedColor,
              })
            );
          }}
        >
          <div class="asset-preview">
            {#if svgContent}
              {@html colorSvg(svgContent, selectedColor)}
            {:else}
              <span class="loading-indicator">...</span>
            {/if}
          </div>
          <span class="asset-label">{staff.label}</span>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Instructions -->
  <div class="instructions">Click or drag to add to canvas</div>
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
    transition: all 0.15s ease;
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
    transition: all 0.15s ease;
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
    transition: all 0.15s ease;
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
    transition: all 0.15s ease;
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

  .loading-indicator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 12px;
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
