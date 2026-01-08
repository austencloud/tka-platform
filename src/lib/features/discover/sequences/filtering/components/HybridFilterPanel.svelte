<!--
  HybridFilterPanel.svelte - Modern 2026 Filter UI

  Features:
  - Recent/smart quick filters
  - Visual filter grid with drill-down
  - Level cards using TKA color gradients
  - Container queries for responsive sizing
  - 50px minimum touch targets
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

  // Props
  const {
    currentFilter = { type: "all", value: null },
    onFilterChange = () => {},
  } = $props<{
    currentFilter?: { type: string; value: ExploreFilterValue };
    onFilterChange?: (type: string, value?: ExploreFilterValue) => void;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Filter type state for drill-down
  let activeFilterType = $state<
    "all" | "favorites" | "difficulty" | "letter" | "length" | "position"
  >("all");

  // Track if drill-down should show based on current filter
  $effect(() => {
    if (currentFilter.type === "difficulty") {
      activeFilterType = "difficulty";
    } else if (currentFilter.type === "startingLetter") {
      activeFilterType = "letter";
    } else if (currentFilter.type === "length") {
      activeFilterType = "length";
    } else if (currentFilter.type === "favorites") {
      activeFilterType = "favorites";
    } else if (currentFilter.type === "startingPosition") {
      activeFilterType = "position";
    } else {
      activeFilterType = "all";
    }
  });

  // TKA Level colors (white, silver, gold, red, purple)
  const levelConfig = [
    {
      level: 1,
      bgGradient: "linear-gradient(135deg, #ffffff, #e5e5e5)",
      textColor: "#1f2937",
    },
    {
      level: 2,
      bgGradient: "linear-gradient(135deg, #dcdce1, #a8a8b0)",
      textColor: "#1f2937",
    },
    {
      level: 3,
      bgGradient: "linear-gradient(135deg, #ffd700, #b8860b)",
      textColor: "#1f2937",
    },
    {
      level: 4,
      bgGradient: "linear-gradient(135deg, #ff7878, var(--semantic-error))",
      textColor: "#ffffff",
    },
    {
      level: 5,
      bgGradient: "linear-gradient(135deg, #d8b4fe, #9333ea)",
      textColor: "#ffffff",
    },
  ];

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const lengths = [2, 4, 6, 8, 10, 12, 16];
  const positions = [
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
    { id: "gamma", label: "Gamma" },
  ];

  // Recent filters (would be stored in localStorage in production)
  const recentFilters = ["Level 2", "Favorites", "Letter A"];

  // Handlers
  function handleFilterTypeSelect(type: typeof activeFilterType) {
    hapticService?.trigger("selection");
    activeFilterType = type;

    if (type === "all") {
      onFilterChange("all");
    } else if (type === "favorites") {
      onFilterChange("favorites");
    }
  }

  function handleLevelSelect(level: number) {
    hapticService?.trigger("selection");
    if (currentFilter.type === "difficulty" && currentFilter.value === level) {
      onFilterChange("all");
      activeFilterType = "all";
    } else {
      onFilterChange("difficulty", level);
    }
  }

  function handleLetterSelect(letter: string) {
    hapticService?.trigger("selection");
    if (
      currentFilter.type === "startingLetter" &&
      currentFilter.value === letter
    ) {
      onFilterChange("all");
      activeFilterType = "all";
    } else {
      onFilterChange("startingLetter", letter);
    }
  }

  function handleLengthSelect(length: number) {
    hapticService?.trigger("selection");
    if (currentFilter.type === "length" && currentFilter.value === length) {
      onFilterChange("all");
      activeFilterType = "all";
    } else {
      onFilterChange("length", length);
    }
  }

  function handlePositionSelect(position: string) {
    hapticService?.trigger("selection");
    if (
      currentFilter.type === "startingPosition" &&
      currentFilter.value === position
    ) {
      onFilterChange("all");
      activeFilterType = "all";
    } else {
      onFilterChange("startingPosition", position);
    }
  }

  function handleQuickFilter(filter: string) {
    hapticService?.trigger("selection");
    if (filter === "Favorites") {
      onFilterChange("favorites");
      activeFilterType = "favorites";
    } else if (filter.startsWith("Level ")) {
      const level = parseInt(filter.replace("Level ", ""));
      onFilterChange("difficulty", level);
      activeFilterType = "difficulty";
    } else if (filter.startsWith("Letter ")) {
      const letter = filter.replace("Letter ", "");
      onFilterChange("startingLetter", letter);
      activeFilterType = "letter";
    }
  }

  // Derived states
  const isLevelSelected = (level: number) =>
    currentFilter.type === "difficulty" && currentFilter.value === level;
  const isLetterSelected = (letter: string) =>
    currentFilter.type === "startingLetter" && currentFilter.value === letter;
  const isLengthSelected = (length: number) =>
    currentFilter.type === "length" && currentFilter.value === length;
  const isPositionSelected = (pos: string) =>
    currentFilter.type === "startingPosition" && currentFilter.value === pos;
</script>

<div class="hybrid-filter-panel">
  <!-- Recent Filters -->
  <div class="panel-section">
    <div class="section-label">Recent</div>
    <div class="quick-chips">
      {#each recentFilters as filter}
        <button class="quick-chip" onclick={() => handleQuickFilter(filter)}>
          {filter}
        </button>
      {/each}
    </div>
  </div>

  <!-- Filter By Grid -->
  <div class="panel-section">
    <div class="section-label">Filter By</div>
    <div class="filter-grid">
      <button
        class="filter-card"
        class:selected={activeFilterType === "all"}
        onclick={() => handleFilterTypeSelect("all")}
      >
        <div class="card-icon">
          <i class="fas fa-globe" aria-hidden="true"></i>
        </div>
        <span class="card-label">All</span>
      </button>

      <button
        class="filter-card"
        class:selected={activeFilterType === "favorites"}
        onclick={() => handleFilterTypeSelect("favorites")}
      >
        <div class="card-icon favorites">
          <i class="fas fa-heart" aria-hidden="true"></i>
        </div>
        <span class="card-label">Favorites</span>
      </button>

      <button
        class="filter-card"
        class:selected={activeFilterType === "difficulty"}
        onclick={() => handleFilterTypeSelect("difficulty")}
      >
        <div class="card-icon">
          <i class="fas fa-layer-group" aria-hidden="true"></i>
        </div>
        <span class="card-label">By Level</span>
      </button>

      <button
        class="filter-card"
        class:selected={activeFilterType === "letter"}
        onclick={() => handleFilterTypeSelect("letter")}
      >
        <div class="card-icon">
          <i class="fas fa-font" aria-hidden="true"></i>
        </div>
        <span class="card-label">By Letter</span>
      </button>

      <button
        class="filter-card"
        class:selected={activeFilterType === "length"}
        onclick={() => handleFilterTypeSelect("length")}
      >
        <div class="card-icon">
          <i class="fas fa-ruler-horizontal" aria-hidden="true"></i>
        </div>
        <span class="card-label">By Length</span>
      </button>

      <button
        class="filter-card"
        class:selected={activeFilterType === "position"}
        onclick={() => handleFilterTypeSelect("position")}
      >
        <div class="card-icon">
          <i class="fas fa-crosshairs" aria-hidden="true"></i>
        </div>
        <span class="card-label">Position</span>
      </button>
    </div>
  </div>

  <!-- Drill-down: Level Selection -->
  {#if activeFilterType === "difficulty"}
    <div class="panel-section drill-down">
      <div class="section-label">Select Level</div>
      <div class="level-cards">
        {#each levelConfig.slice(0, 3) as config}
          <button
            class="level-card"
            class:selected={isLevelSelected(config.level)}
            style="--level-bg: {config.bgGradient}; --level-text: {config.textColor}"
            onclick={() => handleLevelSelect(config.level)}
          >
            <span class="level-num">{config.level}</span>
          </button>
        {/each}
      </div>
      <div class="future-levels">
        <span class="coming-soon">Coming soon:</span>
        {#each levelConfig.slice(3) as config}
          <button
            class="level-card future"
            style="--level-bg: {config.bgGradient}; --level-text: {config.textColor}"
            disabled
          >
            <span class="level-num">{config.level}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Drill-down: Letter Selection -->
  {#if activeFilterType === "letter"}
    <div class="panel-section drill-down">
      <div class="section-label">Select Letter</div>
      <div class="letter-grid">
        {#each letters as letter}
          <button
            class="letter-btn"
            class:selected={isLetterSelected(letter)}
            onclick={() => handleLetterSelect(letter)}
          >
            {letter}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Drill-down: Length Selection -->
  {#if activeFilterType === "length"}
    <div class="panel-section drill-down">
      <div class="section-label">Select Length</div>
      <div class="length-chips">
        {#each lengths as len}
          <button
            class="length-chip"
            class:selected={isLengthSelected(len)}
            onclick={() => handleLengthSelect(len)}
          >
            {len} beats
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Drill-down: Position Selection -->
  {#if activeFilterType === "position"}
    <div class="panel-section drill-down">
      <div class="section-label">Select Position</div>
      <div class="position-chips">
        {#each positions as pos}
          <button
            class="position-chip"
            class:selected={isPositionSelected(pos.id)}
            onclick={() => handlePositionSelect(pos.id)}
          >
            {pos.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .hybrid-filter-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 20px);
    padding: clamp(12px, 3cqi, 20px);
    background: var(--theme-panel-bg);
    container-type: inline-size;
    container-name: filter-panel;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
  }

  .section-label {
    font-size: clamp(10px, 2.5cqi, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Quick Chips */
  .quick-chips {
    display: flex;
    gap: clamp(6px, 1.5cqi, 10px);
    flex-wrap: wrap;
  }

  .quick-chip {
    min-height: var(--min-touch-target);
    padding: 0 clamp(12px, 3cqi, 18px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 100px;
    color: var(--theme-text-dim);
    font-size: clamp(12px, 2.5cqi, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-chip:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  /* Filter Grid */
  .filter-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(8px, 2cqi, 12px);
  }

  @container filter-panel (max-width: 280px) {
    .filter-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .filter-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5cqi, 10px);
    min-height: clamp(72px, 18cqi, 90px);
    padding: clamp(10px, 2.5cqi, 16px);
    background: var(--theme-card-bg);
    border: 2px solid transparent;
    border-radius: clamp(12px, 3cqi, 16px);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-card:hover {
    background: var(--theme-card-hover-bg);
    transform: translateY(-2px);
  }

  .filter-card.selected {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      var(--theme-card-bg)
    );
    border-color: var(--semantic-info, var(--semantic-info));
    color: var(--theme-text, white);
  }

  .card-icon {
    width: clamp(32px, 8cqi, 42px);
    height: clamp(32px, 8cqi, 42px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      transparent
    );
    border-radius: clamp(8px, 2cqi, 12px);
    color: var(--semantic-info, var(--semantic-info));
    font-size: clamp(12px, 3cqi, 16px);
  }

  .filter-card.selected .card-icon {
    background: var(--semantic-info, var(--semantic-info));
    color: var(--theme-text, white);
  }

  .card-icon.favorites {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    color: var(--semantic-error);
  }

  .filter-card.selected .card-icon.favorites {
    background: var(--semantic-error);
    color: var(--theme-text, white);
  }

  .card-label {
    font-size: clamp(10px, 2.5cqi, 12px);
    font-weight: 500;
    text-align: center;
  }

  /* Drill-down */
  .drill-down {
    padding: clamp(12px, 3cqi, 16px);
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 5%,
      transparent
    );
    border-radius: clamp(10px, 2.5cqi, 14px);
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 15%,
        transparent
      );
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Level Cards */
  .level-cards {
    display: flex;
    gap: clamp(8px, 2cqi, 12px);
  }

  .level-card {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: clamp(48px, 14cqi, 72px);
    padding: clamp(12px, 3cqi, 18px);
    background: var(--level-bg);
    border: 2px solid transparent;
    border-radius: clamp(10px, 2.5cqi, 14px);
    color: var(--level-text);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .level-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--theme-shadow, var(--theme-shadow));
  }

  .level-card.selected {
    border-color: var(--semantic-info, var(--semantic-info));
    box-shadow: 0 0 0 2px
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 30%,
        transparent
      );
  }

  .level-num {
    font-size: clamp(18px, 4.5cqi, 26px);
    font-weight: 700;
  }

  .future-levels {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 10px);
    margin-top: clamp(8px, 2cqi, 12px);
    padding-top: clamp(8px, 2cqi, 12px);
    border-top: 1px dashed var(--theme-stroke, var(--theme-stroke));
  }

  .coming-soon {
    font-size: clamp(10px, 2.5cqi, 12px);
    color: var(--theme-text-dim);
  }

  .level-card.future {
    flex: 0;
    min-height: 40px;
    padding: 8px 16px;
    opacity: 0.4;
    cursor: not-allowed;
  }

  .level-card.future .level-num {
    font-size: clamp(12px, 3cqi, 16px);
  }

  /* Letter Grid */
  .letter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: clamp(4px, 1cqi, 8px);
  }

  .letter-btn {
    min-height: var(--min-touch-target);
    min-width: 44px;
    padding: 0;
    background: var(--theme-card-bg);
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: clamp(13px, 3cqi, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .letter-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  .letter-btn.selected {
    background: var(--semantic-info, var(--semantic-info));
    color: var(--theme-text, white);
  }

  /* Length & Position Chips */
  .length-chips,
  .position-chips {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 1.5cqi, 10px);
  }

  .length-chip,
  .position-chip {
    min-height: var(--min-touch-target);
    padding: 0 clamp(14px, 3.5cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid transparent;
    border-radius: 100px;
    color: var(--theme-text-dim);
    font-size: clamp(13px, 3cqi, 15px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .length-chip:hover,
  .position-chip:hover {
    background: var(--theme-card-hover-bg);
  }

  .length-chip.selected,
  .position-chip.selected {
    background: var(--semantic-info, var(--semantic-info));
    color: var(--theme-text, white);
  }
</style>
