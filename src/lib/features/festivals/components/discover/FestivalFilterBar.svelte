<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";
  import type { FestivalRegion } from "../../domain/models/festival";

  const { state } = getFestivalContext();

  const REGIONS: { value: FestivalRegion | "all"; label: string }[] = [
    { value: "all", label: "All Regions" },
    { value: "north-america", label: "N. America" },
    { value: "europe", label: "Europe" },
    { value: "oceania", label: "Oceania" },
    { value: "asia", label: "Asia" },
    { value: "south-america", label: "S. America" },
    { value: "africa", label: "Africa" },
  ];

  const TIME_WINDOWS: { value: string; label: string }[] = [
    { value: "upcoming", label: "Upcoming" },
    { value: "3months", label: "3 Months" },
    { value: "6months", label: "6 Months" },
    { value: "year", label: "This Year" },
  ];

  const SEEKING: { value: string; label: string; icon: string }[] = [
    { value: "all", label: "All", icon: "fa-globe" },
    { value: "applications-open", label: "Apps Open", icon: "fa-door-open" },
    { value: "instructors", label: "Instructors", icon: "fa-chalkboard-teacher" },
    { value: "performers", label: "Performers", icon: "fa-fire" },
  ];

  function applyFilters() {
    const uid = auth.currentUser?.uid;
    if (uid) state.loadFestivals(uid);
  }

  function setRegion(value: string) {
    state.filters = {
      ...state.filters,
      region: value === "all" ? undefined : (value as FestivalRegion),
    };
    applyFilters();
  }

  function setTimeWindow(value: string) {
    state.filters = {
      ...state.filters,
      timeWindow: value === "upcoming" ? undefined : (value as typeof state.filters.timeWindow),
    };
    applyFilters();
  }

  function setSeeking(value: string) {
    state.filters = {
      ...state.filters,
      seeking: value === "all" ? undefined : (value as typeof state.filters.seeking),
    };
    applyFilters();
  }

  const activeRegion = $derived(state.filters.region ?? "all");
  const activeTime = $derived(state.filters.timeWindow ?? "upcoming");
  const activeSeeking = $derived(state.filters.seeking ?? "all");
</script>

<div class="filter-bar" role="search" aria-label="Festival filters">
  <!-- Region chips -->
  <div class="chip-group" role="radiogroup" aria-label="Filter by region">
    {#each REGIONS as r (r.value)}
      <button
        class="chip"
        class:active={activeRegion === r.value}
        onclick={() => setRegion(r.value)}
        role="radio"
        aria-checked={activeRegion === r.value}
        type="button"
      >
        {r.label}
      </button>
    {/each}
  </div>

  <div class="divider"></div>

  <!-- Time window chips -->
  <div class="chip-group" role="radiogroup" aria-label="Filter by time">
    {#each TIME_WINDOWS as t (t.value)}
      <button
        class="chip"
        class:active={activeTime === t.value}
        onclick={() => setTimeWindow(t.value)}
        role="radio"
        aria-checked={activeTime === t.value}
        type="button"
      >
        {t.label}
      </button>
    {/each}
  </div>

  <div class="divider"></div>

  <!-- Seeking chips -->
  <div class="chip-group" role="radiogroup" aria-label="Filter by type">
    {#each SEEKING as s (s.value)}
      <button
        class="chip"
        class:active={activeSeeking === s.value}
        onclick={() => setSeeking(s.value)}
        role="radio"
        aria-checked={activeSeeking === s.value}
        type="button"
      >
        <i class="fas {s.icon}" aria-hidden="true"></i>
        {s.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .filter-bar::-webkit-scrollbar {
    display: none;
  }

  .chip-group {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 16px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 22px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color var(--transition-fast, 0.15s),
      background var(--transition-fast, 0.15s),
      color var(--transition-fast, 0.15s);
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .chip i {
    font-size: 11px;
  }

  .divider {
    width: 1px;
    height: 24px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  /* ── Reduced motion ──────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
