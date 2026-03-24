<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";

  const { state } = getFestivalContext();

  function handleRegionChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    state.filters = {
      ...state.filters,
      region: value === "all" ? undefined : (value as typeof state.filters.region),
    };
    const uid = auth.currentUser?.uid;
    if (uid) state.loadFestivals(uid);
  }

  function handleTimeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    state.filters = {
      ...state.filters,
      timeWindow: value === "upcoming" ? undefined : (value as typeof state.filters.timeWindow),
    };
    const uid = auth.currentUser?.uid;
    if (uid) state.loadFestivals(uid);
  }

  function handleSeekingChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    state.filters = {
      ...state.filters,
      seeking: value === "all" ? undefined : (value as typeof state.filters.seeking),
    };
    const uid = auth.currentUser?.uid;
    if (uid) state.loadFestivals(uid);
  }
</script>

<div class="filter-bar" role="search" aria-label="Festival filters">
  <select
    class="filter-select"
    value={state.filters.region ?? "all"}
    onchange={handleRegionChange}
    aria-label="Filter by region"
  >
    <option value="all">All Regions</option>
    <option value="north-america">North America</option>
    <option value="europe">Europe</option>
    <option value="oceania">Oceania</option>
    <option value="asia">Asia</option>
    <option value="south-america">South America</option>
    <option value="africa">Africa</option>
  </select>

  <select
    class="filter-select"
    value={state.filters.timeWindow ?? "upcoming"}
    onchange={handleTimeChange}
    aria-label="Filter by time window"
  >
    <option value="upcoming">Upcoming</option>
    <option value="3months">Next 3 months</option>
    <option value="6months">Next 6 months</option>
    <option value="year">This year</option>
  </select>

  <select
    class="filter-select"
    value={state.filters.seeking ?? "all"}
    onchange={handleSeekingChange}
    aria-label="Filter by seeking"
  >
    <option value="all">All Festivals</option>
    <option value="applications-open">Applications Open</option>
    <option value="instructors">Seeking Instructors</option>
    <option value="performers">Seeking Performers</option>
  </select>
</div>

<style>
  .filter-bar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .filter-bar::-webkit-scrollbar {
    display: none;
  }

  .filter-select {
    appearance: none;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 20px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    padding: 6px 28px 6px 12px;
    white-space: nowrap;
    flex-shrink: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.5)' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .filter-select:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background-color: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .filter-select option {
    background: var(--theme-panel-bg, #12121c);
    color: var(--theme-text, #ffffff);
  }
</style>
